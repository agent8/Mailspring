import Task from './task';
import Attributes from '../attributes';
import Actions from '../actions';

export default class DestroyDraftTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    messageIds: Attributes.Collection({
      modelKey: 'messageIds',
    }),
    // headerMessageId: Attributes.String({
    //   modelKey: 'headerMessageId',
    // })
  });

  constructor({ messageIds = [], ...rest } = {}) {
    super(rest);
    this.messageIds = messageIds;
    if (this.canBeUndone === undefined) {
      this.canBeUndone = true;
    }
  }

  label() {
    return 'Deleting draft';
  }
  description() {
    return 'Deleting draft';
  }

  onSuccess() {
    Actions.destroyDraftSucceeded({
      messageIds: this.messageIds,
    });
  }

  onError({ key, debuginfo, retryable }) {
    if (retryable) {
      console.warn(`Destroying draft failed because ${debuginfo}`);
      return;
    }
    Actions.destroyDraftFailed({
      key, debuginfo,
      messageIds: this.messageIds,
    });
  }
}
