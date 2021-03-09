const { ComponentRegistry } = require('mailspring-exports');
import NoteToolbarButton from './note-toolbar-button';
import EditableNote from './editable-note';
import NoteLabels from './note-labels';
import NoteFilter from './note-filter';

module.exports = {
  activate() {
    ComponentRegistry.register(NoteToolbarButton, {
      role: 'MailActionsToolbarButton',
    });
    ComponentRegistry.register(EditableNote, {
      role: 'EditableNote',
    });
    ComponentRegistry.register(NoteLabels, {
      role: 'NoteLabels',
    });
    ComponentRegistry.register(NoteFilter, {
      role: 'TitlePlugin',
    });
  },

  deactivate() {
    ComponentRegistry.unregister(NoteToolbarButton);
    ComponentRegistry.unregister(EditableNote);
    ComponentRegistry.unregister(NoteLabels);
    ComponentRegistry.unregister(NoteFilter);
  },
};
