import Task from './task';
import Attributes from '../attributes';

export default class ContactUpdateTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    name: Attributes.String({
      modelKey: 'name',
    }),
    email: Attributes.String({
      modelKey: 'email',
    }),
  });
  constructor({ accountId, ...rest } = {}) {
    super(rest);
    this.accountId = accountId || '';
    this.canBeUndone = false;
  }

  label() {
    return `Update Contact`;
  }
}
