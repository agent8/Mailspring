import JiraPlugin from './jira-plugin';
import JiraToolbarButton from './jira-toolbar-button';
const { ComponentRegistry } = require('mailspring-exports');

module.exports = {
  activate() {
    ComponentRegistry.register(JiraPlugin, {
      role: "plugins"
    })
    ComponentRegistry.register(JiraToolbarButton, {
      role: 'MailActionsToolbarButton',
    });
  },

  deactivate() {
    ComponentRegistry.unregister(JiraPlugin);
    ComponentRegistry.unregister(JiraToolbarButton);
  }
}
