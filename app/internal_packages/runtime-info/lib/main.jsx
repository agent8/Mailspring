import RuntimeInfoPanel from './runtime-info-panel';
const { ComponentRegistry } = require('mailspring-exports');

module.exports = {
  activate() {
    if (AppEnv.isMainWindow()) {
      ComponentRegistry.register(RuntimeInfoPanel, {
        role: "runtime-info-panel"
      })
    }
  },

  deactivate() {
    if (AppEnv.isMainWindow()) {
      ComponentRegistry.unregister(RuntimeInfoPanel);
    }
  }
}
