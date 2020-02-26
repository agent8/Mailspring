import JiraPlugin from './jira-plugin';
import JiraToolbarButton from './jira-toolbar-button';
import fs from 'fs';
import path from 'path';
const { ComponentRegistry } = require('mailspring-exports');

module.exports = {
  activate() {
    if (AppEnv.isMainWindow()) {
      const configDirPath = AppEnv.getConfigDirPath();
      const jiraPath = path.join(configDirPath, 'jira_cache');
      if (!fs.existsSync(jiraPath)) {
        fs.mkdirSync(jiraPath);
      }
    }
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
