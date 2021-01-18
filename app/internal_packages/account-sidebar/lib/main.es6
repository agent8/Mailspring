import AccountSidebarMask from './components/account-sidebar-mask';
import AccountSidebarControls from './components/account-sidebar-controls';
const AccountSidebar = require('./components/account-sidebar');
const { ComponentRegistry, WorkspaceStore } = require('mailspring-exports');
const { ToolbarBack } = require('mailspring-component-kit');

module.exports = {
  item: null, // The DOM item the main React component renders into

  activate(state) {
    this.state = state;
    if (!WorkspaceStore.Location.DraftList) {
      WorkspaceStore.defineSheet('Drafts', { root: true }, { list: ['RootSidebar', 'DraftList'] });
    }
    ComponentRegistry.register(AccountSidebarControls, {
      location: WorkspaceStore.Location.RootSidebar,
    });
    ComponentRegistry.register(AccountSidebar, { location: WorkspaceStore.Location.RootSidebar });
    ComponentRegistry.register(ToolbarBack, {
      mode: 'list',
      role: 'MessageListToolbar',
    });
    ComponentRegistry.register(AccountSidebarMask, {
      locations: [
        WorkspaceStore.Location.MessageList.Toolbar,
        WorkspaceStore.Location.ThreadList.Toolbar,
        WorkspaceStore.Location.DraftList.Toolbar,
        WorkspaceStore.Location.ThreadList,
        WorkspaceStore.Location.MessageList,
        WorkspaceStore.Location.DraftList,
        WorkspaceStore.Location.SiftList,
        WorkspaceStore.Location.SiftList.Toolbar,
      ],
    });
  },

  deactivate(state) {
    this.state = state;
    ComponentRegistry.unregister(AccountSidebar);
    ComponentRegistry.unregister(ToolbarBack);
    ComponentRegistry.unregister(AccountSidebarMask);
    ComponentRegistry.unregister(AccountSidebarControls);
  },
};
