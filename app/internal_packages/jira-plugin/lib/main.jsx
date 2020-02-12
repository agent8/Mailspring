import JiraPlugin from './jira-plugin';
const { ComponentRegistry } = require('mailspring-exports');

module.exports = {
  activate() {
    ComponentRegistry.register(JiraPlugin, {
      role: "plugins"
    })
  },

  deactivate() {
    ComponentRegistry.unregister(JiraPlugin);
  }
}
