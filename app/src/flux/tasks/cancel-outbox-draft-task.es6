import Task from './task';
import Attributes from '../attributes';

export default class CancelOutboxDraftTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    messageIds: Attributes.Collection({
      modelKey: 'messageIds',
      jsonKey: 'msgPIds',
    }),
    canBeUndone: Attributes.Boolean({
      modelKey: 'canBeUndone',
    }),
  });

  constructor({ messageIds = [], refOldDraftMessageIds = [], ...rest } = {}) {
    super(rest);
    this.messageIds = Array.isArray(messageIds) ? messageIds : [messageIds];
    if (this.canBeUndone === undefined) {
      this.canBeUndone = true;
    }
  }

  label() {
    if (this.messageIds.length > 1) {
      return `Canceling ${this.messageIds.length} drafts`;
    }
    return 'Canceling draft';
  }
  description() {
    return this.label();
  }

  onError({ key, debuginfo, retryable }) {
    if (retryable) {
      AppEnv.reportError(new Error(`Canceling draft failed because ${debuginfo}`));
      return;
    }
  }
}
