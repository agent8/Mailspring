/* eslint global-require: 0 */
import { PreferencesUIStore, WorkspaceStore, ComponentRegistry } from 'mailspring-exports';
import PreferencesRoot from './preferences-root';
import preferencesTemplateFills from './preferences-template-fill';

export function activate() {
  PreferencesUIStore.registerTabs(preferencesTemplateFills.tables);

  WorkspaceStore.defineSheet(
    'Preferences',
    {},
    {
      split: ['Preferences'],
      list: ['Preferences'],
    }
  );

  ComponentRegistry.register(PreferencesRoot, {
    location: WorkspaceStore.Location.Preferences,
  });
}

export function deactivate() {}

export function serialize() {
  return this.state;
}
