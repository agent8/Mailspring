/* eslint global-require: "off" */

import {
  BrowserWindow,
  Menu,
  app,
  ipcMain,
  dialog,
  systemPreferences,
  Notification,
  screen,
  globalShortcut,
} from 'electron';

import fs from 'fs-plus';
import url from 'url';
import path from 'path';
import glob from 'glob';
import proc from 'child_process';
import { EventEmitter } from 'events';
import _ from 'underscore';

import WindowManager from './window-manager';
import FileListCache from './file-list-cache';
import ConfigMigrator from './config-migrator';
import ApplicationMenu from './application-menu';
import ApplicationTouchBar from './application-touch-bar';
import AutoUpdateManager from './autoupdate-manager';
import SecurityScopedResource from './security-scoped-resource';
import SystemTrayManager from './system-tray-manager';
import MailspringProtocolHandler from './mailspring-protocol-handler';
import ConfigPersistenceManager from './config-persistence-manager';
import moveToApplications from './move-to-applications';
import MailsyncProcess from '../mailsync-process';
import EventTriggers from './event-triggers';
import { createHash } from 'crypto';
import { dataUpgrade } from './data-upgrade';

const LOG = require('electron-log');
const archiver = require('archiver');
let getOSInfo = null;
let getDeviceHash = null;
let clipboard = null;

// The application's singleton class.
//
const getStartOfDay = () => {
  const now = new Date();
  const startOfDay = new Date(now.toDateString());
  return startOfDay.getTime();
};
const logFileRetainThreshHoldInMs = 30 * 24 * 60 * 60 * 1000;
const logFileUploadThreshHoldInMs = 48 * 60 * 60 * 1000;
const isStag = version => {
  const verNumList = version.split('.');
  const lastVersionNum = Number(verNumList[verNumList.length - 1]);
  return !lastVersionNum || lastVersionNum % 2 === 1;
};
export default class Application extends EventEmitter {
  async start(options) {
    const {
      resourcePath,
      configDirPath,
      version,
      buildVersion,
      devMode,
      specMode,
      safeMode,
    } = options;
    //BrowserWindow.addDevToolsExtension('~/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi/3.4.2_0');
    // BrowserWindow.addDevToolsExtension('/Users/gtkrab/edisonSoftware/react_extension');
    //Normalize to make sure drive letter case is consistent on Windows
    this.resourcePath = resourcePath;
    this.configDirPath = configDirPath;
    this.version = version;
    this.buildVersion = buildVersion;
    this.devMode = devMode;
    this.specMode = specMode;
    this.safeMode = safeMode;
    this.nativeVersion = '';
    const stagHost = 'https://cp.stag.easilydo.cc';
    const prodHost = 'https://cp.edison.tech';
    this.isStag = isStag(this.version);
    this.edisonServerHost = this.isStag ? stagHost : prodHost;
    // this.edisonServerHost = ;
    this.startOfDay = getStartOfDay();
    this.refreshStartOfDay = _.throttle(this._refreshStartOfDay, 1000);
    this._triggerRefreshStartOfDayTimer = null;
    this._setStartOfDayTimeout();
    this.fileListCache = new FileListCache();
    this.mailspringProtocolHandler = new MailspringProtocolHandler({
      configDirPath,
      resourcePath,
      safeMode,
    });

    await dataUpgrade(configDirPath);

    const Config = require('../config');
    const config = new Config();
    this.config = config;
    this.configPersistenceManager = new ConfigPersistenceManager({ configDirPath, resourcePath });
    config.load();

    this.eventTriggers = new EventTriggers(configDirPath);

    this.configMigrator = new ConfigMigrator(this.config);
    this.configMigrator.migrate();

    let initializeInBackground = options.background;
    if (initializeInBackground === undefined) {
      initializeInBackground = false;
    }

    this.securityScopedResource = new SecurityScopedResource({ configDirPath });

    await this.oneTimeMoveToApplications();
    await this.oneTimeAddToDock();
    this.autoStartRestore();

    this.autoUpdateManager = new AutoUpdateManager(
      version,
      config,
      specMode,
      devMode,
      this.edisonServerHost
    );
    this._checkUpdateInfoForce();
    this.applicationMenu = new ApplicationMenu(version);
    this.windowManager = new WindowManager({
      resourcePath: this.resourcePath,
      configDirPath: this.configDirPath,
      config: this.config,
      devMode: this.devMode,
      specMode: this.specMode,
      safeMode: this.safeMode,
      initializeInBackground: initializeInBackground,
    });
    this.systemTrayManager = new SystemTrayManager(process.platform, this);
    if (process.platform === 'darwin') {
      this.touchBar = new ApplicationTouchBar(resourcePath);
    }

    this.setupJavaScriptArguments();
    this.setupAutoPlayPolicy();
    this.setupCrosssitePolicy();
    this.handleEvents();
    this.handleLaunchOptions(options);

    // add 'EdisonMail://' to LSSetDefaultHandlerForURLScheme
    app.setAsDefaultProtocolClient('edisonmail');

    this._draftsSendLater = {};

    if (app.dock) {
      const dockMenu = Menu.buildFromTemplate([
        {
          role: 'window',
          submenu: [
            {
              role: 'minimize',
            },
            {
              role: 'close',
            },
          ],
        },
      ]);

      app.dock.setMenu(dockMenu);
    }

    let logoPath = path.join(configDirPath, 'logo_cache');
    if (!fs.existsSync(logoPath)) {
      fs.mkdirSync(logoPath);
    }
    let avatarPath = path.join(configDirPath, 'chat_avatar_cache');
    if (!fs.existsSync(avatarPath)) {
      fs.mkdirSync(avatarPath);
    }
    this.makeLogFolders();
    this.initSupportInfo();
    this._fixMailsyncTaskDelayInconsistency();
    // subscribe event of dark mode change
    if (process.platform === 'darwin') {
      try {
        systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', () => {
          const mainWindow = this.getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send('system-theme-changed', systemPreferences.isDarkMode());
          }
        });
      } catch (err) {
        console.error('Error: systemPreferences.subscribeNotification', err);
      }
    }
    this.cleaningOldFilesTimer = null;
    this._triggerCleanOldLogs(true);
    try {
      const mailsync = new MailsyncProcess({
        ...options,
        disableThread: this.config.get('core.workspace.threadView') === false,
      });
      this.nativeVersion = await mailsync.migrate();
    } catch (err) {
      let message = null;
      let buttons = ['Quit'];
      if (err.toString().includes('ENOENT')) {
        message = `Edison Mail could find the mailsync process. If you're building Edison Mail from source, make sure mailsync.tar.gz has been downloaded and unpacked in your working copy.`;
      } else if (err.toString().includes('spawn')) {
        message = `Edison Mail could not spawn the mailsync process. ${err.toString()}`;
      } else {
        message = `We encountered a problem with your local email database. ${err.toString()}\n\nCheck that no other copies of Edison Mail are running and click Rebuild to reset your local cache.`;
        buttons = ['Quit', 'Rebuild'];
      }

      dialog.showMessageBox({ type: 'warning', buttons, message }).then(({ response }) => {
        if (response === 0) {
          app.quit();
        } else {
          this._deleteDatabase(() => {
            if (!process.mas) {
              app.relaunch();
            }
            app.quit();
          }, true);
        }
      });
      return;
    }
  }
  _setStartOfDayTimeout = () => {
    const nextStartOfDay = getStartOfDay() + 24 * 60 * 60 * 1000;
    const timeout = nextStartOfDay - Date.now();
    if (this._triggerRefreshStartOfDayTimer) {
      clearTimeout(this._triggerRefreshStartOfDayTimer);
      this._triggerRefreshStartOfDayTimer = null;
    }
    if (timeout > 0) {
      this._triggerRefreshStartOfDayTimer = setTimeout(this._triggerRefreshStartOfDay, timeout);
    } else {
      this._triggerRefreshStartOfDay();
    }
  };
  _triggerRefreshStartOfDay = () => {
    this._refreshStartOfDay();
    this._setStartOfDayTimeout();
  };
  _refreshStartOfDay = () => {
    const newStartOfDay = getStartOfDay();
    this.logDebug(`start of day ${newStartOfDay}`);
    if (this.startOfDay < newStartOfDay) {
      this.startOfDay = newStartOfDay;
      const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (main) {
        main.sendMessage('refresh-start-of-day', { startOfDay: this.startOfDay });
      }
    }
  };
  getOpenWindows() {
    return this.windowManager.getOpenWindows();
  }

  getNotification(options) {
    return new Notification(options);
  }

  getMainWindow() {
    const win = this.windowManager.get(WindowManager.MAIN_WINDOW);
    return win ? win.browserWindow : null;
  }

  getAllWindowDimensions() {
    return this.windowManager.getAllWindowDimensions();
  }

  isQuitting() {
    return this.quitting;
  }

  // Opens a new window based on the options provided.
  handleLaunchOptions(options) {
    const { specMode, pathsToOpen, urlsToOpen } = options;

    if (specMode) {
      const {
        resourcePath,
        specDirectory,
        specFilePattern,
        logFile,
        showSpecsInWindow,
        jUnitXmlPath,
      } = options;
      const exitWhenDone = true;
      this.runSpecs({
        exitWhenDone,
        showSpecsInWindow,
        resourcePath,
        specDirectory,
        specFilePattern,
        logFile,
        jUnitXmlPath,
      });
      return;
    }

    this.openWindowsForTokenState();

    if (pathsToOpen instanceof Array && pathsToOpen.length > 0) {
      this.openComposerWithFiles(pathsToOpen);
    }
    if (urlsToOpen instanceof Array) {
      for (const urlToOpen of urlsToOpen) {
        this.openUrl(urlToOpen);
      }
    }
  }
  reportError(
    error,
    extra = {},
    options = { grabLogs: false, noAppConfig: false, expandLog: true, noStackTrace: false }
  ) {
    if (options.grabLogs && !this.devMode) {
      this._grabLogAndReportLog(error, extra, options, 'error');
    } else {
      this._reportLog(error, extra, options, 'error');
    }
  }

  reportWarning(
    error,
    extra = {},
    options = { grabLogs: false, noAppConfig: false, expandLog: true, noStackTrace: false }
  ) {
    if (options.grabLogs && !this.devMode) {
      this._grabLogAndReportLog(error, extra, options, 'warning');
    } else {
      this._reportLog(error, extra, options, 'warning');
    }
  }
  reportLog(
    error,
    extra = {},
    options = { grabLogs: false, noAppConfig: false, expandLog: true, noStackTrace: false }
  ) {
    if (options.grabLogs && !this.devMode) {
      this._grabLogAndReportLog(error, extra, options, 'log');
    } else {
      this._reportLog(error, extra, options, 'log');
    }
  }

  _checkUpdateInfoForce = () => {
    const reCheckUndateInfoTime = 60 * 60 * 1000;
    this.autoUpdateManager.checkForce();
    setInterval(() => {
      this.autoUpdateManager.checkForce();
    }, reCheckUndateInfoTime);
  };

  _grabLogAndReportLog(error, extra, options, type = '') {
    this.grabLogs()
      .then(filename => {
        extra.files = [filename];
        this._reportLog(error, extra, options, type);
      })
      .catch(e => {
        extra.grabLogError = e;
        this._reportLog(error, extra, options, type);
      });
  }

  _reportLog(
    error,
    extra = {},
    { noAppConfig = false, expandLog = true, noStackTrace = false } = {},
    type = ''
  ) {
    extra = this._expandReportLog(extra, noAppConfig, expandLog);
    if (!extra.noUILog) {
      //We only log application log. Individual window log is written in AppEnv
      if (type.toLocaleLowerCase() === 'error') {
        this.logError(error);
      } else if (type.toLocaleLowerCase() === 'warning') {
        this.logWarning(error);
      } else {
        this.logDebug(error);
      }
      // And since data send from renderer is already stripProcessed we don't need to do it again here.
      try {
        if (noStackTrace) {
          error = undefined;
        } else {
          error = this._stripSensitiveData(error);
        }
        if (!!extra.errorData) {
          extra.errorData = this._stripSensitiveData(extra.errorData);
        }
      } catch (e) {
        console.log(e);
      }
    }
    ipcMain.emit('upload-to-report-server', {
      status: 'uploading',
      error: null,
      payload: { logID: extra.logID || '' },
    });
    if (type.toLocaleLowerCase() === 'error') {
      global.errorLogger.reportError(error, extra);
    } else if (type.toLocaleLowerCase() === 'warning') {
      global.errorLogger.reportWarning(error, extra);
    } else {
      global.errorLogger.reportLog(error, extra);
    }
  }
  _expandReportLog = (extra = {}, noAppConfig = false, expandLog = true) => {
    try {
      extra.native = this.nativeVersion;
      extra.mas = process.mas ? '1' : '0';
      if (expandLog) {
        getOSInfo = getOSInfo || require('../system-utils').getOSInfo;
        extra.osInfo = getOSInfo();
        extra.osLocale = app.getLocale();
        extra.appMetrics = JSON.stringify(app.getAppMetrics());
        if (!noAppConfig) {
          extra.appConfig = JSON.stringify(this.config.cloneForErrorLog());
        }
      }
      if (!!extra.errorData && typeof extra.errorData !== 'string') {
        extra.errorData = JSON.stringify(extra.errorData);
      }
    } catch (err) {
      // can happen when an error is thrown very early
      extra.pluginIds = [];
    }
    delete extra.noAppConfig;
    delete extra.noStackTrace;
    delete extra.expandLog;
    return extra;
  };
  _stripSensitiveData(str = '') {
    const _stripData = (key, strData) => {
      let leftStr = '"';
      let leftRegStr = leftStr;
      let rightStr = '"';
      let rightRegStr = rightStr;
      let reg = new RegExp(`"${key}(\\\\":\\\\"|":")(\\s|\\S)*?(","|"}|\\\\",\\\\"|\\\\"})`, 'g');
      if (
        key !== 'body' &&
        key !== 'subject' &&
        key !== 'snippet' &&
        key !== 'emailAddress' &&
        key !== 'imap_username' &&
        key !== 'imap_password' &&
        key !== 'smtp_username' &&
        key !== 'smtp_password' &&
        key !== 'access_token' &&
        key !== 'refresh_token'
      ) {
        leftRegStr = '\\[';
        rightRegStr = '\\]';
        reg = new RegExp(`"${key}":${leftRegStr}(\\s|\\S)*?${rightRegStr},"`, 'g');
      }

      return strData.replace(reg, (str, match) => {
        const hash = createHash('md5')
          .update(str.replace(`"${key}":${leftStr}`, '').replace(`${rightRegStr},"`, ''))
          .digest('hex');
        return `"${key}":${leftStr}${hash}${rightStr},"`;
      });
    };
    const sensitiveKeys = [
      'emailAddress',
      'imap_username',
      'imap_password',
      'smtp_username',
      'smtp_password',
      'access_token',
      'refresh_token',
      'body',
      'subject',
      'snippet',
      'to',
      'from',
      'cc',
      'bcc',
      'replyTo',
    ];
    const notString = typeof str !== 'string';
    if (notString) {
      str = str.toLocaleString();
    }
    for (let i = 0; i < sensitiveKeys.length; i++) {
      const key = sensitiveKeys[i];
      str = _stripData(key, str);
    }
    if (notString) {
      str = Error(str);
    }
    return str;
  }

  logError(log) {
    this._log(log, 'error');
  }

  logWarning(log) {
    this._log(log, 'warn');
  }

  logDebug(log) {
    this._log(log, 'debug');
  }

  logInfo(log) {
    this._log(log, 'info');
  }

  _log(message, logType = 'log') {
    if (this.devMode) {
      if (logType === 'error') {
        console.error(message);
      } else if (logType === 'warn') {
        console.warn(message);
      } else {
        console.log(message);
      }
    }
    let str = message;
    if (str && str.toLocaleString) {
      str = this._stripSensitiveData(str.toLocaleString());
    }
    LOG[logType](str);
  }

  grabLogs(fileName = '') {
    return new Promise((resolve, reject) => {
      const resourcePath = this.configDirPath;
      const logPath = path.dirname(LOG.transports.file.findLogPath());
      if (fileName === '') {
        fileName = Date.now();
      }
      const outputPath = path.join(resourcePath, 'upload-log', `logs-${fileName}.zip`);
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 }, // Sets the compression level.
      });
      const appendFiles = (dirPath, prefix = '') => {
        return new Promise((resolve, reject) => {
          const uploadFiles = [];
          const appendToArchive = () => {
            uploadFiles.forEach(fileObj => {
              if (fileObj.path && fileObj.fileName) {
                console.log(`appending file ${fileObj.fileName} to archive ${fileObj.path}`);
                archive.file(fileObj.path, { prefix, name: fileObj.fileName });
              }
            });
            resolve();
          };
          fs.readdir(dirPath, { encoding: 'utf8', withFileTypes: true }, (err, files) => {
            if (err) {
              console.log(err);
              return resolve();
            }
            console.log(`getting files data for ${dirPath}`);
            this._filterFilesOnThreshold({
              files,
              dirPath,
              threshHold: logFileUploadThreshHoldInMs,
              resultArray: uploadFiles,
              isNewerThan: true,
              onDone: appendToArchive,
            });
          });
        });
      };

      output.on('close', function() {
        console.log('\n--->\n' + archive.pointer() + ' total bytes\n');
        console.log('archiver has been finalized and the output file descriptor has closed.');
        resolve(outputPath);
      });
      output.on('end', function() {
        console.log('\n----->\nData has been drained');
        resolve(outputPath);
      });
      archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
          console.log(err);
        } else {
          output.close();
          console.log(err);
          reject(err);
        }
      });
      archive.on('error', function(err) {
        output.close();
        console.log(err);
        reject(err);
      });
      archive.pipe(output);
      Promise.all([
        appendFiles(logPath, 'uiLog'),
        appendFiles(path.join(resourcePath, 'ms-log'), 'nativeLog'),
        appendFiles(path.join(resourcePath, 'ms-crash'), 'nativeCrash'),
      ]).then(() => {
        console.log('finalize');
        archive.finalize();
      });
    });
  }

  processReportErrorEvent(params, level = 'error') {
    try {
      let errorParams;
      let extraParams;
      try {
        errorParams = JSON.parse(params.errorJSON || '{}');
        extraParams = JSON.parse(params.extraJSON || '{}');
      } catch (e) {
        errorParams = {};
        extraParams = {};
      }
      let err;
      if (typeof params.errorMessage === 'string') {
        err = new Error(params.errorMessage);
      } else if (typeof extraParams.message === 'string') {
        err = new Error(extraParams.message);
      } else if (extraParams.noStackTrace) {
        err = {};
      } else {
        err = new Error();
      }
      err = Object.assign(err, errorParams);
      if (level === 'error') {
        this.reportError(err, extraParams, {
          grabLogs: extraParams.grabLogs,
          noAppConfig: extraParams.noAppConfig,
          expandLog: extraParams.expandLog,
          noStackTrace: extraParams.noStackTrace,
        });
      } else if (level === 'warning') {
        this.reportWarning(err, extraParams, {
          grabLogs: extraParams.grabLogs,
          noAppConfig: extraParams.noAppConfig,
          expandLog: extraParams.expandLog,
          noStackTrace: extraParams.noStackTrace,
        });
      } else {
        this.reportLog(err, extraParams, {
          grabLogs: extraParams.grabLogs,
          noAppConfig: extraParams.noAppConfig,
          expandLog: extraParams.expandLog,
          noStackTrace: extraParams.noStackTrace,
        });
      }
    } catch (parseError) {
      console.error(parseError);
      global.errorLogger.reportError(parseError, {});
    }
  }

  initSupportInfo() {
    LOG.transports.file.file = path.join(
      this.configDirPath,
      'ui-log',
      `application-${Date.now()}.log`
    );
    LOG.transports.console.level = false;
    LOG.transports.file.maxSize = 20485760;
    //Call once so the cpu infos will not be 0 when we actually needed it.
    app.getAppMetrics();
    if (this.config) {
      this.config.set('core.support.native', this.nativeVersion);
    }
    if (!getDeviceHash) {
      getDeviceHash = require('../system-utils').getDeviceHash;
    }
    const deviceHash = this.config.get('core.support.id');
    if (!deviceHash || deviceHash === 'Unknown') {
      getDeviceHash()
        .then(id => {
          this.config.set('core.support.id', id);
        })
        .catch(e => {
          this.reportError(new Error('failed to init support id'));
          this.config.set('core.support.id', 'Unknown');
        });
    }
  }

  autoStartRestore() {
    return new Promise(resolve => {
      if (process.platform === 'darwin') {
        const openAtLogin = app.getLoginItemSettings().openAtLogin;
        if (!openAtLogin) {
          resolve();
          return;
        }
        app.setLoginItemSettings({ openAtLogin: false });
        setTimeout(() => {
          app.setLoginItemSettings({ openAtLogin });
        }, 2000);
      }
      resolve();
    });
  }

  async oneTimeMoveToApplications() {
    if (process.platform !== 'darwin') {
      return;
    }
    if (this.devMode || this.specMode) {
      return;
    }
    if (this.config.get('askedAboutAppMove')) {
      return;
    }
    this.config.set('askedAboutAppMove', true);
    moveToApplications();
  }

  async oneTimeAddToDock() {
    if (process.platform !== 'darwin') {
      return;
    }
    const addedToDock = this.config.get('addedToDock');
    const appPath = process.argv[0];
    if (!addedToDock && appPath.includes('/Applications/') && appPath.includes('.app/')) {
      const appBundlePath = appPath.split('.app/')[0];
      proc.exec(
        `defaults write com.apple.dock persistent-apps -array-add "<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>${appBundlePath}.app/</string><key>_CFURLStringType</key><integer>0</integer></dict></dict></dict>"`
      );
      this.config.set('addedToDock', true);
    }
  }

  // On Windows, removing a file can fail if a process still has it open. When
  // we close windows and log out, we need to wait for these processes to completely
  // exit and then delete the file. It's hard to tell when this happens, so we just
  // retry the deletion a few times.
  deleteFileWithRetry(filePath, callback = () => {}, retries = 5) {
    glob(filePath, (err, files) => {
      if (err) {
        return;
      }
      const shouldCallcb = () => {
        if (processed === total) {
          console.log('\nDeleteFileWithRetry Callback called');
          callback();
        } else {
          console.log('\nDeleteFileWithRetry Callback not called');
        }
      };
      const callbackWithRetry = err => {
        if (err && err.message.indexOf('no such file') === -1) {
          console.log(`File Error: ${err.message} - retrying in 150msec`);
          setTimeout(() => {
            this.deleteFileWithRetry(filePath, callback, retries - 1);
          }, 150);
        } else {
          processed++;
          shouldCallcb();
        }
      };
      const total = files.length;
      let processed = 0;
      if (!files || files.length === 0) {
        shouldCallcb();
        return;
      }
      for (let fileName of files) {
        if (!fs.existsSync(fileName)) {
          processed++;
          shouldCallcb();
          return;
        }

        if (retries > 0) {
          fs.unlink(fileName, callbackWithRetry);
        } else {
          fs.unlink(fileName, () => {
            processed++;
            shouldCallcb();
          });
        }
      }
    });
  }

  renameFileWithRetry(filePath, newPath, callback = () => {}, retries = 5) {
    const callbackWithRetry = err => {
      if (err && err.message.indexOf('no such file') === -1) {
        console.log(`File Error: ${err.message} - retrying in 150msec`);
        setTimeout(() => {
          this.renameFileWithRetry(filePath, newPath, callback, retries - 1);
        }, 150);
      } else {
        callback(null);
      }
    };

    if (!fs.existsSync(filePath)) {
      callback(null);
      return;
    }

    if (retries > 0) {
      fs.rename(filePath, newPath, callbackWithRetry);
    } else {
      fs.rename(filePath, newPath, callback);
    }
  }

  // Configures required javascript environment flags.
  setupJavaScriptArguments() {
    app.commandLine.appendSwitch('js-flags', '--harmony');
  }

  setupAutoPlayPolicy() {
    app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  }

  setupCrosssitePolicy() {
    // app.commandLine.appendSwitch('disable-site-isolation-trials');
  }

  openWindowsForTokenState() {
    // user may trigger this using the application menu / by focusing the app
    // before migration has completed and the config has been loaded.
    if (!this.config) return;

    const accounts = this.config.get('accounts');
    const hasAccount = accounts && accounts.length > 0;
    const hasIdentity = this.config.get('identity.id');
    const agree = this.config.get('agree');

    if (hasAccount && hasIdentity && agree) {
      this.windowManager.ensureWindow(WindowManager.MAIN_WINDOW);
    } else {
      this.windowManager.ensureWindow(WindowManager.ONBOARDING_WINDOW, {
        title: 'Welcome to EdisonMail',
      });
    }
  }

  ensureMainWindowVisible() {
    if (!this.config) {
      return;
    }
    const accounts = this.config.get('accounts');
    const hasAccount = accounts && accounts.length > 0;
    const hasIdentity = this.config.get('identity.id');
    const agree = this.config.get('agree');

    if (hasAccount && hasIdentity && agree) {
      const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (main && !main.isVisible() && !main.isMinimized()) {
        const focusedWindow = this.windowManager.focusedWindow();
        if (focusedWindow) {
          const bounds = focusedWindow.browserWindow.getBounds();
          const display = screen.getDisplayMatching(bounds);
          main.browserWindow.setPosition(display.bounds.x + 50, display.bounds.y + 50);
        }
        main.show();
      }
    }
  }
  _fixMailsyncTaskDelayInconsistency = () => {
    const taskDelay = this.config.get('core.mailsync.taskDelay');
    if (taskDelay !== undefined) {
      const accounts = this.config.get('accounts');
      if (Array.isArray(accounts)) {
        let changed = false;
        accounts.forEach(account => {
          if (account && account.mailsync && account.mailsync.taskDelay !== taskDelay) {
            changed = true;
            account.mailsync.taskDelay = taskDelay;
          }
        });
        if (changed) {
          this.config.set('accounts', accounts);
        }
      }
    }
  };
  _filterFilesOnThreshold = ({
    files = [],
    dirPath = '',
    threshHold,
    onDone = () => {},
    isOlderThan,
    isNewerThan,
    resultArray = [],
  } = {}) => {
    if (Array.isArray(files)) {
      const now = Date.now();
      const total = files.length;
      let processed = 0;
      files.forEach(dirent => {
        if (dirent.isFile()) {
          console.log(`log file name: ${dirent.name}`);
          const filePath = path.join(dirPath, dirent.name);
          fs.stat(filePath, (err, stats) => {
            processed++;
            if (!err) {
              console.log(
                `file ${dirent.name} last modified is ${stats.mtimeMs}, now is ${now}, threshhold ${threshHold}`
              );
              if (isOlderThan && now - stats.mtimeMs > threshHold) {
                resultArray.push({ path: filePath, stats, fileName: dirent.name });
              } else if (isNewerThan && now - stats.mtimeMs < threshHold) {
                resultArray.push({ path: filePath, stats, fileName: dirent.name });
              }
            }
            if (processed === total) {
              onDone();
            }
          });
        } else {
          processed++;
          if (processed === total) {
            onDone();
          }
        }
      });
    } else {
      onDone();
    }
  };

  _removeOldFiles = (files, dirPath, cleanAll = false) => {
    const removeList = [];
    const sortAndDelete = () => {
      console.log('sort and delete');
      removeList.sort((a, b) => {
        return a.stats.mtimeMs - b.stats.mtimeMs;
      });
      const maxDelete = cleanAll ? removeList.length : 10;
      removeList.slice(0, maxDelete).forEach(fileObj => {
        fs.unlink(fileObj.path, err => {
          if (err) {
            console.log(`Deleting ${fileObj.path} failed, ${err}`);
          } else {
            console.log(`Deleting ${fileObj.path} success`);
          }
        });
      });
    };
    this._filterFilesOnThreshold({
      files,
      dirPath,
      threshHold: logFileRetainThreshHoldInMs,
      resultArray: removeList,
      isOlderThan: true,
      onDone: sortAndDelete,
    });
  };
  _triggerCleanOldLogs = (initial = false) => {
    if (initial) {
      const initialTime = 3 * 60 * 1000;
      clearTimeout(this.cleaningOldFilesTimer);
      console.log('setting timeout for clearOldLogs');
      this.cleaningOldFilesTimer = setTimeout(this.clearOldLogs, initialTime);
      this._triggerCleanOldLogs();
    } else {
      const reoccurrenceTime = 4 * 60 * 60 * 1000;
      clearInterval(this.cleaningOldFilesTimer);
      console.log('setting interval for clearOldLogs');
      this.cleaningOldFilesTimer = setInterval(this.clearOldLogs, reoccurrenceTime);
    }
  };
  makeLogFolders = () => {
    fs.mkdirSync(path.join(this.configDirPath, 'ui-log'), { recursive: true });
    fs.mkdirSync(path.join(this.configDirPath, 'upload-log'), { recursive: true });
  };

  clearOldLogs = (cleanAll = false) => {
    const uiLogPath = path.join(this.configDirPath, 'ui-log');
    const uploadPath = path.join(this.configDirPath, 'upload-log');
    const nativeLogPath = path.join(this.configDirPath, 'ms-log');
    const clearLogs = path => {
      console.log(`###################cleaning old logs in ${path}`);
      fs.readdir(path, { encoding: 'utf8', withFileTypes: true }, (err, files) => {
        if (err) {
          console.log(err);
          return;
        }
        this._removeOldFiles(files, path, cleanAll);
      });
    };
    clearLogs(uploadPath);
    clearLogs(uiLogPath);
    clearLogs(nativeLogPath);
  };

  _resetDatabaseAndRelaunch = ({ errorMessage, source = 'Unknown' } = {}) => {
    if (this._resettingAndRelaunching) return;
    this._resettingAndRelaunching = true;
    let rebuild = false;
    const done = () => {
      if (!process.mas) {
        app.relaunch();
      } else {
        dialog.showMessageBoxSync({
          type: 'info',
          buttons: ['Okay'],
          message: 'Please restart Edison Mail manually.',
        });
      }
      app.quit();
    };
    if (errorMessage) {
      rebuild = true;
      dialog
        .showMessageBox({
          type: 'warning',
          buttons: ['Okay'],
          message: `We encountered a problem with your local email database. We will now attempt to rebuild it.`,
          detail: errorMessage,
        })
        .then(() => {
          console.log(`deleting databases and destroying all windows because of ${source}`);
          this.windowManager.destroyAllWindows();
          this._deleteDatabase(done, rebuild);
        });
      return;
    }
    console.log(`deleting databases and destroying all windows because of ${source}`);
    this.windowManager.destroyAllWindows();
    this._deleteDatabase(done, rebuild);
  };

  _relaunch = () => {
    if (this.isShown) {
      return;
    }
    this.isShown = true;
    dialog
      .showMessageBox({
        type: 'warning',
        buttons: ['Okay'],
        message: `We encountered a problem with your local email database. The app will relaunch.`,
        detail: '',
      })
      .then(() => {
        if (!process.mas) {
          app.relaunch();
        } else {
          dialog.showMessageBoxSync({
            type: 'info',
            buttons: ['Okay'],
            message: 'Please restart Edison Mail manually.',
          });
        }
        app.quit();
      });
  };

  _deleteDatabase = (callback, rebuild) => {
    this.deleteFileWithRetry(path.join(this.configDirPath, 'edisonmail.db*'), () => {
      console.log('\nedisonmail.db* deleted\n');
      this.deleteFileWithRetry(path.join(this.configDirPath, 'embody*'), () => {
        console.log('\nembody* deleted\n');
        this.deleteFileWithRetry(path.join(this.configDirPath, 'emdb_*'), () => {
          console.log('\nemdb_* deleted\n');
          // if (rebuild) {
          //   const dbPath = path.join(this.configDirPath, 'edisonmail.db');
          //   const newDbName = `edisonmail_backup_${new Date().getTime()}.db`;
          //   const newDbPath = path.join(this.configDirPath, newDbName);
          //   this.renameFileWithRetry(dbPath, newDbPath, () => {
          //     // repair the database
          //     if (process.platform === 'darwin') {
          //       const sqlPath = 'data.sql';
          //       execSync(`sqlite3 ${newDbName} .dump > ${sqlPath}`, {
          //         cwd: this.configDirPath,
          //       });
          //       execSync(`sed -i '' 's/ROLLBACK/COMMIT/g' ${sqlPath}`, {
          //         cwd: this.configDirPath,
          //       });
          //       execSync(`sqlite3 edisonmail.db < ${sqlPath}`, {
          //         cwd: this.configDirPath,
          //       });
          //       fs.unlink(path.join(this.configDirPath, sqlPath), () => { });
          //     } else {
          //       // TODO in windows
          //       console.warn('in this system does not implement yet');
          //     }
          //     callback();
          //   });
          // } else {
          this.deleteFileWithRetry(path.join(this.configDirPath, 'edisonsift.db*'), callback);
          // }
        });
      });
    });
  };

  // Registers basic application commands, non-idempotent.
  // Note: If these events are triggered while an application window is open, the window
  // needs to manually bubble them up to the Application instance via IPC or they won't be
  // handled. This happens in workspace-element.es6
  handleEvents() {
    this.on('application:switch-window', () => {
      this.windowManager.switchWindow();
    });

    this.on('application:run-all-specs', () => {
      const win = this.windowManager.focusedWindow();
      this.runSpecs({
        exitWhenDone: false,
        showSpecsInWindow: true,
        resourcePath: this.resourcePath,
        safeMode: win && win.safeMode,
      });
    });

    this.on('application:run-package-specs', () => {
      dialog
        .showOpenDialog({
          title: 'Choose a Package Directory',
          defaultPath: this.configDirPath,
          buttonLabel: 'Choose',
          properties: ['openDirectory'],
        })
        .then(({ canceled, filePaths }) => {
          if (canceled || !filePaths || filePaths.length === 0) {
            return;
          }
          this.runSpecs({
            exitWhenDone: false,
            showSpecsInWindow: true,
            resourcePath: this.resourcePath,
            specDirectory: filePaths[0],
          });
        });
    });

    this.on('application:reset-database', this._resetDatabaseAndRelaunch);

    this.on('application:window-relaunch', this._relaunch);

    this.on('application:quit', () => {
      app.quit();
    });

    this.on('application:inspect', ({ x, y, MailspringWindow }) => {
      const win = MailspringWindow || this.windowManager.focusedWindow();
      if (!win) {
        return;
      }
      win.browserWindow.inspectElement(x, y);
    });

    this.on('application:add-account', ({ existingAccountJSON } = {}) => {
      const onboarding = this.windowManager.get(WindowManager.ONBOARDING_WINDOW);
      if (onboarding) {
        onboarding.show();
        onboarding.focus();
      } else {
        this.windowManager.ensureWindow(WindowManager.ONBOARDING_WINDOW, {
          windowProps: { addingAccount: true, existingAccountJSON },
          title: '',
        });
      }
    });

    this.on('application:new-message', () => {
      const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (main) {
        main.sendMessage('new-message');
      }
    });

    this.on('application:new-conversation', () => {
      const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (main) {
        if (main.isMinimized()) {
          main.restore();
        }
        main.show();
        main.sendMessage('new-conversation');
      }
    });

    this.on('application:select-conversation', jid => {
      const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (main) {
        if (main.isMinimized()) {
          main.restore();
        }
        main.show();
        main.sendMessage('select-conversation', jid);
      }
    });

    this.on('application:send-feedback', () => {
      const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (mainWindow) {
        const feedbackAddress = 'mailsupport@edison.tech';
        mainWindow.sendMessage('composeFeedBack', {
          to: { email: feedbackAddress, name: 'Mac Feedback' },
          subject: '[Email-macOS] Feedback ',
        });
      }
    });

    this.on('application:send-share', (subject, body) => {
      const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (mainWindow) {
        mainWindow.sendMessage('composeInvite', {
          subject,
          body,
        });
      }
    });

    this.on('application:bug-report', () => {
      const bugReportWindow = this.windowManager.get(WindowManager.BUG_REPORT_WINDOW);
      if (bugReportWindow) {
        bugReportWindow.show();
        bugReportWindow.focus();
      } else {
        this.windowManager.ensureWindow(WindowManager.BUG_REPORT_WINDOW, { title: 'Bug Report' });
      }
    });

    this.on('application:view-privacy', () => {
      const helpUrl = 'http://www.edison.tech/privacy.html';
      require('electron').shell.openExternal(helpUrl);
    });

    this.on('application:view-terms', () => {
      const helpUrl = 'http://www.edison.tech/terms.html';
      require('electron').shell.openExternal(helpUrl);
    });
    this.on('application:view-help', () => {
      const helpUrl = 'https://mailsupport.edison.tech/';
      require('electron').shell.openExternal(helpUrl);
    });

    this.on('application:open-preferences', () => {
      const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (main) {
        if (main.isMinimized()) {
          main.restore();
        }
        main.show();
        main.sendMessage('open-preferences');
      }
    });

    this.on('application:show-main-window', () => {
      this.openWindowsForTokenState();
    });

    this.on('application:show-all-inbox', event => {
      this.openWindowsForTokenState();
      const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (main) {
        if (main.isMinimized()) {
          main.restore();
        }
        main.show();
        main.sendMessage('command', 'navigation:go-to-all-inbox');
      }
    });
    this.on('application:go-to-outbox', event => {
      this.openWindowsForTokenState();
      const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (main) {
        main.sendMessage('command', 'navigation:go-to-outbox');
      }
    });
    this.on('application:show-chat', event => {
      this.openWindowsForTokenState();
      const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (main) {
        if (main.isMinimized()) {
          main.restore();
        }
        main.show();
        main.sendMessage('command', 'navigation:go-to-chat');
      }
    });

    this.on('application:check-for-update', () => {
      console.log('checking for update');
      this.autoUpdateManager.check({ manuallyCheck: true });
    });
    this.on('application:ignore-update', () => {
      this.autoUpdateManager.ignoreUpdate();
    });
    this.on('application:start-download-update', () => {
      this.autoUpdateManager.downloadUpdate();
    });

    this.on('application:install-update', () => {
      this.quitting = true;
      this.windowManager.cleanupBeforeAppQuit();
      this.autoUpdateManager.install();
    });

    this.on('application:toggle-dev', () => {
      let args = process.argv.slice(1);
      if (args.includes('--dev')) {
        args = args.filter(a => a !== '--dev');
      } else {
        args.push('--dev');
      }
      app.relaunch({ args });
      app.quit();
    });

    if (process.platform === 'darwin') {
      this.on('application:about', () => {
        Menu.sendActionToFirstResponder('orderFrontStandardAboutPanel:');
      });
      this.on('application:bring-all-windows-to-front', () => {
        Menu.sendActionToFirstResponder('arrangeInFront:');
      });
      this.on('application:hide', () => {
        Menu.sendActionToFirstResponder('hide:');
      });
      this.on('application:hide-other-applications', () => {
        Menu.sendActionToFirstResponder('hideOtherApplications:');
      });
      this.on('application:minimize', () => {
        Menu.sendActionToFirstResponder('performMiniaturize:');
      });
      this.on('application:unhide-all-applications', () => {
        Menu.sendActionToFirstResponder('unhideAllApplications:');
      });
      this.on('application:zoom', () => {
        Menu.sendActionToFirstResponder('zoom:');
      });
    } else {
      this.on('application:minimize', () => {
        const win = this.windowManager.focusedWindow();
        if (win) {
          win.minimize();
        }
      });
      this.on('application:zoom', () => {
        const win = this.windowManager.focusedWindow();
        if (win) {
          win.maximize();
        }
      });
    }

    app.on('window-all-closed', () => {
      this.windowManager.quitWinLinuxIfNoWindows();
    });

    // Called before the app tries to close any windows.
    app.on('before-quit', () => {
      // Allow the main window to be closed.
      this.quitting = true;
      // Destroy hot windows so that they can't block the app from quitting.
      // (Electron will wait for them to finish loading before quitting.)
      this.windowManager.cleanupBeforeAppQuit();
      this.systemTrayManager.destroyTray();
    });

    let pathsToOpen = [];
    let pathsTimeout = null;
    app.on('open-file', (event, pathToOpen) => {
      event.preventDefault();

      // if the user drags many files onto the app, this method is called
      // back-to-back several times. collect all the files and then fire.
      pathsToOpen.push(pathToOpen);
      clearTimeout(pathsTimeout);
      pathsTimeout = setTimeout(() => {
        this.openComposerWithFiles(pathsToOpen);
        pathsToOpen = [];
      }, 250);
    });

    app.on('open-url', (event, urlToOpen) => {
      // if want to open thread by url, url should this format edisonmail://email/accountId/threadId/view
      let matchs = /\/email\/(.+)\/(.+)\/view$/g.exec(urlToOpen);
      if (matchs && matchs.length === 3) {
        const accountId = matchs[1];
        const threadId = matchs[2];
        const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
        mainWindow.sendMessage('popout-thread', {
          accountId,
          id: threadId,
        });
      } else if (/\/auth\/(.+)$/g.test(urlToOpen)) {
        const onboardingWindow = this.windowManager.get(WindowManager.ONBOARDING_WINDOW);
        matchs = /\/auth\/(.+)$/g.exec(urlToOpen);
        const url = decodeURIComponent(matchs[1]);
        if (onboardingWindow) {
          onboardingWindow.sendMessage('oauth-redirect-url', { url });
        }
      } else {
        this.openUrl(urlToOpen);
      }
      event.preventDefault();
    });
    app.on('browser-window-focus', (event, window) => {
      this.refreshStartOfDay();
      const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (main) {
        main.sendMessage('application-activate');
      }
    });

    // System Tray
    ipcMain.on('update-system-tray', (event, ...args) => {
      this.systemTrayManager.updateTraySettings(...args);
    });

    // This application can't read the config-schema
    // So should register the default value of 'core.workspace.systemTray'
    ipcMain.on('update-system-tray-enable', (event, ...args) => {
      this.systemTrayManager.updateSystemTrayEnable(...args);
    });

    // This application  can't read the config-schema
    // So should register the default value of 'core.workspace.enableChat'
    ipcMain.on('update-system-tray-chat-enable', (event, ...args) => {
      this.systemTrayManager.updateTrayChatEnable(...args);
    });

    ipcMain.on('update-system-tray-account-menu', (event, ...args) => {
      this.systemTrayManager.updateTrayAccountMenu(...args);
    });

    ipcMain.on('update-system-tray-conversation-menu', (event, ...args) => {
      this.systemTrayManager.updateTrayConversationMenu(...args);
    });

    ipcMain.on('update-system-tray-chat-unread-count', (event, ...args) => {
      this.systemTrayManager.updateTrayChatUnreadCount(...args);
    });

    ipcMain.on('send-later-manager', (event, action, messageId, delay, actionKey, threadId) => {
      const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (action === 'send-later') {
        if (this._draftsSendLater[messageId]) {
          clearTimeout(this._draftsSendLater[messageId]);
        }
        this._draftsSendLater[messageId] = setTimeout(() => {
          delete this._draftsSendLater[messageId];
          if (!mainWindow || !mainWindow.browserWindow.webContents) {
            return;
          }
          mainWindow.browserWindow.webContents.send('action-send-now', messageId, actionKey);
        }, delay);
      } else if (action === 'undo') {
        const timer = this._draftsSendLater[messageId];
        clearTimeout(timer);
        delete this._draftsSendLater[messageId];
        mainWindow.browserWindow.webContents.send('action-send-cancelled', messageId, actionKey);
        if (threadId) {
          const threadWindow = this.windowManager.get(`thread-${threadId}`);
          if (threadWindow && threadWindow.browserWindow.webContents) {
            threadWindow.browserWindow.webContents.send(
              'action-send-cancelled',
              messageId,
              actionKey
            );
          }
        }
      }
    });

    ipcMain.on('set-badge-value', (event, value) => {
      if (app.dock && app.dock.setBadge) {
        app.dock.setBadge(value);
      } else if (app.setBadgeCount) {
        app.setBadgeCount(value.length ? value.replace('+', '') / 1 : 0);
      }
    });
    ipcMain.on('mainProcess-sync-call', (event, data) => {
      // This was triggered by a sync call, make sure it's as fast as possible
      if (!data.channel || typeof data.channel !== 'string' || !data.options) {
        event.returnValue = '';
        return;
      }
      const channel = data.channel;
      const options = data.options;
      const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (mainWindow && mainWindow.browserWindow.webContents) {
        mainWindow.browserWindow.webContents.send(channel, options);
      }
      if (Array.isArray(options.threadIds)) {
        options.threadIds.forEach(threadId => {
          if (threadId) {
            const threadWindow = this.windowManager.get(`thread-${threadId}`);
            if (threadWindow && threadWindow.browserWindow.webContents) {
              threadWindow.browserWindow.webContents.send(channel, options);
            }
          }
        });
      }
      if (Array.isArray(options.headerMessageIds)) {
        options.headerMessageIds.forEach(headerMessageId => {
          if (headerMessageId) {
            const composerWindow = this.windowManager.get(`composer-${headerMessageId}`);
            if (composerWindow && composerWindow.browserWindow.webContents) {
              composerWindow.browserWindow.webContents.send(channel, options);
            }
          }
        });
      }
      event.returnValue = '';
    });
    ipcMain.on('draft-got-new-id', (event, options) => {
      // console.log('----------------------------------------------------');
      // console.log(`----------------draft got new id for ${options.oldHeaderMessageId}------------------`)
      // console.log('----------------------------------------------------');
      let additionalChannelParam = '';
      if (options.additionalChannelParam) {
        additionalChannelParam = `${options.additionalChannelParam}-`;
      }
      const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (mainWindow && mainWindow.browserWindow.webContents) {
        mainWindow.browserWindow.webContents.send(
          `${additionalChannelParam}draft-got-new-id`,
          options
        );
      }
      if (options.threadId) {
        const threadWindow = this.windowManager.get(`thread-${options.threadId}`);
        if (threadWindow && threadWindow.browserWindow.webContents) {
          threadWindow.browserWindow.webContents.send(
            `${additionalChannelParam}draft-got-new-id`,
            options
          );
        }
      }
      if (options.oldHeaderMessageId && options.newHeaderMessageId) {
        this.windowManager.replaceWindowsKey(
          `composer-${options.oldHeaderMessageId}`,
          `composer-${options.newHeaderMessageId}`
        );
        const composerWindow = this.windowManager.get(`composer-${options.newHeaderMessageId}`);
        if (composerWindow && composerWindow.browserWindow.webContents) {
          composerWindow.browserWindow.webContents.send(
            `${additionalChannelParam}draft-got-new-id`,
            options
          );
        } else {
          console.log(`draft got new id cannot find composer ${options.oldHeaderMessageId}`);
        }
      }
    });
    ipcMain.on('arp', (event, options) => {
      if (!options.arpType) {
        return;
      }
      const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (mainWindow && mainWindow.browserWindow.webContents) {
        mainWindow.browserWindow.webContents.send(`${options.arpType}-arp`, options);
      }
      if (options.threadId) {
        const threadWindow = this.windowManager.get(`thread-${options.threadId}`);
        if (threadWindow && threadWindow.browserWindow.webContents) {
          threadWindow.browserWindow.webContents.send(`${options.arpType}-arp`, options);
        }
      }
      if (options.headerMessageId) {
        const composerWindow = this.windowManager.get(`composer-${options.headerMessageId}`);
        if (composerWindow && composerWindow.browserWindow.webContents) {
          composerWindow.browserWindow.webContents.send(`${options.arpType}-arp`, options);
        }
      }
    });
    ipcMain.on('arp-reply', (event, options) => {
      if (!options.arpType) {
        return;
      }
      const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (mainWindow && mainWindow.browserWindow.webContents) {
        mainWindow.browserWindow.webContents.send(`${options.arpType}-arp-reply`, options);
      }
      if (options.threadId) {
        const threadWindow = this.windowManager.get(`thread-${options.threadId}`);
        if (threadWindow && threadWindow.browserWindow.webContents) {
          threadWindow.browserWindow.webContents.send(`${options.arpType}-arp-reply`, options);
        }
      }
      if (options.headerMessageId) {
        const composerWindow = this.windowManager.get(`composer-${options.headerMessageId}`);
        if (composerWindow && composerWindow.browserWindow.webContents) {
          composerWindow.browserWindow.webContents.send(`${options.arpType}-arp-reply`, options);
        }
      }
    });
    // ipcMain.on('draft-arp', (event, options) => {
    //   const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
    //   if (mainWindow && mainWindow.browserWindow.webContents) {
    //     mainWindow.browserWindow.webContents.send('draft-arp', options);
    //   }
    //   if (options.threadId) {
    //     const threadWindow = this.windowManager.get(`thread-${options.threadId}`);
    //     if (threadWindow && threadWindow.browserWindow.webContents) {
    //       threadWindow.browserWindow.webContents.send('draft-arp', options);
    //     }
    //   }
    //   if (options.headerMessageId) {
    //     const composerWindow = this.windowManager.get(`composer-${options.headerMessageId}`);
    //     if (composerWindow && composerWindow.browserWindow.webContents) {
    //       composerWindow.browserWindow.webContents.send('draft-arp', options);
    //     }
    //   }
    // });

    // ipcMain.on('draft-arp-reply', (event, options) => {
    //   const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
    //   if (mainWindow && mainWindow.browserWindow.webContents) {
    //     mainWindow.browserWindow.webContents.send('draft-arp-reply', options);
    //   }
    //   if (options.threadId) {
    //     const threadWindow = this.windowManager.get(`thread-${options.threadId}`);
    //     if (threadWindow && threadWindow.browserWindow.webContents) {
    //       threadWindow.browserWindow.webContents.send('draft-arp-reply', options);
    //     }
    //   }
    // });
    // ipcMain.on('draft-delete', (event, options) => {
    //   const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
    //   if (mainWindow && mainWindow.browserWindow.webContents) {
    //     mainWindow.browserWindow.webContents.send('draft-delete', options);
    //   }
    //   if (options.threadId) {
    //     const threadWindow = this.windowManager.get(`thread-${options.threadId}`);
    //     if (threadWindow && threadWindow.browserWindow.webContents) {
    //       threadWindow.browserWindow.webContents.send('draft-delete', options);
    //     }
    //   }
    // });
    ipcMain.on('update-window-key', (event, options) => {
      const win = options.oldKey ? this.windowManager.get(options.oldKey) : null;
      if (win) {
        if (options.newKey) {
          win.updateWindowKey(options.newKey);
        }
        const newOptions = options.newOptions;
        if (newOptions && newOptions.accountId) {
          win.updateAccountId(newOptions.accountId);
        }
      }
    });

    ipcMain.on('new-window', (event, options) => {
      const win = options.windowKey ? this.windowManager.get(options.windowKey) : null;
      if (win) {
        win.show();
        win.focus();
      } else {
        let additionalChannelParam = '';
        if (options.additionalChannelParam) {
          additionalChannelParam = `${options.additionalChannelParam}-`;
        }
        this.windowManager.newWindow(options);
        const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
        if (mainWindow && mainWindow.browserWindow.webContents) {
          mainWindow.browserWindow.webContents.send(`${additionalChannelParam}new-window`, options);
        }
        if (options.threadId) {
          const threadWindow = this.windowManager.get(`thread-${options.threadId}`);
          if (threadWindow && threadWindow.browserWindow.webContents) {
            threadWindow.browserWindow.webContents.send(
              `${additionalChannelParam}new-window`,
              options
            );
          }
        }
      }
    });

    ipcMain.on('close-window', (event, options) => {
      let additionalChannelParam = '';
      if (options.additionalChannelParam) {
        additionalChannelParam = `${options.additionalChannelParam}-`;
      }
      const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (mainWindow && mainWindow.browserWindow.webContents) {
        mainWindow.browserWindow.webContents.send(`${additionalChannelParam}close-window`, options);
      }
      if (options.threadId) {
        const threadWindow = this.windowManager.get(`thread-${options.threadId}`);
        if (threadWindow && threadWindow.browserWindow.webContents) {
          threadWindow.browserWindow.webContents.send(
            `${additionalChannelParam}close-window`,
            options
          );
        }
      }
    });
    ipcMain.on('mailsync-config', (event, options) => {
      const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (mainWindow && mainWindow.browserWindow.webContents) {
        mainWindow.browserWindow.webContents.send(`mailsync-config`, options);
      }
    });

    ipcMain.on('client-config', (event, options) => {
      const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (mainWindow && mainWindow.browserWindow.webContents) {
        mainWindow.browserWindow.webContents.send(`client-config`, options);
      }
    });

    // Theme Error Handling

    let userResetTheme = false;

    ipcMain.on('encountered-theme-error', (event, { message, detail }) => {
      if (userResetTheme) return;
      dialog
        .showMessageBox({
          type: 'warning',
          buttons: ['Reset Theme', 'Continue'],
          defaultId: 0,
          message,
          detail,
        })
        .then(({ response }) => {
          if (response === 0) {
            userResetTheme = true;
            this.config.set('core.theme', '');
          }
        });
    });

    ipcMain.on('inline-style-parse', (event, { html, key }) => {
      const juice = require('juice');
      let out = null;
      try {
        out = juice(html);
      } catch (e) {
        // If the juicer fails (because of malformed CSS or some other
        // reason), then just return the body. We will still push it
        // through the HTML sanitizer which will strip the style tags. Oh
        // well.
        out = html;
      }
      // win = BrowserWindow.fromWebContents(event.sender)
      event.sender.send('inline-styles-result', { html: out, key });
    });

    ipcMain.on('open-url', (event, url) => {
      require('electron').shell.openExternal(url);
    });

    app.on('activate', (event, hasVisibleWindows) => {
      if (!hasVisibleWindows) {
        this.openWindowsForTokenState();
      }
      this.ensureMainWindowVisible();
      this.refreshStartOfDay();
      const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (main) {
        main.sendMessage('application-activate');
      }
      event.preventDefault();
    });

    ipcMain.on('update-application-menu', (event, template, keystrokesByCommand) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      this.applicationMenu.update(win, template, keystrokesByCommand);
      if (win === this.getMainWindow() && process.platform === 'darwin') {
        this.touchBar.update(template);
      }
    });

    ipcMain.on('command', (event, command, ...args) => {
      this.emit(command, ...args);
    });

    ipcMain.on('window-command', (event, command, ...args) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      win.emit(command, ...args);
    });

    ipcMain.on('call-window-method', (event, method, ...args) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win[method]) {
        console.error(`Method ${method} does not exist on BrowserWindow!`);
      }
      win[method](...args);
    });

    ipcMain.on('call-devtools-webcontents-method', (event, method, ...args) => {
      // If devtools aren't open the `webContents::devToolsWebContents` will be null
      if (event.sender.devToolsWebContents) {
        event.sender.devToolsWebContents[method](...args);
      }
    });

    ipcMain.on('call-webcontents-method', (event, method, ...args) => {
      if (!event.sender[method]) {
        console.error(`Method ${method} does not exist on WebContents!`);
      }
      event.sender[method](...args);
    });

    ipcMain.on('mailsync-bridge-rebroadcast-to-all', (event, ...args) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      this.windowManager.sendToAllWindows('mailsync-bridge-message', { except: win }, ...args);
    });

    ipcMain.on('action-bridge-rebroadcast-to-all', (event, ...args) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      this.windowManager.sendToAllWindows('action-bridge-message', { except: win }, ...args);
    });

    ipcMain.on('action-bridge-rebroadcast-to-default', (event, ...args) => {
      const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (!mainWindow || !mainWindow.browserWindow.webContents) {
        return;
      }
      if (BrowserWindow.fromWebContents(event.sender) === mainWindow) {
        return;
      }
      mainWindow.browserWindow.webContents.send('action-bridge-message', ...args);
    });

    ipcMain.on('write-text-to-selection-clipboard', (event, selectedText) => {
      clipboard = require('electron').clipboard;
      clipboard.writeText(selectedText, 'selection');
    });

    ipcMain.on('account-setup-successful', () => {
      this.windowManager.ensureWindow(WindowManager.MAIN_WINDOW);
      const onboarding = this.windowManager.get(WindowManager.ONBOARDING_WINDOW);
      if (onboarding) {
        onboarding.close();
      }
    });

    ipcMain.on('open-main-window-make-onboarding-on-top', () => {
      this.windowManager.ensureWindow(WindowManager.MAIN_WINDOW, { hidden: true });
      const onboarding = this.windowManager.get(WindowManager.ONBOARDING_WINDOW);
      if (onboarding) {
        onboarding.focus();
      }
    });

    ipcMain.on('run-in-window', (event, params) => {
      const sourceWindow = BrowserWindow.fromWebContents(event.sender);
      this._sourceWindows = this._sourceWindows || {};
      this._sourceWindows[params.taskId] = sourceWindow;

      const targetWindowKey = {
        main: WindowManager.MAIN_WINDOW,
      }[params.window];
      if (!targetWindowKey) {
        throw new Error("We don't support running in that window");
      }

      const targetWindow = this.windowManager.get(targetWindowKey);
      if (!targetWindow || !targetWindow.browserWindow.webContents) {
        return;
      }
      targetWindow.browserWindow.webContents.send('run-in-window', params);
    });

    ipcMain.on('remote-run-results', (event, params) => {
      const sourceWindow = this._sourceWindows[params.taskId];
      sourceWindow.webContents.send('remote-run-results', params);
      delete this._sourceWindows[params.taskId];
    });

    ipcMain.on('report-error', (event, params = {}) => {
      console.log(`\n----\nreport-error\n`);
      this.processReportErrorEvent(params, 'error');
      event.returnValue = true;
    });
    ipcMain.on('report-warning', (event, params = {}) => {
      this.processReportErrorEvent(params, 'warning');
      event.returnValue = true;
    });
    ipcMain.on('report-log', (event, params = {}) => {
      this.processReportErrorEvent(params, 'log');
      event.returnValue = true;
    });
    ipcMain.on('grab-log', (event, params = {}) => {
      try {
      } catch (e) {
        console.error(e);
      } finally {
        event.returnValue = true;
      }
    });
    ipcMain.on('after-add-account', (event, account) => {
      const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (main) {
        main.sendMessage('after-add-account', account);
      }
    });
    ipcMain.on('upload-to-report-server', data => {
      const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (main) {
        main.sendMessage('upload-to-report-server', data);
      }
      const bugReportWindow = this.windowManager.get(WindowManager.BUG_REPORT_WINDOW);
      if (bugReportWindow) {
        bugReportWindow.sendMessage('upload-to-report-server', data);
      }
    });
  }

  // Public: Executes the given command.
  //
  // If it isn't handled globally, delegate to the currently focused window.
  // If there is no focused window (all the windows of the app are hidden),
  // fire the command to the main window. (This ensures that `application:`
  // commands, like Cmd-N work when no windows are visible.)
  //
  // command - The string representing the command.
  // args - The optional arguments to pass along.
  sendCommand(command, ...args) {
    if (this.emit(command, ...args)) {
      return;
    }
    const focusedWindow = this.windowManager.focusedWindow();
    if (focusedWindow) {
      focusedWindow.sendCommand(command, ...args);
    } else {
      if (this.sendCommandToFirstResponder(command)) {
        return;
      }

      const focusedBrowserWindow = BrowserWindow.getFocusedWindow();
      const mainWindow = this.windowManager.get(WindowManager.MAIN_WINDOW);
      if (focusedBrowserWindow) {
        switch (command) {
          case 'window:reload':
            focusedBrowserWindow.reload();
            break;
          case 'window:toggle-dev-tools':
            focusedBrowserWindow.toggleDevTools();
            break;
          case 'window:close':
            focusedBrowserWindow.close();
            break;
          default:
            break;
        }
      } else if (mainWindow) {
        mainWindow.sendCommand(command, ...args);
      }
    }
  }

  // Public: Executes the given command on the given window.
  //
  // command - The string representing the command.
  // MailspringWindow - The {MailspringWindow} to send the command to.
  // args - The optional arguments to pass along.
  sendCommandToWindow = (command, MailspringWindow, ...args) => {
    console.log('sendCommandToWindow');
    console.log(command);
    if (this.emit(command, ...args)) {
      return;
    }
    if (MailspringWindow) {
      MailspringWindow.sendCommand(command, ...args);
    } else {
      this.sendCommandToFirstResponder(command);
    }
  };

  // Translates the command into OS X action and sends it to application's first
  // responder.
  sendCommandToFirstResponder = command => {
    if (process.platform !== 'darwin') {
      return false;
    }

    const commandsToActions = {
      'core:undo': 'undo:',
      'core:redo': 'redo:',
      'core:copy': 'copy:',
      'core:cut': 'cut:',
      'core:paste': 'paste:',
      'core:select-all': 'selectAll:',
    };

    if (commandsToActions[command]) {
      Menu.sendActionToFirstResponder(commandsToActions[command]);
      return true;
    }
    return false;
  };

  // Open a mailto:// url.
  //
  openUrl(urlToOpen) {
    const parts = url.parse(urlToOpen);
    const main = this.windowManager.get(WindowManager.MAIN_WINDOW);

    if (!main) {
      console.log(`Ignoring URL - main window is not available, user may not be authed.`);
      return;
    }

    if (parts.protocol === 'mailto:') {
      main.sendMessage('mailto', urlToOpen);
    } else if (parts.protocol === 'edisonmail:') {
      if (parts.host === 'plugins') {
        main.sendMessage('changePluginStateFromUrl', urlToOpen);
      } else {
        main.sendMessage('openThreadFromWeb', urlToOpen);
      }
    } else {
      console.log(`Ignoring unknown URL type: ${urlToOpen}`);
    }
  }

  openComposerWithFiles(pathsToOpen) {
    const main = this.windowManager.get(WindowManager.MAIN_WINDOW);
    if (main) {
      main.sendMessage('mailfiles', pathsToOpen);
    }
  }

  // Opens up a new {MailspringWindow} to run specs within.
  //
  // options -
  //   :exitWhenDone - A Boolean that, if true, will close the window upon
  //                   completion and exit the app with the status code of
  //                   1 if the specs failed and 0 if they passed.
  //   :showSpecsInWindow - A Boolean that, if true, will run specs in a
  //                        window
  //   :resourcePath - The path to include specs from.
  //   :specPath - The directory to load specs from.
  //   :safeMode - A Boolean that, if true, won't run specs from <config-dir>/packages
  //               and <config-dir>/dev/packages, defaults to false.
  //   :jUnitXmlPath - The path to output jUnit XML reports to, if desired.
  runSpecs(specWindowOptionsArg) {
    const specWindowOptions = specWindowOptionsArg;
    let { resourcePath } = specWindowOptions;
    if (resourcePath !== this.resourcePath && !fs.existsSync(resourcePath)) {
      resourcePath = this.resourcePath;
    }

    let bootstrapScript = null;
    try {
      bootstrapScript = require.resolve(
        path.resolve(this.resourcePath, 'spec', 'spec-runner', 'spec-bootstrap')
      );
    } catch (error) {
      bootstrapScript = require.resolve(
        path.resolve(__dirname, '..', '..', 'spec', 'spec-runner', 'spec-bootstrap')
      );
    }

    // Important: Use .nylas-spec instead of .nylas-mail to avoid overwriting the
    // user's real email config!
    const configDirPath = path.join(app.getPath('home'), '.nylas-spec');

    specWindowOptions.resourcePath = resourcePath;
    specWindowOptions.configDirPath = configDirPath;
    specWindowOptions.bootstrapScript = bootstrapScript;

    this.windowManager.ensureWindow(WindowManager.SPEC_WINDOW, specWindowOptions);
  }
}
