import Model from './model';
import Attributes from '../attributes';
const isMessageView = AppEnv.isDisableThreading();

export default class SetObservableRange extends Model {
  static attributes = Object.assign({}, Model.attributes, {
    threadIds: Attributes.Collection({
      modelKey: 'threadIds',
    }),
    messageIds: Attributes.Collection({
      modelKey: 'messageIds',
    }),
    accountId: Attributes.String({
      modelKey: 'accountId',
    }),
    type: Attributes.String({
      modelKey: 'type',
    }),
    folderIds: Attributes.Collection({
      modelKEy: 'folderIds',
    }),
  });

  constructor({ threadIds = [], messageIds = [], folderIds = [], accountId, ...rest } = {}) {
    super(rest);
    this.threadIds = threadIds;
    this.messageIds = messageIds;
    this.accountId = accountId;
    this.folderIds = folderIds;
    this.type = 'observed-ids';
    if (isMessageView) {
      this.threadIds = [];
      const messageIdSet = new Set([...threadIds, ...messageIds]);
      this.messageIds = [...messageIdSet];
    }
  }
  toJSON() {
    return {
      type: this.type,
      threadIds: this.threadIds,
      messageIds: this.messageIds,
      folderIds: this.folderIds,
    };
  }
}
