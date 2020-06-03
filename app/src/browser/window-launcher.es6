import MailspringWindow from './mailspring-window';

const BG_COLOR_POPOUT = '#1e1e1f';
const BG_COLOR_MAIN_WINDOW = '#111112';
const DEBUG_SHOW_HOT_WINDOW = process.env.SHOW_HOT_WINDOW || false;
let winNum = 0;

/**
 * It takes a full second or more to bootup a Nylas window. Most of this
 * is due to sheer amount of time it takes to parse all of the javascript
 * and follow the require tree.
 *
 * Since popout windows need to be more responsive than that, we pre-load
 * "hot" windows in the background that have most of the code loaded. Then
 * all we need to do is load the handful of packages the window
 * requires and show it.
 */
export default class WindowLauncher {
  static EMPTY_WINDOW = 'emptyWindow';

  constructor({
    devMode,
    safeMode,
    specMode,
    resourcePath,
    configDirPath,
    onCreatedHotWindow,
    config,
  }) {
    this.defaultWindowOpts = {
      frame: process.platform !== 'darwin',
      toolbar: process.platform !== 'linux',
      hidden: false,
      devMode,
      safeMode,
      resizable: true,
      windowType: WindowLauncher.EMPTY_WINDOW,
      bootstrapScript: require.resolve('../secondary-window-bootstrap'),
      resourcePath,
      configDirPath,
      width: 880,
    };
    this.config = config;
    this.onCreatedHotWindow = onCreatedHotWindow;
    if (specMode) return;
    this.createHotWindow();
  }

  newWindow(options) {
    const opts = Object.assign({}, this.defaultWindowOpts, options);
    // if dark mode, window's bgColor is black
    const isDarkMode = this.config.get('core.theme') === 'ui-dark';
    if (isDarkMode) {
      opts.backgroundColor = BG_COLOR_MAIN_WINDOW;
    }

    // apply optional Linux properties
    if (process.platform === 'linux') {
      const style = this.config.get('core.workspace.menubarStyle');
      if (style === 'autohide') {
        opts.autoHideMenuBar = true;
      }
      if (style === 'hamburger' && opts.frame) {
        opts.toolbar = true;
        opts.frame = false;
      }
    }

    let win;
    if (this._mustUseColdWindow(opts)) {
      win = new MailspringWindow(opts);
    } else {
      // Check if the hot window has been deleted. This may happen when we are
      // relaunching the app
      if (!this.hotWindow) {
        this.createHotWindow(opts);
      }
      win = this.hotWindow;
      win.updateAccountId(opts.accountId);
      const newLoadSettings = Object.assign({}, win.loadSettings(), opts);
      if (newLoadSettings.windowType === WindowLauncher.EMPTY_WINDOW) {
        throw new Error('Must specify a windowType');
      }

      // Reset the loaded state and update the load settings.
      // This will fire `AppEnv::populateHotWindow` and reload the
      // packages.
      win.windowKey = opts.windowKey || `${opts.windowType}-${winNum}`;
      winNum += 1;
      win.windowType = opts.windowType;

      if (options.bounds) {
        win.browserWindow.setBounds(options.bounds);
      }
      if (options.width && options.height) {
        win.browserWindow.setSize(options.width, options.height);
      }

      win.setLoadSettings(newLoadSettings);

      setTimeout(() => {
        // We need to regen a hot window, but do it in the next event
        // loop to not hang the opening of the current window.
        const newOpts = Object.assign({}, opts, { title: '' });
        this.createHotWindow(newOpts);
      }, 0);
    }

    if (!opts.hidden && !opts.initializeInBackground) {
      // NOTE: In the case of a cold window, this will show it once
      // loaded. If it's a hotWindow, since hotWindows have a
      // `hidden:true` flag, nothing will show. When `setLoadSettings`
      // starts populating the window in `populateHotWindow` we'll show or
      // hide based on the windowOpts
      win.showWhenLoaded();
    }
    return win;
  }

  createHotWindow(options = {}) {
    const opts = this._hotWindowOpts(options.title);
    // if dark mode, set bgColor black
    const isDarkMode = this.config.get('core.theme') === 'ui-dark';
    if (isDarkMode) {
      opts.backgroundColor = BG_COLOR_POPOUT;
    }
    this.hotWindow = new MailspringWindow(opts);
    this.onCreatedHotWindow(this.hotWindow);
    if (DEBUG_SHOW_HOT_WINDOW) {
      this.hotWindow.showWhenLoaded();
    }
  }

  // Note: This method calls `browserWindow.destroy()` which closes
  // windows without waiting for them to load or firing window lifecycle
  // events.  This is necessary for the app to quit promptly on Linux.
  // https://phab.nylas.com/T1282
  cleanupBeforeAppQuit() {
    if (this.hotWindow != null) {
      this.hotWindow.browserWindow.destroy();
    }
    this.hotWindow = null;
  }

  // Some properties, like the `frame` or `toolbar` can't be updated once
  // a window has been setup. If we detect this case we have to bootup a
  // plain MailspringWindow instead of using a hot window.
  _mustUseColdWindow(opts) {
    const { bootstrapScript, frame } = this.defaultWindowOpts;

    const usesOtherBootstrap = opts.bootstrapScript !== bootstrapScript;
    const usesOtherFrame = !!opts.frame !== frame;
    const requestsColdStart = opts.coldStartOnly;

    return usesOtherBootstrap || usesOtherFrame || requestsColdStart;
  }

  _hotWindowOpts(title = null) {
    const hotWindowOpts = Object.assign({}, { title: title }, this.defaultWindowOpts);
    hotWindowOpts.hidden = DEBUG_SHOW_HOT_WINDOW;
    return hotWindowOpts;
  }
}
