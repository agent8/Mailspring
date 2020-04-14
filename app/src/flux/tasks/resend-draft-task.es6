import Task from './task';
import Attributes from '../attributes';

export default class ResendDraftTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    messageIds: Attributes.Collection({
      modelKey: 'messageIds',
    }),
    refOldDraftMessageIds: Attributes.Collection({
      modelKey: 'refOldDraftHeaderMessageIds',
    }),
  });

  constructor({ messageIds = [], refOldDraftMessageIds = [], ...rest } = {}) {
    super(rest);
    this.messageIds = Array.isArray(messageIds) ? messageIds : [messageIds];
    this.refOldDraftMessageIds = Array.isArray(refOldDraftMessageIds)
      ? refOldDraftMessageIds
      : [refOldDraftMessageIds];
    if (this.messageIds.length !== this.refOldDraftMessageIds.length) {
      AppEnv.reportError(
        new Error(`CancelOutboxDraftTask have unequal length messageIds and refOldDraftMessageIds`)
      );
    }
    if (this.canBeUndone) {
      this.canBeUndone = false;
    }
  }

  label() {
    if (this.messageIds.length > 1) {
      return `Resending ${this.messageIds.length} drafts`;
    }
    return 'Resending draft';
  }
  description() {
    return this.label();
  }

  onError({ key, debuginfo, retryable }) {
    if (retryable) {
      AppEnv.reportError(new Error(`Resending draft failed because ${debuginfo}`));
      return;
    }
  }
}
