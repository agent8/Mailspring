import NoteToolbarButton from './note-toolbar-button';
const { ComponentRegistry } = require('mailspring-exports');

module.exports = {
  activate() {
    ComponentRegistry.register(NoteToolbarButton, {
      role: 'MailActionsToolbarButton',
    });
  },

  deactivate() {
    ComponentRegistry.unregister(NoteToolbarButton);
  },
};
