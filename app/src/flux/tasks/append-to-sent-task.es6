/* eslint global-require: 0 */
import Task from './task';
import Attributes from '../attributes';
import Message from '../models/message';
export default class AppendToSentTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    draft: Attributes.Object({
      modelKey: 'draft',
      itemClass: Message,
    }),
  });
  constructor(data) {
    super(data);
  }
}
