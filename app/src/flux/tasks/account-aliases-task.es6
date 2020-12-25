import Task from './task';
import Attributes from '../attributes';

export default class AccountAliasesTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    aliases: Attributes.Collection({
      modelKey: 'aliases',
    }),
  });
  constructor({ aliases, ...rest } = {}) {
    super(rest);
    this.aliases = aliases;
    this.canBeUndone = false;
  }

  label() {
    return `Notify Native account aliases update`;
  }
}
