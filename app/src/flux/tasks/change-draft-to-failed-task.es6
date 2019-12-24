import Task from './task';
import Attributes from '../attributes';

export default class ChangeDraftToFailedTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    headerMessageIds: Attributes.Collection({
      modelKey: 'headerMessageIds',
    }),
    sendDraftTaskIds: Attributes.Collection({
      modelKey: 'sendDraftTaskIds',
      jsonKey: 'refSendDraftTaskIds',
    })
  });

  constructor({ headerMessageIds = [], ...rest } = {}) {
    super(rest);
    this.headerMessageIds = headerMessageIds;
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
