import path from 'path';
import fs from 'fs-plus';
import { BrowserWindow, dialog, app } from 'electron';
import { atomicWriteFileSync } from '../fs-utils';
import Utils from '../flux/models/utils';

let _ = require('underscore');
_ = Object.assign(_, require('../config-utils'));

const RETRY_SAVES = 3;

export default class ConfigPersistenceManager {
  constructor({ configDirPath, resourcePath } = {}) {
    this.configDirPath = configDirPath;
    this.resourcePath = resourcePath;

    this.shouldSyncToNativeConfigs = [];
    this.userWantsToPreserveErrors = false;
    this.saveRetries = 0;
    this.configFilePath = path.join(this.configDirPath, 'config.json');
    this.configChangeTimeFilePath = path.join(this.configDirPath, 'config-change-time.json');
    this.mailsyncConfigFilePath = path.join(this.configDirPath, 'mailsync.json');
    this.settings = {};
    this.configChangeTime = {};

    this.initializeConfigDirectory();
    this.load();
  }

  initializeConfigDirectory() {
    if (!fs.existsSync(this.configDirPath)) {
      fs.makeTreeSync(this.configDirPath);
      const templateConfigDirPath = path.join(this.resourcePath, 'dot-nylas');
      fs.copySync(templateConfigDirPath, this.configDirPath);
    }

    try {
      let stat = fs.statSync(this.configDirPath);
      let configDirPathAccessMode = (stat.mode & parseInt('777', 8)).toString(8);
      if (configDirPathAccessMode !== '700') {
        fs.chmodSync(this.configDirPath, '700');
      }
    } catch (err) {
      // ignore
    }

    if (!fs.existsSync(this.configFilePath)) {
      this.writeTemplateConfigFile();
    }
    if (!fs.existsSync(this.configChangeTimeFilePath)) {
      this.writeTemplateConfigChangeTimeFile();
    }
  }

  writeTemplateConfigFile() {
    const templateConfigPath = path.join(this.resourcePath, 'dot-nylas', 'config.json');
    const templateConfig = fs.readFileSync(templateConfigPath);
    fs.writeFileSync(this.configFilePath, templateConfig);
  }

  writeTemplateConfigChangeTimeFile() {
    fs.writeFileSync(this.configChangeTimeFilePath, '{"*": {}}');
  }

  _showLoadErrorDialog(filePath, error) {
    const message = `Failed to load "${path.basename(filePath)}"`;
    let detail = error.message;

    if (error instanceof SyntaxError) {
      detail += `\n\nThe file ${filePath} has incorrect JSON formatting or is empty. Fix the formatting to resolve this error, or reset your settings to continue using N1.`;
    } else {
      detail += `\n\nWe were unable to read the file ${filePath}. Make sure you have permissions to access this file, and check that the file is not open or being edited and try again.`;
    }

    const clickedIndex = dialog.showMessageBoxSync({
      type: 'error',
      message,
      detail,
      buttons: ['Quit', 'Try Again', 'Reset Configuration'],
    });

    switch (clickedIndex) {
      case 0:
        return 'quit';
      case 1:
        return 'tryagain';
      case 2:
        return 'reset';
      default:
        throw new Error('Unknown button clicked');
    }
  }

  load() {
    this.userWantsToPreserveErrors = false;
    let progress = this.configFilePath;
    try {
      const configJson = JSON.parse(fs.readFileSync(this.configFilePath));
      if (!configJson || !configJson['*']) {
        throw new Error('config json appears empty');
      }

      this.settings = configJson['*'];

      progress = this.configChangeTimeFilePath;

      const configChangeJson = JSON.parse(fs.readFileSync(this.configChangeTimeFilePath));
      if (!configChangeJson || !configChangeJson['*']) {
        throw new Error('config change time json appears empty');
      }
      this.configChangeTime = configChangeJson['*'];

      progress = '';

      this.emitChangeEvent();
    } catch (error) {
      if (!progress) {
        return;
      }
      error.message = `Failed to load ${path.basename(progress)}: ${error.message}`;

      const action = this._showLoadErrorDialog(progress, error);
      if (action === 'quit') {
        this.userWantsToPreserveErrors = true;
        app.quit();
        return;
      }

      if (action === 'tryagain') {
        this.load();
        return;
      }

      if (action !== 'reset') {
        throw new Error(`Unknown action: ${action}`);
      }

      if (fs.existsSync(this.configFilePath)) {
        fs.unlinkSync(this.configFilePath);
      }
      if (fs.existsSync(this.configChangeTimeFilePath)) {
        fs.unlinkSync(this.configChangeTimeFilePath);
      }
      this.writeTemplateConfigFile();
      this.writeTemplateConfigChangeTimeFile();
      this.load();
    }
  }

  _showSaveErrorDialog(filePath) {
    const clickedIndex = dialog.showMessageBoxSync({
      type: 'error',
      message: `Failed to save "${path.basename(filePath)}"`,
      detail: `\n\nWe were unable to save the file ${filePath}. Make sure you have permissions to access this file, and check that the file is not open or being edited and try again.`,
      buttons: ['Okay', 'Try again'],
    });
    return ['ignore', 'retry'][clickedIndex];
  }

  save = () => {
    if (this.userWantsToPreserveErrors) {
      return;
    }
    const allSettings = { '*': this.settings };
    const allConfigChanges = { '*': this.configChangeTime };
    let mailsyncSettings = {};
    if (this.settings) {
      if (this.settings.core && this.settings.core.mailsync) {
        mailsyncSettings = this.settings.core.mailsync;
      }
      if (Array.isArray(this.settings.accounts)) {
        mailsyncSettings.accounts = {};
        for (let account of this.settings.accounts) {
          const settings = _.clone(account.mailsync ? account.mailsync : {});
          if (settings.copyToSent === undefined) {
            settings.copyToSent = !Utils.isAutoCopyToSent(account) ? 1 : 0;
          }
          mailsyncSettings.accounts[account.id || account.pid] = settings;
        }
      }
    }
    this.shouldSyncToNativeConfigs.forEach(keyPath => {
      const value = _.valueForKeyPath(this.settings, keyPath);
      mailsyncSettings[keyPath.replace(/\./g, '_')] = value;
    });
    const mailsyncSettingsJSON = JSON.stringify(mailsyncSettings, null, 2);
    const allSettingsJSON = JSON.stringify(allSettings, null, 2);
    const allConfigChangesJSON = JSON.stringify(allConfigChanges, null, 2);
    this.lastSaveTimestamp = Date.now();

    let progress = this.configFilePath;

    try {
      atomicWriteFileSync(this.configFilePath, allSettingsJSON);
      progress = this.configChangeTimeFilePath;
      atomicWriteFileSync(this.configChangeTimeFilePath, allConfigChangesJSON);
      progress = this.mailsyncConfigFilePath;
      atomicWriteFileSync(this.mailsyncConfigFilePath, mailsyncSettingsJSON);
      progress = '';
      this.saveRetries = 0;
    } catch (error) {
      if (!progress) {
        return;
      }
      if (this.saveRetries >= RETRY_SAVES) {
        error.message = `Failed to save ${path.basename(progress)}: ${error.message}`;
        const action = this._showSaveErrorDialog(progress);
        this.saveRetries = 0;

        if (action === 'retry') {
          this.save();
        }
        return;
      }

      this.saveRetries++;
      this.save();
    }
  };

  getRawValuesString = () => {
    if (!this.settings || _.isEmpty(this.settings)) {
      throw new Error('this.settings is empty');
    }
    return JSON.stringify(this.settings);
  };

  setSettings = (value, sourceWebcontentsId) => {
    this.settings = value;
    this.emitChangeEvent({ sourceWebcontentsId });
    this.save();
  };

  setRawValue = (keyPath, value, sourceWebcontentsId) => {
    if (!keyPath) {
      throw new Error('keyPath must not be false-y!');
    }
    _.setValueForKeyPath(this.settings, keyPath, value);
    this.emitChangeEvent({ sourceWebcontentsId });
    this.save();
  };

  bulkSetRawValue = (setList, sourceWebcontentsId) => {
    setList.forEach(({ keyPath, value }) => {
      if (!keyPath) {
        throw new Error('keyPath must not be false-y!');
      }
      _.setValueForKeyPath(this.settings, keyPath, value);
    });
    this.emitChangeEvent({ sourceWebcontentsId });
    this.save();
  };

  setShouldSyncToNativeConfigs = shouldSyncToNativeConfigs => {
    this.shouldSyncToNativeConfigs = shouldSyncToNativeConfigs;
    this.save();
  };

  getChangeTimeValue = keyPath => {
    const value = _.valueForKeyPath(this.configChangeTime, keyPath);
    return value;
  };

  setChangeTimeValue = (keyPath, changeTime) => {
    if (!keyPath) {
      throw new Error('keyPath must not be false-y!');
    }
    const oldValue = _.valueForKeyPath(this.configChangeTime, keyPath);
    if (typeof changeTime !== 'number' || changeTime === oldValue) {
      return;
    }
    _.setValueForKeyPath(this.configChangeTime, keyPath, changeTime);
    this.save();
  };

  bulkSetChangeTimeValue = setList => {
    setList.forEach(({ keyPath, time }) => {
      if (!keyPath) {
        throw new Error('keyPath must not be false-y!');
      }
      const oldValue = _.valueForKeyPath(this.configChangeTime, keyPath);
      if (typeof time !== 'number' || time === oldValue) {
        return;
      }
      _.setValueForKeyPath(this.configChangeTime, keyPath, time);
    });
    this.save();
  };

  emitChangeEvent = ({ sourceWebcontentsId } = {}) => {
    global.application.config.updateSettings(this.settings);

    BrowserWindow.getAllWindows().forEach(win => {
      if (win.webContents && win.webContents.id !== sourceWebcontentsId) {
        win.webContents.send('on-config-reloaded');
      }
    });
  };
}
