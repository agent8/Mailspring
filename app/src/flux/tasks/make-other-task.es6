import Attributes from '../attributes';
import Task from './task';

export default class MakeOtherTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    aid: Attributes.String({
      modelKey: 'aid',
    }),
    threadIds: Attributes.Collection({
      modelKey: 'threadIds',
    }),
    messageIds: Attributes.Collection({
      modelKey: 'messageIds',
    }),
  });
  constructor({ accountId, threadIds, messageIds, ...rest } = {}) {
    super(rest);
    this.aid = accountId;
    this.threadIds = threadIds || [];
    this.messageIds = messageIds || [];
  }

  label() {
    if (this.messageIds.length > 1) {
      return `make ${this.messageIds.length} messages to other`;
    }
    if (this.messageIds.length === 1) {
      return `make message to other`;
    }
    if (this.threadIds.length > 1) {
      return `make ${this.threadIds.length} threads to other`;
    }
    if (this.threadIds.length === 1) {
      return `make threads to other`;
    }
    return 'make other';
  }
  description() {
    return this.label();
  }

  onError(err) {
    // noop
  }

  onSuccess() {
    // noop
  }
}
