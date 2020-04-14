import { ComponentRegistry } from 'mailspring-exports';
import { OutboxMessageButtons } from './outbox-toolbar-buttons';

export function activate() {
  if (AppEnv.isMainWindow()) {
    ComponentRegistry.register(OutboxMessageButtons, {
      role: 'OutboxMessageToolbar',
    });
  }
}

export function deactivate() {
  ComponentRegistry.unregister(OutboxMessageButtons);
}
