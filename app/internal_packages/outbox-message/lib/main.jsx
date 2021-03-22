import { ComponentRegistry } from 'mailspring-exports';
import { OutboxMessageButtons } from './outbox-toolbar-buttons';
import OutboxMessageFailedReason from './outbox-message-failed-reason';

export function activate() {
  if (AppEnv.isMainWindow()) {
    ComponentRegistry.register(OutboxMessageButtons, {
      role: 'OutboxMessageToolbar',
    });
    ComponentRegistry.register(OutboxMessageFailedReason, {
      role: 'message:BodyHeader',
    });
  }
}

export function deactivate() {
  ComponentRegistry.unregister(OutboxMessageButtons);
}
