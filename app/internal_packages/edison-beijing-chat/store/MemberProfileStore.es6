import MailspringStore from 'mailspring-store';
import { ChatActions } from 'chat-exports';

class MemberProfileStore extends MailspringStore {
  constructor() {
    super();
    this.listenTo(ChatActions.checkMember, this.setMember);
  }

  setMember = payload => {
    this.trigger(payload);
  };
}

module.exports = new MemberProfileStore();
