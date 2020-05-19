import Task from './task';
import Attributes from '../attributes';

export default class RestoreDraftTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    deleteMessageId: Attributes.String({
      modelKey: 'deleteMessageId',
    }),
    restoreMessageId: Attributes.String({
      modelKey: 'restoreMessageId',
    }),
  });

  constructor({ deleteMessageId = '', restoreMessageId = '', ...rest } = {}) {
    super(rest);
    this.deleteMessageId = deleteMessageId;
    this.restoreMessageId = restoreMessageId;
    this.canBeUndone = false;
  }
}
