import Task from './task';
import Attributes from '../attributes';

const isMessageView = AppEnv.getDisableThread();

export default class DeleteThreadsTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    threadIds: Attributes.Collection({
      modelKey: 'threadIds',
    }),
    messageIds: Attributes.Collection({
      modelKey: 'messageIds',
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
    const threadIds = data.threadIds || [];
    const messageIds = data.messageIds || [];
    if (isMessageView) {
      this.threadIds = [];
      const messageIdSet = new Set([...threadIds, ...messageIds]);
      this.messageIds = [...messageIdSet];
    } else {
      this.threadIds = threadIds;
      this.messageIds = messageIds;
    }
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
    let paramesText = '';
    // If the parames has both messageIds and threadIds, threadIds will not work in native
    if (this.messageIds.length) {
      const count = this.messageIds.length;
      paramesText = count > 1 ? `${count} messages` : 'message';
    } else if (this.threadIds.length) {
      const count = this.threadIds.length;
      paramesText = count > 1 ? `${count} threads` : 'thread';
    }
    return `Expunged ${paramesText}`;
  }
  willBeQueued() {
    if (this.threadIds.length > 0 && this.messageIds.length > 0) {
      throw new Error('DeleteThreadsTask: You can provide `threads` or `messages` but not both.');
    }
    if (this.threadIds.length === 0 && this.messageIds.length === 0) {
      throw new Error(
        'DeleteThreadsTask: You must provide a `threads` or `messages` Array of models or IDs.'
      );
    }
    super.willBeQueued();
  }
}
