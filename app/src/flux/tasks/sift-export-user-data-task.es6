import SiftTask from './sift-task';
import Attributes from '../attributes';

export default class SiftExportUserDataTask extends SiftTask {
  static attributes = Object.assign({}, SiftTask.attributes, {
    aid: Attributes.String({
      modelKey: 'aid',
    }),
    email: Attributes.String({
      modelKey: 'email',
    }),
  });
  constructor({ sendEmail, accountId, ...rest } = {}) {
    super(rest);
    this.aid = accountId;
    this.email = sendEmail;
  }

  label() {
    return `Sift Export User Data`;
  }
}
