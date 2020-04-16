import Task from './task';
import Attributes from '../attributes';

export default class ChangeDraftToFailedTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    messageIds: Attributes.Collection({
      modelKey: 'messageIds',
      jsonKey: 'msgPIds',
    }),
    sendDraftTaskIds: Attributes.Collection({
      modelKey: 'sendDraftTaskIds',
      jsonKey: 'refSendDraftTaskIds',
    }),
  });

  constructor({ messageIds = [], ...rest } = {}) {
    super(rest);
    this.messageIds = messageIds;
    if (this.canBeUndone) {
      this.canBeUndone = false;
    }
  }

  label() {
    return 'Drafts set to failed';
  }
  description() {
    return this.label();
  }

  onError({ key, debuginfo, retryable }) {
    if (retryable) {
      console.warn(`Fail draft failed because ${debuginfo}`);
      return;
    }
  }
}
