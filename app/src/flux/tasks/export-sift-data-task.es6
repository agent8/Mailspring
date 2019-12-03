import SiftTask from './sift-task';
import Attributes from '../attributes';
import Actions from '../actions';

export default class ExportSiftDataTask extends SiftTask {
  static attributes = Object.assign({}, SiftTask.attributes, {
    sendEmail: Attributes.String({
      modelKey: 'sendEmail',
    }),
  });
  constructor({ sendEmail, ...rest } = {}) {
    super(rest);
    this.sendEmail = sendEmail;
  }

  label() {
    return `Export sift data`;
  }
}
