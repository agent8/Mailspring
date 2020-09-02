import { ComponentRegistry, WorkspaceStore } from 'mailspring-exports';
import UndoRedoToast from './undo-redo-toast';

export function activate() {
  if (AppEnv.isMainWindow()) {
    // ComponentRegistry.register(UndoRedoToast, {
    //   location: WorkspaceStore.Sheet.Global.Footer,
    // });
    ComponentRegistry.register(UndoRedoToast, {
      role: 'RootSidebar:Notifications',
    });
  }
}

export function deactivate() {
  if (AppEnv.isMainWindow()) {
    ComponentRegistry.unregister(UndoRedoToast);
  }
}
