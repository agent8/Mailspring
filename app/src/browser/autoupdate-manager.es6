/* eslint global-require: 0*/
import { dialog } from 'electron';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs';
import { getDeviceHash, syncGetDeviceHash } from '../system-utils';
import axios from 'axios';
import moment from 'moment';

let autoUpdater = null;

const IdleState = 'idle';
const CheckingState = 'checking';
const DownloadingState = 'downloading';
const UpdateAvailableState = 'update-available';
const NoUpdateAvailableState = 'no-update-available';
const UnsupportedState = 'unsupported';
const ErrorState = 'error';
const preferredChannel = 'stable';

export default class AutoUpdateManager extends EventEmitter {
  constructor(version, config, specMode, devMode) {
    super();

    this.state = IdleState;
    this.version = version;
    this.config = config;
    this.specMode = specMode;
    this.devMode = devMode;
    this.preferredChannel = preferredChannel;
    this.supportId = syncGetDeviceHash();

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
    const host = process.env.updateServer || `https://cp.edison.tech/api/ota/checkUpdate`;
    if (this.supportId === '') {
      try {
        this.supportId = await getDeviceHash();
      } catch (err) {
        this.supportId = '';
      }
    }
    this.feedURL = `${host}?platform=desktop-${params.platform}-full&clientVersion=${params.version}&supportId=${this.supportId}`;
    return this.feedURL;
  }

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

    //check every 30 minutes
    setInterval(() => {
      if ([UpdateAvailableState, UnsupportedState].includes(this.state)) {
        console.log('Skipping update check... update ready to install, or updater unavailable.');
        return;
      }
      this.check({ hidePopups: true });
    }, 1000 * 60 * 60 * 1);
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
    this.emit('state-changed', this.state);
  }

  getState() {
    return this.state;
  }

  getReleaseDetails() {
    return {
      releaseVersion: this.releaseVersion,
      releaseNotes: this.releaseNotes,
    };
  }

  check = async ({ hidePopups, manuallyCheck = false } = {}) => {
    const REMINDER_LATER_KEY = 'reminder_later_date';
    const res = await axios.get(await this.getFeedUrl());
    const today = moment().format('YYYYMMDD');
    if (res && res.data && res.data.pckVersion) {
      if (this.devMode || this.getState() === DownloadingState) {
        return;
      }
      let choice = 0;
      if (manuallyCheck) {
        choice = dialog.showMessageBoxSync({
          type: 'info',
          buttons: ['Update', 'Remind Me Later'],
          icon: this.iconURL(),
          message: `Update available.`,
          title: 'Update Available',
          detail: `New EdisonMail available. Version (${res.data.pckVersion}).`,
        });
        // Remind Me Later
        if (choice === 1) {
          this.config.set(REMINDER_LATER_KEY, today);
        }
        // Update
        else {
          await this.updateFeedURL();
          if (!hidePopups) {
            autoUpdater.once('update-not-available', this.onUpdateNotAvailable);
            autoUpdater.once('error', this.onUpdateError);
          }
          autoUpdater.checkForUpdates();
        }
      } else {
        // Update
        await this.updateFeedURL();
        if (!hidePopups) {
          autoUpdater.once('update-not-available', this.onUpdateNotAvailable);
          autoUpdater.once('error', this.onUpdateError);
        }
        autoUpdater.checkForUpdates();
      }
    } else if (!res.data) {
      if (manuallyCheck) {
        this.onUpdateNotAvailable();
      }
    }
  }

  install() {
    autoUpdater.quitAndInstall();
  }

  iconURL() {
    const url = path.join(process.resourcesPath, 'app', 'edisonmail.png');
    if (!fs.existsSync(url)) {
      return undefined;
    }
    return url;
  }

  onUpdateNotAvailable = () => {
    autoUpdater.removeListener('error', this.onUpdateError);
    dialog.showMessageBox({
      type: 'info',
      buttons: ['OK'],
      icon: this.iconURL(),
      message: 'No update available.',
      title: 'No Update Available',
      detail: `You're running the latest version of EdisonMail (${this.version}).`,
    });
  };

  onUpdateError = (event, message) => {
    autoUpdater.removeListener('update-not-available', this.onUpdateNotAvailable);
    dialog.showMessageBox({
      type: 'warning',
      buttons: ['OK'],
      icon: this.iconURL(),
      message: 'There was an error checking for updates.',
      title: 'Update Error',
      detail: message,
    });
  };
}