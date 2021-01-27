import { ComponentRegistry, WorkspaceStore } from 'mailspring-exports';

import TitleSearchBar from './title-search-bar';
import ThreadSearchBar from './thread-search-bar';

export function activate() {
  if (!WorkspaceStore.Location.DraftList) {
    WorkspaceStore.defineSheet('Drafts', { root: true }, { list: ['RootSidebar', 'DraftList'] });
  }
  ComponentRegistry.register(TitleSearchBar, {
    locations: [
      WorkspaceStore.Location.MessageList,
      WorkspaceStore.Location.ThreadList,
      WorkspaceStore.Location.DraftList,
      WorkspaceStore.Location.SiftList,
    ],
    // role: 'Search-Bar',
  });
  ComponentRegistry.register(ThreadSearchBar, {
    locations: [
      WorkspaceStore.Location.MessageList,
      WorkspaceStore.Location.ThreadList,
      WorkspaceStore.Location.DraftList,
    ],
  });
}

export function deactivate() {
  ComponentRegistry.unregister(TitleSearchBar);
  ComponentRegistry.unregister(ThreadSearchBar);
}
