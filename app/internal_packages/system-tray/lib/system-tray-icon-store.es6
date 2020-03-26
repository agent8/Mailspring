import path from 'path';
import { ipcRenderer } from 'electron';
import { BadgeStore } from 'mailspring-exports';

// Must be absolute real system path
// https://github.com/atom/electron/issues/1299
const { platform } = process;
const INBOX_ZERO_ICON = path.join(__dirname, '..', 'assets', platform, 'MenuItem-Inbox-Zero.png');
const INBOX_UNREAD_ICON = path.join(__dirname, '..', 'assets', platform, 'MenuItem-Inbox-Full.png');
const TRAY_CHAT_ICON = path.join(__dirname, '..', 'assets', platform, 'MenuItem-Chat.png');
const INBOX_UNREAD_ALT_ICON = path.join(
  __dirname,
  '..',
  'assets',
  platform,
  'MenuItem-Inbox-Full-NewItems.png'
);

class SystemTrayIconStore {
  static INBOX_ZERO_ICON = INBOX_ZERO_ICON;

  static INBOX_UNREAD_ICON = INBOX_UNREAD_ICON;

  static INBOX_UNREAD_ALT_ICON = INBOX_UNREAD_ALT_ICON;

  constructor() {
    this._windowBlurred = false;
    // application can't read the config-schema
    // So should register the default value of 'core.workspace.systemTray'
    // at the first time of tray loading
    const systemTrayEnable = AppEnv.config.get(`core.workspace.systemTray`);
    ipcRenderer.send('update-system-tray-enable', systemTrayEnable);
  }

  activate() {
    setTimeout(() => {
      this._updateIcon();
    }, 2000);
    this._unsubscribers = [];
    this._unsubscribers.push(BadgeStore.listen(this._updateIcon));

    window.addEventListener('browser-window-blur', this._onWindowBlur);
    window.addEventListener('browser-window-focus', this._onWindowFocus);
    this._unsubscribers.push(() =>
      window.removeEventListener('browser-window-blur', this._onWindowBlur)
    );
    this._unsubscribers.push(() =>
      window.removeEventListener('browser-window-focus', this._onWindowFocus)
    );
  }

  deactivate() {
    this._unsubscribers.forEach(unsub => unsub());
  }

  _getIconImageData(isInboxZero, isWindowBlurred) {
    if (isInboxZero) {
      return { iconPath: INBOX_ZERO_ICON, isTemplateImg: true, chatIconPath: TRAY_CHAT_ICON };
    }
    return isWindowBlurred
      ? { iconPath: INBOX_UNREAD_ALT_ICON, isTemplateImg: false, chatIconPath: TRAY_CHAT_ICON }
      : { iconPath: INBOX_UNREAD_ICON, isTemplateImg: true, chatIconPath: TRAY_CHAT_ICON };
  }

  _onWindowBlur = () => {
    // Set state to blurred, but don't trigger a change. The icon should only be
    // updated when the count changes
    this._windowBlurred = true;
  };

  _onWindowFocus = () => {
    // Make sure that as long as the window is focused we never use the alt icon
    this._windowBlurred = false;
    this._updateIcon();
  };

  _updateIcon = () => {
    const unread = BadgeStore.unread();
    const unreadString = (+unread).toLocaleString();
    const isInboxZero = BadgeStore.total() === 0;
    const { iconPath, isTemplateImg, chatIconPath } = this._getIconImageData(
      isInboxZero,
      this._windowBlurred
    );
    ipcRenderer.send('update-system-tray', iconPath, unreadString, isTemplateImg, chatIconPath);
  };
}

export default SystemTrayIconStore;
