import SiftTask from './sift-task';
import Attributes from '../attributes';
import Actions from '../actions';

export default class UnMuteNotifacationsTask extends SiftTask {
  static attributes = Object.assign({}, SiftTask.attributes, {
    aid: Attributes.String({
      modelKey: 'aid',
    }),
    email: Attributes.String({
      modelKey: 'email',
    }),
  });
  constructor({ accountId, email, ...rest } = {}) {
    super(rest);
    this.aid = accountId;
    this.email = email;
  }

  label() {
    return `unmute notifacations`;
  }

  onError(err) {
    // noop
  }

  onSuccess() {
    Actions.changeMuteSucceeded();
  }
}
