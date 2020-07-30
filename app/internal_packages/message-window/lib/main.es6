import { WorkspaceStore, ComponentRegistry } from 'mailspring-exports';
import MessageWindowRoot from './message-window-root';

export function activate() {
  WorkspaceStore.defineSheet('Main', { root: true }, { list: ['Center'] });

  ComponentRegistry.register(MessageWindowRoot, {
    location: WorkspaceStore.Location.Center,
  });
}

export function deactivate() {}

export function serialize() {}
