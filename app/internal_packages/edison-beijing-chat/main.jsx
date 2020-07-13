import { ipcRenderer } from 'electron';
import { LocalStorage } from 'chat-exports';
import { AppStore } from 'chat-exports';
import startXmpp from './xmpp/startXmpp';
import xmpp from './xmpp';
import Mousetrap from 'mousetrap';
import bindMousetrap from './shortcuts/bindMousetrap';
const { ComponentRegistry, WorkspaceStore } = require('mailspring-exports');
let ChatButton;
let ChatView;
let NewConversation;
let ChatViewLeft;
let ChatAccountSidebarFiller;

const osLocale = require('os-locale');

const CHAT_COUNTRIES = ['CN'];
function isChatTestUser() {
  // let locale = osLocale.sync();
  // if (locale.indexOf('_') !== -1) {
  //   locale = locale.split('_')[1];
  // }
  // return CHAT_COUNTRIES.indexOf(locale) !== -1;
  return true;
}

const isChatTest = isChatTestUser();

module.exports = {
  activate() {
    // application can't read the config-schema
    // So should register the default value of 'core.workspace.enableChat'
    // at the first time of chat loading
    const chatEnable = AppEnv.config.get(`core.workspace.enableChat`);
    ipcRenderer.send('update-system-tray-chat-enable', chatEnable);
    if (!chatEnable) {
      return;
    }
    require('./model/');
    startXmpp(xmpp);
    bindMousetrap(Mousetrap);
    WorkspaceStore.defineSheet(
      'ChatView',
      { root: true },
      {
        list: ['RootSidebar', 'ChatView'],
        split: ['RootSidebar', 'ChatView'],
      }
    );
    WorkspaceStore.defineSheet(
      'NewConversation',
      {},
      {
        split: ['NewConversation'],
        list: ['NewConversation'],
      }
    );
    const { devMode } = AppEnv.getLoadSettings();
    LocalStorage.loadFromLocalStorage();
    window.edisonChatServerDiffTime = 0;
    if (true || devMode || isChatTest) {
      ChatButton = require('./lib/chat-button');
      ChatView = require('./lib/chat-view');
      NewConversation = require('./components/new/NewConversation');
      ChatViewLeft = require('./lib/chat-view-left');
      ChatAccountSidebarFiller = require('./lib/chat-account-sidebar-filler');

      ComponentRegistry.register(ChatView, { location: WorkspaceStore.Location.ChatView });
      ComponentRegistry.register(NewConversation, {
        location: WorkspaceStore.Location.NewConversation,
      });
      if (AppEnv.isMainWindow()) {
        ComponentRegistry.register(ChatButton, {
          location: WorkspaceStore.Location.RootSidebar.Toolbar,
        });
        ComponentRegistry.register(ChatViewLeft, {
          location: WorkspaceStore.Sheet.Global.Footer,
        });
        ComponentRegistry.register(ChatAccountSidebarFiller, {
          location: WorkspaceStore.Location.RootSidebar,
        });
      }
      // else {
      //   AppEnv.getCurrentWindow().setMinimumSize(800, 600);
      //   ComponentRegistry.register(ChatView, {
      //     location: WorkspaceStore.Location.Center,
      //   });
      // }
    }
    AppStore.refreshAppsEmailContacts();
  },

  deactivate() {
    if (AppEnv.config.get(`core.workspace.enableChat`)) {
      const { devMode } = AppEnv.getLoadSettings();
      if (true || devMode || isChatTest) {
        ComponentRegistry.unregister(ChatView);
        ComponentRegistry.unregister(NewConversation);
        if (AppEnv.isMainWindow()) {
          ComponentRegistry.unregister(ChatButton);
          ComponentRegistry.unregister(ChatViewLeft);
          ComponentRegistry.unregister(ChatAccountSidebarFiller);
        }
      }
    }
  },
};
