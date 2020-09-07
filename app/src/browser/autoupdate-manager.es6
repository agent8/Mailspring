/* eslint global-require: 0*/
import { dialog, shell, app } from 'electron';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { getDeviceHash, syncGetDeviceHash } from '../system-utils';
import axios from 'axios';
import moment from 'moment';
import { ServerInfoPriorityEnum, AutoUpdateManagerState } from '../constant';

let autoUpdater = null;

const IdleState = AutoUpdateManagerState.IdleState;
const CheckingState = AutoUpdateManagerState.CheckingState;
const AvailableForDownload = AutoUpdateManagerState.AvailableForDownload;
const DownloadingState = AutoUpdateManagerState.DownloadingState;
const UpdateAvailableState = AutoUpdateManagerState.UpdateAvailableState;
const NoUpdateAvailableState = AutoUpdateManagerState.NoUpdateAvailableState;
const UnsupportedState = AutoUpdateManagerState.UnsupportedState;
const ErrorState = AutoUpdateManagerState.ErrorState;
const preferredChannel = 'stable';
const REMINDER_LATER_KEY = 'reminder_later_date';

export default class AutoUpdateManager extends EventEmitter {
  constructor(version, config, specMode, devMode, host) {
    super();

    this.state = IdleState;
    this.version = version;
    this.config = config;
    this.specMode = specMode;
    this.devMode = devMode;
    this.host = host;
    this.preferredChannel = preferredChannel;
    this.supportId = syncGetDeviceHash();
    this._hasForceUpdateMessageDialog = false;
    this.showOnNotAvailableOrError = false;
    this.errorMessage = '';

    this.updateFeedURL().then(() => {
      setTimeout(() => this.setupAutoUpdater(), 0);
    });
    this.config.onDidChange('identity.id', this.updateFeedURL);
  }

  getFeedUrl = async () => {
    const params = {
      platform: process.platform,
      arch: process.arch,
      version: this.version,
      id: this.config.get('identity.id') || 'anonymous',
      channel: this.preferredChannel,
    };
    if (params.platform === 'darwin') {
      params.platform = 'mac';
    }
    const host = `${this.host}/api/ota/checkUpdate`;
    if (this.supportId === '') {
      try {
        this.supportId = await getDeviceHash();
      } catch (err) {
        this.supportId = '';
      }
    }
    this.feedURL = `${host}?platform=desktop-${params.platform}-full&clientVersion=${params.version}&supportId=${this.supportId}`;
    return this.feedURL;
  };
  getVersionInfoUrl = async () => {
    const host = `${this.host}/api/ota/common/getInfoByVer`;
    const platform = process.platform === 'darwin' ? 'mac' : process.platform;
    if (this.supportId === '') {
      try {
        this.supportId = await getDeviceHash();
      } catch (err) {
        this.supportId = '';
      }
    }
    this.feedURL = `${host}?platform=desktop-${platform}-full&clientVersion=${this.version}`;
    return this.feedURL;
  };

  updateFeedURL = async () => {
    this.feedURL = await this.getFeedUrl();
    if (autoUpdater) {
      autoUpdater.setFeedURL(this.feedURL);
    }
  };

  setupAutoUpdater() {
    if (process.platform === 'win32') {
      const Impl = require('./autoupdate-impl-win32').default;
      autoUpdater = new Impl();
    } else if (process.platform === 'linux') {
      const Impl = require('./autoupdate-impl-base').default;
      autoUpdater = new Impl();
    } else {
      autoUpdater = require('electron').autoUpdater;
    }

    autoUpdater.on('error', error => {
      if (this.specMode) return;
      console.error(`Error Downloading Update: ${error.message}`);
      this.setState(ErrorState);
    });

    // autoUpdater.setFeedURL(this.feedURL);

    autoUpdater.on('checking-for-update', () => {
      this.setState(CheckingState);
    });

    autoUpdater.on('update-not-available', () => {
      this.setState(NoUpdateAvailableState);
    });

    autoUpdater.on('update-available', () => {
      this.setState(DownloadingState);
    });

    autoUpdater.on('update-downloaded', (event, releaseNotes, releaseVersion) => {
      this.releaseNotes = releaseNotes;
      this.releaseVersion = releaseVersion;
      this.setState(UpdateAvailableState);
      this.emitUpdateAvailableEvent();
    });

    if (autoUpdater.supportsUpdates && !autoUpdater.supportsUpdates()) {
      this.setState(UnsupportedState);
      return;
    }

    //check immediately at startup
    setTimeout(() => this.check({ hidePopups: true }), 20 * 1000);

    //check every 60 minutes
    setInterval(() => {
      if ([UpdateAvailableState, UnsupportedState].includes(this.state)) {
        console.log('Skipping update check... update ready to install, or updater unavailable.');
        return;
      }
      this.check({ hidePopups: true });
    }, 1000 * 60 * 60);
    console.log(`\n------->\nupdater set feedURL ${this.feedURL}`);
  }

  emitUpdateAvailableEvent() {
    // if (!this.releaseVersion) {
    //   return;
    // }
    global.application.windowManager.sendToAllWindows(
      'update-available',
      {},
      this.getReleaseDetails()
    );
  }

  setState(state) {
    if (this.state === state) {
      return;
    }
    this.state = state;
    console.log(`state-changed ${state}`);
    this.emit('state-changed', this.state);
  }

  getState() {
    return this.state;
  }

  getReleaseDetails() {
    return {
      releaseVersion: this.releaseVersion,
      releaseNotes: this.releaseNotes,
      currentVersion: this.version,
    };
  }

  check = async ({ hidePopups, manuallyCheck = false } = {}) => {
    if (this.devMode) {
      return;
    }
    if (this.state === IdleState) {
      this.setState(CheckingState);
    }
    const res = await axios.get(await this.getFeedUrl());
    if (res && res.data && res.data.pckVersion) {
      if (this.getState() === DownloadingState) {
        return;
      }
      if (!hidePopups) {
        this.showOnNotAvailableOrError = true;
      }
      if (manuallyCheck) {
        this.onUpdateAvailableForDownload(res.data.pckVersion);
      } else {
        await this.downloadUpdate();
      }
    } else if (!res.data) {
      if (manuallyCheck) {
        if (!hidePopups) {
          this.showOnNotAvailableOrError = true;
        }
        this.setState(NoUpdateAvailableState);
      } else {
        this.setState(IdleState);
      }
    } else {
      this.setState(IdleState);
    }
  };
  checkForce = async () => {
    try {
      if (this.devMode) {
        return;
      }
      const { data } = await axios.get(await this.getVersionInfoUrl());
      if (data && data.data && data.data.info) {
        const { priority, message, title, detail, url } = JSON.parse(data.data.info);
        if (priority === ServerInfoPriorityEnum.UpdateInfo) {
          // if message is update info for what's new, skip
          return;
        }
        if (priority !== ServerInfoPriorityEnum.Extraordinary) {
          // if message is not in height level, only show only one at a time
          if (this._hasForceUpdateMessageDialog) {
            return;
          }
          this._hasForceUpdateMessageDialog = true;
        }
        const choice = dialog.showMessageBoxSync({
          type: 'info',
          buttons: ['OK'],
          icon: this.iconURL(),
          message: message,
          title: title,
          detail: detail,
        });
        if (priority !== ServerInfoPriorityEnum.Extraordinary) {
          this._hasForceUpdateMessageDialog = false;
        }
        if (choice === 0) {
          if (url) {
            try {
              await shell.openExternal(url);
            } catch (err) {}
          }
          switch (priority) {
            case ServerInfoPriorityEnum.Extraordinary:
              app.quit();
              break;
            default:
              break;
          }
        }
      }
    } catch (err) {}
  };

  install() {
    autoUpdater.quitAndInstall();
  }
  async downloadUpdate() {
    await this.updateFeedURL();
    autoUpdater.checkForUpdates();
    if (this.state === IdleState) {
      this.setState(CheckingState);
    }
  }

  ignoreUpdate() {
    const today = moment().format('YYYYMMDD');
    this.config.set(REMINDER_LATER_KEY, today);
    this.showOnNotAvailableOrError = false;
    if (this.state !== DownloadingState) {
      this.setState(IdleState);
    }
  }

  iconURL() {
    const url = path.join(process.resourcesPath, 'app', 'edisonmail.png');
    if (!fs.existsSync(url)) {
      return undefined;
    }
    return url;
  }
  onUpdateAvailableForDownload = version => {
    this.releaseVersion = version;
    this.setState(AvailableForDownload);
  };
}
