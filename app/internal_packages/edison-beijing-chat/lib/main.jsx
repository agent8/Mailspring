import ChatButton from './chat-button';
import ChatView from './chat-view';
import ChatViewLeft from './chat-view-left';
import EmailAvatar from './email-avatar';
import ChatAccountSidebarFiller from '../chat-components/components/chat/chat-account-sidebar-filler';
const { ComponentRegistry, WorkspaceStore } = require('mailspring-exports');

module.exports = {
  activate() {
    ComponentRegistry.register(EmailAvatar, { role: 'EmailAvatar' });
    const { devMode } = AppEnv.getLoadSettings();
    if (devMode) {
      WorkspaceStore.defineSheet('ChatView', { root: true }, { list: ['RootSidebar', 'ChatView'] });
      ComponentRegistry.register(ChatView, { location: WorkspaceStore.Location.ChatView });
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
  },

  deactivate() {
    ComponentRegistry.unregister(EmailAvatar);
    const { devMode } = AppEnv.getLoadSettings();
    if (devMode) {
      if (AppEnv.isMainWindow()) {
        ComponentRegistry.unregister(ChatButton);
        ComponentRegistry.unregister(ChatViewLeft);
        ComponentRegistry.unregister(ChatAccountSidebarFiller);
      } else {
        ComponentRegistry.unregister(ChatView);
      }
    }
  }
};
