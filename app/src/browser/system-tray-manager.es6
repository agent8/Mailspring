import { Tray, Menu, nativeImage } from 'electron';

const TrayMaxStringLen = 19;

function _getTooltip(unreadString) {
  return unreadString ? `${unreadString} unread messages` : '';
}

function _getIcon(iconPath, isTemplateImg) {
  if (!iconPath) {
    return nativeImage.createEmpty();
  }
  const icon = nativeImage.createFromPath(iconPath);
  // if (isTemplateImg) {
  icon.setTemplateImage(true);
  // }
  return icon;
}

class SystemTrayManager {
  constructor(platform, application) {
    this._platform = platform;
    this._application = application;
    this._iconPath = null;
    this._iconChatPath = null;
    this._unreadString = null;
    this._tray = null;
    this._accountTemplates = [];
    this._conversationTemplates = [];
    this._enableSystemTray = false;
    this._enableChat = false;

    this._application.config.onDidChange('core.workspace.systemTray', ({ newValue }) => {
      this.updateSystemTrayEnable(newValue);
    });

    this._application.config.onDidChange('core.workspace.enableChat', ({ newValue }) => {
      this.updateTrayChatEnable(newValue);
    });
  }

  initTray() {
    const created = this._tray !== null;
    const accounts = this._application.config.get('accounts');
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return;
    }
    this._accountTemplates = this._formatAccountTemplates(accounts);
    if (this._enableSystemTray && !created) {
      this._tray = new Tray(_getIcon(this._iconPath));
      this._tray.setToolTip(_getTooltip(this._unreadString));
      this._tray.addListener('click', this._onClick);
      this._tray.setContextMenu(Menu.buildFromTemplate(this._getMenuTemplate()));
    }
  }

  _onClick = () => {
    if (this._platform !== 'darwin') {
      if (this._application.windowManager.getVisibleWindowCount() === 0) {
        this._application.emit('application:show-main-window');
      } else {
        const visibleWindows = this._application.windowManager.getVisibleWindows();
        visibleWindows.forEach(window => window.hide());
      }
    }
  };

  _onChatClick = () => {
    this._application.emit('application:show-chat');
  };

  updateTraySettings(iconPath, unreadString, isTemplateImg) {
    this.initTray();
    if (this._iconPath !== iconPath) {
      this._iconPath = iconPath;
      if (this._tray) {
        this._tray.setImage(_getIcon(this._iconPath, isTemplateImg));
      }
    }
    if (this._unreadString !== unreadString) {
      this._unreadString = unreadString;
      const formatedCount = this._formatCount(this._formatCount(unreadString));
      if (this._tray) this._tray.setToolTip(_getTooltip(formatedCount));
      if (this._tray) this._tray.setTitle(formatedCount);
    }
  }

  updateSystemTrayEnable = enable => {
    this._enableSystemTray = enable;

    if (enable === false) {
      this.destroyTray();
    } else {
      this.initTray();
    }
  };

  updateTrayChatEnable = enable => {
    this._enableChat = enable;
    this._updateTrayMenu();
  };

  updateTrayAccountMenu = () => {
    const accounts = this._application.config.get('accounts') || [];
    this._accountTemplates = this._formatAccountTemplates(accounts);
    this._updateTrayMenu();
  };

  updateTrayConversationMenu = conversations => {
    this._conversationTemplates = this._formatConversationTemplates(conversations);
    this._updateTrayMenu();
  };

  _updateTrayMenu = () => {
    const newTemplate = this._getMenuTemplate();
    if (this._tray) {
      this._tray.setContextMenu(Menu.buildFromTemplate(newTemplate));
    }
  };

  updateTrayChatUnreadCount(count) {
    if (count !== undefined) {
      count = this._formatCount(count);
      this.unread = count;
      if (this._trayChat) {
        this._trayChat.setTitle(count);
      }
    }
  }

  _getMenuTemplate() {
    // the template for account list
    const templateAccount = [...this._accountTemplates];

    // the template for chat group list
    const templateChat = [];

    // the template for new mail and new chat group
    const templateNewMail = [
      {
        type: 'separator',
      },
      {
        label: 'Compose Email',
        click: () => this._application.emit('application:new-message'),
      },
    ];

    // the template for system
    const templateSystem = [
      {
        type: 'separator',
      },
      {
        label: 'Preferences',
        click: () => this._application.emit('application:open-preferences'),
      },
      {
        type: 'separator',
      },
      {
        label: 'Quit EdisonMail',
        click: () => {
          //DC-256 let tray.mouse-leave event fire before triggering app quit
          //otherwise it'll cause electron to crash
          setTimeout(() => {
            this._application.emit('application:quit');
          }, 200);
        },
      },
    ];

    if (this._platform !== 'win32') {
      templateAccount.unshift({
        label: 'All Inboxes',
        click: () => this._application.emit('application:show-all-inbox'),
      });
    }

    if (this._enableChat) {
      templateChat.push(
        {
          type: 'separator',
        },
        ...this._conversationTemplates
      );
      templateNewMail.push({
        label: 'New Message',
        click: () => this._application.emit('application:new-conversation'),
      });
    }

    return [...templateAccount, ...templateChat, ...templateNewMail, ...templateSystem];
  }

  _formatAccountTemplates(accounts) {
    const multiAccount = accounts.length > 1;

    const accountTemplate = accounts
      .filter(account => account.label)
      .map((account, idx) => {
        const label =
          account.label && account.label.length > TrayMaxStringLen
            ? account.label.substr(0, TrayMaxStringLen - 1) + '...'
            : account.label;
        return {
          label,
          click: () =>
            this._application.sendCommand(`window:select-account-${multiAccount ? idx + 1 : idx}`),
        };
      });
    return accountTemplate;
  }

  _formatConversationTemplates(conversations) {
    const conversationTemplates = conversations
      .filter(conv => conv.name && conv.unreadMessages)
      .map(conv => {
        const unreadCount = conv.unreadMessages > 99 ? ' (99+)' : ` (${conv.unreadMessages})`;
        const maxLength = TrayMaxStringLen - unreadCount.length;
        const label =
          conv.name && conv.name.length > maxLength
            ? conv.name.substr(0, maxLength - 1) + '...' + unreadCount
            : conv.name + unreadCount;
        return {
          label,
          click: () => this._application.emit('application:select-conversation', conv.jid),
        };
      });
    return conversationTemplates;
  }

  _formatCount = count => {
    if (count !== undefined) {
      if (count > 99) {
        count = '99+';
      } else if (count === 0) {
        count = '';
      } else {
        count = count + '';
      }
    }
    return count;
  };

  destroyTray() {
    if (this._tray) {
      this._tray.removeListener('click', this._onClick);
      this._tray.destroy();
      this._tray = null;
    }
  }
}

export default SystemTrayManager;
