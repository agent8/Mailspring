import Task from './task';
import Attributes from '../attributes';

export default class ChangeDraftToFailingTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    messageIds: Attributes.Collection({
      modelKey: 'messageIds',
      jsonKey: 'msgPIds',
    }),
  });

  constructor({ messages = [], ...rest } = {}) {
    super(rest);
    this.messageIds = [];
    if (messages) {
      this.messages = messages;
      if (Array.isArray(messages)) {
        this.messageIds = this.messageIds.concat(
          ...messages.map(msg => {
            return msg.id;
          })
        );
      } else {
        this.messageIds.push(messages.id);
      }
    }
    if (this.canBeUndone) {
      this.canBeUndone = false;
    }
  }

  label() {
    return 'Drafts set to failing';
  }
  description() {
    return this.label();
  }

  onError({ key, debuginfo, retryable }) {
    if (retryable) {
      console.warn(`Failing draft failed because ${debuginfo}`);
      return;
    }
  }
}
