import ZendeskPlugin from './zendesk-plugin'
import ZendeskToolbarButton from './zendesk-toolbar-button'
import fs from 'fs'
import path from 'path'
const { ComponentRegistry } = require('mailspring-exports')

module.exports = {
  activate () {
    if (AppEnv.isMainWindow()) {
      const configDirPath = AppEnv.getConfigDirPath()
      const zendeskPath = path.join(configDirPath, 'zendesk_cache')
      if (!fs.existsSync(zendeskPath)) {
        fs.mkdirSync(zendeskPath)
      }
    }
    ComponentRegistry.register(ZendeskPlugin, {
      role: 'plugins',
    })
    ComponentRegistry.register(ZendeskToolbarButton, {
      role: 'MailActionsToolbarButton',
    })
  },

  deactivate () {
    ComponentRegistry.unregister(ZendeskPlugin)
    ComponentRegistry.unregister(ZendeskToolbarButton)
  },
}
