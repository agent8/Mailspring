import Task from './task';
import Attributes from '../attributes';
import File from '../models/file';
export default class ExpandMessageAttachmentTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    originalAttachmentId: Attributes.String({
      modelKey: 'originalAttachmentId',
    }),
    files: Attributes.Collection({
      modelKey: 'files',
      itemClass: File,
    }),
    messageId: Attributes.String({
      modelKey: 'messageId',
    }),
    canBeUndone: Attributes.Boolean({
      modelKey: 'canBeUndone',
    }),
  });
  constructor(data = {}) {
    super(data);
    this.messageId = this.messageId || data.messageId || '';
    this.files = this.files || data.files || [];
    this.canBeUndone = false;
  }

  label() {
    return `Add Attachment to Message`;
  }
}
