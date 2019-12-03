import SiftTask from './sift-task';
import Attributes from '../attributes';
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

  onError(err) {
    // noop
  }

  onSuccess() {
    Actions.changeBlockSucceeded();
  }
}
