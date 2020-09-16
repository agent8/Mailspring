import { React, WorkspaceStore, ComponentRegistry, Actions } from 'mailspring-exports';
import { ListDetailContainer } from 'mailspring-component-kit';
import OutboxList from './outbox-list';
import OutboxListToolbar from './outbox-list-toolbar';
import { OutboxDeleteButton, ReSendButton } from './outbox-toolbar-buttons';
import OutboxMessage from '../../message-list/lib/outbox-message';

class NewOutboxList extends React.Component {
  static displayName = 'OutboxList';
  render() {
    return (
      <ListDetailContainer isOutbox listComponent={OutboxList} detailComponent={OutboxMessage} />
    );
  }
}

export function activate() {
  if (
    AppEnv.savedState.perspective &&
    AppEnv.savedState.perspective.type === 'OutboxMailboxPerspective'
  ) {
    Actions.selectRootSheet(WorkspaceStore.Sheet.Outbox);
  }

  ComponentRegistry.register(NewOutboxList, { location: WorkspaceStore.Location.Outbox });
  ComponentRegistry.register(OutboxListToolbar, {
    location: WorkspaceStore.Location.Outbox.Toolbar,
    role: 'OutboxListToolbar',
  });
  ComponentRegistry.register(OutboxDeleteButton, { role: 'OutboxActionsToolbarButton' });
  ComponentRegistry.register(ReSendButton, { role: 'OutboxActionsToolbarButton' });
}

export function deactivate() {
  ComponentRegistry.unregister(NewOutboxList);
  ComponentRegistry.unregister(OutboxListToolbar);
  ComponentRegistry.unregister(ReSendButton);
  ComponentRegistry.unregister(OutboxDeleteButton);
}
