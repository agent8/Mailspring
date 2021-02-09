import { ComponentRegistry, WorkspaceStore, Actions } from 'mailspring-exports';
import Calendar from './src/index';

// Activate is called when the package is loaded. If your package previously
// saved state using `serialize` it is provided.
//
export function activate() {
  if (!WorkspaceStore.Location.Calendar) {
    WorkspaceStore.defineSheet('Calendar', { root: true }, { list: ['RootSidebar', 'Calendar'] });
  }
  if (
    AppEnv.savedState.perspective &&
    AppEnv.savedState.perspective.type === 'CalendarMailboxPerspective'
  ) {
    Actions.selectRootSheet(WorkspaceStore.Sheet.Calendar);
  }
  ComponentRegistry.register(Calendar, { location: WorkspaceStore.Location.Calendar });
}

// Serialize is called when your package is about to be unmounted.
// You can return a state object that will be passed back to your package
// when it is re-activated.
//
export function serialize() { }

// This **optional** method is called when the window is shutting down,
// or when your package is being updated or disabled. If your package is
// watching any files, holding external resources, providing commands or
// subscribing to events, release them here.
//
export function deactivate() {
  // ComponentRegistry.unregister(CalendarButton);
  ComponentRegistry.unregister(Calendar);
}
