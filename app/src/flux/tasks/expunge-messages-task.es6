import Task from './task';
import Attributes from '../attributes';

export default class ExpungeMessagesTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    messageIds: Attributes.Collection({
      modelKey: 'messageIds',
    }),
    threadIds: Attributes.Collection({
      modelKey: 'threadIds',
    }),
    source: Attributes.String({
      modelKey: 'source',
    }),
    canBeUndone: Attributes.Boolean({
      modelKey: 'canBeUndone',
    }),
  });

  constructor(data = {}) {
    data.canBeUndone = true;
    super(data);
    this.messageIds = data.messageIds || [];
    this.threadIds = data.threadIds || [];
    this.accountId = data.accountId || '';
    this.source = data.source || '';
    if (this.canBeUndone === undefined) {
      this.canBeUndone = true;
    }
  }

  label() {
    return `Expunging ${this.threadIds.length > 0 ? 'threads' : 'messages'} from mailbox`;
  }

  description() {
    if (this.taskDescription) {
      return this.taskDescription;
    }
    if (this.messageIds.length > 1) {
      return `Permanently deleted ${this.messageIds.length} messages`;
    }
    if (this.messageIds.length === 1) {
      return `Permanently deleted message`;
    }
    return `Permanently deleted`;
  }
}