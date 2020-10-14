export default class AppMessage {
  constructor({
    id,
    accountIds = [],
    level = 0,
    description = '',
    actions = [],
    allowClose = true,
  } = {}) {
    this.id = id;
    this.accountIds = accountIds;
    this.level = level;
    this.description = description;
    this.actions = actions;
    this.allowClose = allowClose;
  }
}
