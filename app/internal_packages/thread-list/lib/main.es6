import { ComponentRegistry, WorkspaceStore } from 'mailspring-exports';

import ThreadList from './thread-list';
import ThreadListToolbar from './thread-list-toolbar';
import ThreadListEmptyFolderBar from './thread-list-empty-folder-bar';
import MessageListToolbar from './message-list-toolbar';
import SelectedItemsStack from './selected-items-stack';
import HiddenThreadListToolbar from './hidden-thread-list-toolbar';

import {
  ThreadListToolbarButtons,
  ThreadEmptyMoreButtons,
  MailActionsButtons,
  MailActionsPopoutButtons,
  HiddenThreadListToolbarButtons,
} from './thread-toolbar-buttons';

export function activate() {
  if (AppEnv.isMainWindow()) {
    ComponentRegistry.register(ThreadListEmptyFolderBar, {
      // location: WorkspaceStore.Location.ThreadList,
      role: 'ThreadListEmptyFolderBar',
    });

    ComponentRegistry.register(ThreadList, {
      location: WorkspaceStore.Location.ThreadList,
    });

    ComponentRegistry.register(SelectedItemsStack, {
      location: WorkspaceStore.Location.MessageList,
      modes: ['split'],
    });

    // Toolbars
    ComponentRegistry.register(HiddenThreadListToolbar, {
      location: WorkspaceStore.Location.ThreadList.Toolbar,
      modes: ['list', 'split'],
    });

    ComponentRegistry.register(ThreadListToolbar, {
      modes: ['list', 'split'],
      role: 'ThreadListToolbar',
    });

    ComponentRegistry.register(ThreadEmptyMoreButtons, {
      modes: ['list'],
      role: 'ThreadActionsToolbarButtonEmpty',
    });

    ComponentRegistry.register(MailActionsPopoutButtons, {
      role: 'MailActionsToolbarButton',
    });
  }
  ComponentRegistry.register(MessageListToolbar, {
    role: 'MessageListToolbar',
  });
  ComponentRegistry.register(ThreadListToolbarButtons, {
    role: 'ThreadListToolbarButtons',
  });
  ComponentRegistry.register(HiddenThreadListToolbarButtons, {
    role: 'HiddenThreadListToolbarButtons',
  });
  ComponentRegistry.register(MailActionsButtons, {
    role: 'MailActionsToolbarButton',
  });
}

export function deactivate() {
  ComponentRegistry.unregister(ThreadList);
  ComponentRegistry.unregister(SelectedItemsStack);
  ComponentRegistry.unregister(ThreadListToolbar);
  ComponentRegistry.unregister(HiddenThreadListToolbar);
  ComponentRegistry.unregister(MessageListToolbar);
  ComponentRegistry.unregister(ThreadEmptyMoreButtons);
  ComponentRegistry.unregister(MailActionsButtons);
  ComponentRegistry.unregister(MailActionsPopoutButtons);
  ComponentRegistry.unregister(HiddenThreadListToolbarButtons);
}