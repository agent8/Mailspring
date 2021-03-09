const { ComponentRegistry } = require('mailspring-exports');
import NoteToolbarButton from './note-toolbar-button';
import EditableNote from './editable-note';
import NoteLabels from './note-labels';

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
  },

  deactivate() {
    ComponentRegistry.unregister(NoteToolbarButton);
    ComponentRegistry.unregister(EditableNote);
    ComponentRegistry.unregister(NoteLabels);
  },
};
