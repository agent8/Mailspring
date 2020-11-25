import { WorkspaceStore, ComponentRegistry } from 'mailspring-exports';
import MigrateWindowRoot from './migrate-window-root';
module.exports = {
  activate() {
    WorkspaceStore.defineSheet('Main', { root: true }, { list: ['Center'] });

    ComponentRegistry.register(MigrateWindowRoot, {
      location: WorkspaceStore.Location.Center,
    });
  },
  deactivate() {},
};
