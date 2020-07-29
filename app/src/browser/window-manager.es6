import _ from 'underscore';
import { app } from 'electron';
import WindowLauncher from './window-launcher';
import { MessageWindowSize, WindowTypes } from '../constant';

const MAIN_WINDOW = WindowTypes.MAIN_WINDOW;
const SPEC_WINDOW = WindowTypes.SPEC_WINDOW;
const ONBOARDING_WINDOW = WindowTypes.ONBOARDING_WINDOW;
const BUG_REPORT_WINDOW = WindowTypes.BUG_REPORT_WINDOW;
const MESSAGE_WINDOW = WindowTypes.MESSAGE_WINDOW;
const DIALOG_WINDOW = WindowTypes.DIALOG_WINDOW;

export default class WindowManager {
  constructor({
    devMode,
    safeMode,
    specMode,
    resourcePath,
    configDirPath,
    initializeInBackground,
    config,
  }) {
    this.initializeInBackground = initializeInBackground;
    this._windows = {};
    this._reserveWindowTracking = {};
    this._freeReservedWindowsTimer = null;

    const onCreatedHotWindow = win => {
      this._registerWindow(win);
      this._didCreateNewWindow(win);
    };
    this.windowLauncher = new WindowLauncher({
      devMode,
      safeMode,
      specMode,
      resourcePath,
      configDirPath,
      config,
      onCreatedHotWindow,
    });
  }
  _freeReservedWindows = () => {
    const types = Object.keys(this._reserveWindowTracking);
    types.forEach(type => {
      console.log(`extra free reserve window found, ${type}`);
      const keys = Object.keys(this._reserveWindowTracking[type]);
      let count = 0;
      keys.forEach(key => {
        console.log(
          `extra free reserve window found, ${type}:${key},count ${count}, ${this._reserveWindowTracking[type][key]} `
        );
        if (this._reserveWindowTracking[type][key]) {
          count = count + 1;
        }
        if (count > 2) {
          console.log(`extra free reserve window found, ${type}:${key}, destroying`);
          this.destroyWindow(key);
          delete this._reserveWindowTracking[type][key];
        }
      });
    });
    console.log(`Cleaning up reserve window complete`);
    this._freeReservedWindowsTimer = null;
  };
  _initiateFreeReservedWindows = () => {
    if (!this._freeReservedWindowsTimer) {
      this._freeReservedWindowsTimer = setTimeout(this._freeReservedWindows, 3000);
    }
  };

  get(windowKey) {
    return this._windows[windowKey];
  }
  findWindowsByAccountId(accountId) {
    if (!accountId) {
      accountId = 'all';
    }
    const ret = [];
    Object.values(this._windows).forEach(win => {
      if (win && win.accountId === accountId) {
        ret.push(win);
      }
    });
    return ret;
  }

  getOpenWindows(type = 'all') {
    const values = [];
    Object.keys(this._windows).forEach(key => {
      const win = this._windows[key];
      if (win.windowType !== WindowLauncher.EMPTY_WINDOW) {
        if (type === 'all' || win.windowType === type) {
          values.push(win);
        }
      }
    });

    const score = win => (win.loadSettings().mainWindow ? 1000 : win.browserWindow.id);

    return values.sort((a, b) => score(b) - score(a));
  }

  switchWindow = () => {
    const windows = this.getOpenWindows();
    if (windows.length <= 1) {
      return;
    }
    let focusedIdx = 0;
    for (let i = 0; i < windows.length; i++) {
      if (windows[i].isFocused()) {
        focusedIdx = i;
        break;
      }
    }
    let nextIdx = focusedIdx + 1;
    if (focusedIdx === windows.length - 1) {
      nextIdx = 0;
    }
    this.ensureWindow(windows[nextIdx].windowKey);
  };

  getOpenWindowCount(type = 'all') {
    return this.getOpenWindows(type).length;
  }

  getVisibleWindows(type = 'all') {
    const values = [];
    Object.keys(this._windows).forEach(key => {
      const win = this._windows[key];
      if (win.isVisible()) {
        if (type === 'all' || win.windowType === type) {
          values.push(win);
        }
      }
    });
    return values;
  }

  replaceWindowsKey(oldKey, newKey) {
    const win = this.get(oldKey);
    if (win) {
      win.updateWindowKey(newKey);
      this._didCreateNewWindow(win);
      this._windows[newKey] = win;
      delete this._windows[oldKey];
    }
  }

  getVisibleWindowCount(type = 'all') {
    return this.getVisibleWindows(type).length;
  }

  getAllWindowDimensions() {
    const dims = {};
    Object.keys(this._windows).forEach(key => {
      const win = this._windows[key];
      if (win.windowType !== WindowLauncher.EMPTY_WINDOW) {
        const { x, y, width, height } = win.browserWindow.getBounds();
        const maximized = win.browserWindow.isMaximized();
        const fullScreen = win.browserWindow.isFullScreen();
        dims[key] = { x, y, width, height, maximized, fullScreen };
      }
    });
    return dims;
  }

  newWindow(options = {}) {
    const win = this.windowLauncher.newWindow(options);
    const type = options.windowType;
    if (type && win) {
      const total = this.getOpenWindowCount(type);
      if (total > 1) {
        const positions = win.browserWindow.getPosition();
        const offset = Math.floor(Math.floor(0.5 - Math.random()) * (30 + Math.random() * 100));
        win.browserWindow.setPosition(positions[0] + offset, positions[1] + offset);
      }
    }
    const existingKey = this._registeredKeyForWindow(win);

    if (existingKey) {
      delete this._windows[existingKey];
    }
    this._registerWindow(win);

    if (!existingKey) {
      this._didCreateNewWindow(win);
    }

    return win;
  }
  newMessageWindow(options = {}) {
    options.windowType = MESSAGE_WINDOW;
    options.windowKey = MESSAGE_WINDOW;
    options.height = MessageWindowSize.height;
    options.width = MessageWindowSize.width;
    this.newHiddenReserveWindow(options);
  }
  newDialogWindow(options = {}) {
    options.windowType = DIALOG_WINDOW;
    options.windowKey = DIALOG_WINDOW;
    options.height = MessageWindowSize.height;
    options.width = MessageWindowSize.width;
    this.newHiddenReserveWindow(options);
  }

  newHiddenReserveWindow(options = {}) {
    options.coldStartOnly = true;
    const numOfWindows = this.getOpenWindowCount(options.windowType);
    options.windowKey = `${options.windowKey}-${numOfWindows}`;
    options.resizable = false;
    options.hidden = true;
    const win = this.newWindow(options);
    if (win && win.browserWindow) {
      win.browserWindow.hide();
    }
    if (!this._reserveWindowTracking[options.windowType]) {
      this._reserveWindowTracking[options.windowType] = {};
    }
    this._reserveWindowTracking[options.windowType][options.windowKey] = true;
  }
  getAvailableReserveWindow(type) {
    if (!this._reserveWindowTracking[type]) {
      return null;
    }
    const keys = Object.keys(this._reserveWindowTracking[type]);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i] && this._reserveWindowTracking[type][keys[i]]) {
        const win = this.get(keys[i]);
        if (!win) {
          delete this._reserveWindowTracking[type][keys[i]];
        } else {
          return win;
        }
      }
    }
    return null;
  }
  showReserveWindow(windowKey, windowType) {
    console.log(`windowKey ${windowKey}, ${windowType}`);
    const win = this.get(windowKey);
    if (win && win.browserWindow) {
      win.browserWindow.show();
      this._reserveWindowTracking[windowType][windowKey] = false;
      setTimeout(() => {
        if (win && win.browserWindow) {
          win.browserWindow.setOpacity(1);
        }
        if (windowType === MESSAGE_WINDOW) {
          this.ensureMessageWindowExists();
        } else if (windowType === DIALOG_WINDOW) {
          this.ensureDialogWindowExists();
        }
      }, 200);
    }
  }
  hideReserveWindow(key, type) {
    const win = this.get(key);
    if (win && win.browserWindow) {
      console.log(`hide ${key}, ${type}`);
      win.browserWindow.hide();
      win.browserWindow.setOpacity(0);
      this._reserveWindowTracking[type][key] = true;
      this._initiateFreeReservedWindows();
    }
  }

  _registerWindow = win => {
    if (!win.windowKey) {
      throw new Error('WindowManager: You must provide a windowKey');
    }

    if (this._windows[win.windowKey]) {
      throw new Error(
        `WindowManager: Attempting to register a new window for an existing windowKey (${win.windowKey}). Use 'get()' to retrieve the existing window instead.`
      );
    }

    this._windows[win.windowKey] = win;
  };

  _didCreateNewWindow = win => {
    win.browserWindow.on('closed', () => {
      delete this._windows[win.windowKey];
      if (this._reserveWindowTracking[win.windowType]) {
        delete this._reserveWindowTracking[win.windowType][win.windowKey];
      }
      this.quitWinLinuxIfNoWindows();
    });

    // Let the applicationMenu know that there's a new window available.
    // The applicationMenu automatically listens to the `closed` event of
    // the browserWindow to unregister itself
    global.application.applicationMenu.addWindow(win.browserWindow);
  };

  _registeredKeyForWindow = win => {
    for (const key of Object.keys(this._windows)) {
      const otherWin = this._windows[key];
      if (win === otherWin) {
        return key;
      }
    }
    return null;
  };
  ensureMessageWindowExists() {
    this.ensureReserveWindowAvailable(MESSAGE_WINDOW, {
      windowKey: MESSAGE_WINDOW,
      height: MessageWindowSize.height,
      width: MessageWindowSize.width,
    });
  }
  ensureDialogWindowExists() {
    this.ensureReserveWindowAvailable(DIALOG_WINDOW, {
      windowKey: DIALOG_WINDOW,
      height: MessageWindowSize.height,
      width: MessageWindowSize.width,
    });
  }
  ensureReserveWindowAvailable(windowType, extraOpts = {}) {
    const win = this.getAvailableReserveWindow(windowType);
    if (!win) {
      extraOpts.windowType = windowType;
      this.newHiddenReserveWindow(extraOpts);
    }
  }

  ensureWindow(windowKey, extraOpts) {
    const win = this._windows[windowKey];

    if (!win) {
      const w = this.newWindow(this._coreWindowOpts(windowKey, extraOpts));
      if (windowKey === WindowManager.BUG_REPORT_WINDOW) {
        w.show();
      }
      return;
    }

    if (win.loadSettings().hidden) {
      return;
    }

    if (win.isMinimized()) {
      win.restore();
      win.focus();
    } else if (!win.isVisible()) {
      win.showWhenLoaded();
    } else {
      win.focus();
    }
  }

  sendToAllWindows(msg, { except }, ...args) {
    for (const windowKey of Object.keys(this._windows)) {
      const win = this._windows[windowKey];
      if (win.browserWindow.isDestroyed()) {
        delete this._windows[windowKey];
        continue;
      }
      if (win.browserWindow === except) {
        continue;
      }
      if (!win.browserWindow.webContents) {
        continue;
      }
      if (win.windowType === WindowLauncher.EMPTY_WINDOW) {
        continue;
      }
      win.browserWindow.webContents.send(msg, ...args);
    }
  }
  destroyWindow(windowKey) {
    const win = this.get(windowKey);
    if (win && win.browserWindow) {
      win.browserWindow.destroy();
    }
    delete this._windows[windowKey];
  }

  destroyAllWindows() {
    this.windowLauncher.cleanupBeforeAppQuit();
    for (const windowKey of Object.keys(this._windows)) {
      this._windows[windowKey].browserWindow.destroy();
    }
    this._windows = {};
    this._reserveWindowTracking = {};
  }

  cleanupBeforeAppQuit() {
    this.windowLauncher.cleanupBeforeAppQuit();
  }

  quitWinLinuxIfNoWindows() {
    // Typically, Mailspring stays running in the background on all platforms,
    // since it has a status icon you can use to quit it.

    // However, on Windows and Linux we /do/ want to quit if the app is somehow
    // put into a state where there are no visible windows and the main window
    // doesn't exist.

    // This /shouldn't/ happen, but if it does, the only way for them to recover
    // would be to pull up the Task Manager. Ew.

    if (['win32', 'linux'].includes(process.platform)) {
      this.quitCheck =
        this.quitCheck ||
        _.debounce(() => {
          const visibleWindows = _.filter(this._windows, win => win.isVisible());
          const mainWindow = this.get(WindowManager.MAIN_WINDOW);
          const noMainWindowLoaded = !mainWindow || !mainWindow.isLoaded();
          if (visibleWindows.length === 0 && noMainWindowLoaded) {
            app.quit();
          }
        }, 25000);
      this.quitCheck();
    }
  }

  focusedWindow() {
    return _.find(this._windows, win => win.isFocused());
  }

  _coreWindowOpts(windowKey, extraOpts = {}) {
    const coreWinOpts = {};
    coreWinOpts[WindowManager.MAIN_WINDOW] = {
      windowKey: WindowManager.MAIN_WINDOW,
      windowType: WindowManager.MAIN_WINDOW,
      title: 'Message Viewer',
      toolbar: true,
      neverClose: true,
      bootstrapScript: require.resolve('../window-bootstrap'),
      mainWindow: true,
      width: 900, // Gets changed based on previous settings
      height: 670, // Gets changed based on previous settings
      initializeInBackground: this.initializeInBackground,
    };

    coreWinOpts[WindowManager.ONBOARDING_WINDOW] = {
      windowKey: WindowManager.ONBOARDING_WINDOW,
      windowType: WindowManager.ONBOARDING_WINDOW,
      title: 'Account Setup',
      // hidden: true, // Displayed by PageRouter::_initializeWindowSize
      hidden: false,
      frame: false, // Always false on Mac, explicitly set for Win & Linux
      toolbar: false,
      resizable: false,
      width: 685,
      height: 700,
      disableZoom: true,
    };
    coreWinOpts[WindowManager.BUG_REPORT_WINDOW] = {
      windowKey: WindowManager.BUG_REPORT_WINDOW,
      windowType: WindowManager.BUG_REPORT_WINDOW,
      title: 'Bug Report',
      name: 'Bug Report',
      // hidden: true, // Displayed by PageRouter::_initializeWindowSize
      hidden: false,
      frame: true, // Always false on Mac, explicitly set for Win & Linux
      toolbar: false,
      resizable: false,
      width: 685,
      height: 700,
    };
    coreWinOpts[WindowManager.MESSAGE_WINDOW] = {
      windowKey: WindowManager.MESSAGE_WINDOW,
      windowType: WindowManager.MESSAGE_WINDOW,
      title: 'Message Window',
      // hidden: true, // Displayed by PageRouter::_initializeWindowSize
      hidden: true,
      frame: false, // Always false on Mac, explicitly set for Win & Linux
      toolbar: false,
      resizable: false,
      disableZoom: true,
    };

    // The SPEC_WINDOW gets passed its own bootstrapScript
    coreWinOpts[WindowManager.SPEC_WINDOW] = {
      windowKey: WindowManager.SPEC_WINDOW,
      windowType: WindowManager.SPEC_WINDOW,
      title: 'Specs',
      frame: true,
      hidden: true,
      isSpec: true,
      devMode: true,
      toolbar: false,
    };

    const defaultOptions = coreWinOpts[windowKey] || {};

    return Object.assign({}, defaultOptions, extraOpts);
  }
}

WindowManager.MAIN_WINDOW = MAIN_WINDOW;
WindowManager.SPEC_WINDOW = SPEC_WINDOW;
WindowManager.ONBOARDING_WINDOW = ONBOARDING_WINDOW;
WindowManager.BUG_REPORT_WINDOW = BUG_REPORT_WINDOW;
WindowManager.MESSAGE_WINDOW = MESSAGE_WINDOW;
WindowManager.DIALOG_WINDOW = DIALOG_WINDOW;
