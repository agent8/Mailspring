import { WorkspaceStore, ComponentRegistry } from 'mailspring-exports';
import ICloudAppTokenRoot from './icloud-app-token-root';

export function activate() {
  WorkspaceStore.defineSheet('Main', { root: true }, { list: ['Center'] });

  ComponentRegistry.register(ICloudAppTokenRoot, {
    location: WorkspaceStore.Location.Center,
  });
}

export function deactivate() {}

export function serialize() {}
