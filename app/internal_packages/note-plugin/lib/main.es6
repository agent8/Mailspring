const { ComponentRegistry } = require('mailspring-exports');
import NoteToolbarButton from './note-toolbar-button';
import EditableNote from './editable-note';

module.exports = {
  activate() {
    ComponentRegistry.register(NoteToolbarButton, {
      role: 'MailActionsToolbarButton',
    });
    ComponentRegistry.register(EditableNote, {
      role: 'EditableNote',
    });
  },

  deactivate() {
    ComponentRegistry.unregister(NoteToolbarButton);
    ComponentRegistry.unregister(EditableNote);
  },
};
