import { React, WorkspaceStore, ComponentRegistry, Actions } from 'mailspring-exports';
import { ListDetailContainer } from 'mailspring-component-kit';
import SiftList from './sift-list';
import SiftListToolbar from './sift-list-toolbar';
import { SiftButton } from './sift-list-toolbar-buttons';
import MessageList from '../../message-list/lib/message-list';

class NewSiftList extends React.Component {
  static displayName = 'SiftList';
  render() {
    return <ListDetailContainer listComponent={SiftList} detailComponent={MessageList} />;
  }
}

export function activate() {
  if (
    AppEnv.savedState.perspective &&
    AppEnv.savedState.perspective.type === 'SiftMailboxPerspective'
  ) {
    Actions.selectRootSheet(WorkspaceStore.Sheet.Sift);
  }

  ComponentRegistry.register(NewSiftList, { location: WorkspaceStore.Location.SiftList });
  ComponentRegistry.register(SiftListToolbar, {
    location: WorkspaceStore.Location.SiftList.Toolbar,
    role: 'SiftListToolbar',
  });
  ComponentRegistry.register(SiftButton, { role: 'SiftListActionsToolbarButton' });
}

export function deactivate() {
  ComponentRegistry.unregister(NewSiftList);
  ComponentRegistry.unregister(SiftListToolbar);
  ComponentRegistry.unregister(SiftButton);
}
