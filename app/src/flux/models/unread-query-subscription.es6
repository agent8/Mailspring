import MutableQuerySubscription from './mutable-query-subscription';
import DatabaseStore from '../stores/database-store';
import RecentlyReadStore from '../stores/recently-read-store';
import Matcher from '../attributes/matcher';
import Thread from '../models/thread';
import JoinTable from '../models/join-table';
import { allInboxCategories, inboxOtherCategories, inboxNotOtherCategories } from '../../constant';

const EnableFocusedInboxKey = 'core.workspace.enableFocusedInbox';

const buildQuery = (categoryIds, isOther) => {
  const isMessageView = AppEnv.isDisableThreading();
  const unreadAttr = isMessageView
    ? Thread.attributes.unread.equal(true)
    : JoinTable.useAttribute(Thread.attributes.unread, 'Boolean').equal(true);
  const unreadWhereOptions = [
    Thread.attributes.categories.containsAny(categoryIds),
    unreadAttr,
    Thread.attributes.state.equal(0),
  ];

  // The "Unread" view shows all threads which are unread. When you read a thread,
  // it doesn't disappear until you leave the view and come back. This behavior
  // is implemented by keeping track of messages being read and manually
  // whitelisting them in the query.
  let inboxCategories = allInboxCategories({ toString: true });
  const enableFocusedInboxKey = AppEnv.config.get(EnableFocusedInboxKey);
  if (enableFocusedInboxKey) {
    if (isOther) {
      inboxCategories = inboxOtherCategories(false, { toString: true });
    } else {
      inboxCategories = inboxNotOtherCategories({ toString: true });
    }
    const inboxCategoryAttr = isMessageView
      ? Thread.attributes.inboxCategory.in(inboxCategories)
      : JoinTable.useAttribute(Thread.attributes.inboxCategory, 'Number').in(inboxCategories);
    unreadWhereOptions.push(inboxCategoryAttr);
  }
  const unreadMatchers = new Matcher.JoinAnd(unreadWhereOptions);
  const query = DatabaseStore.findAll(Thread).limit(0);
  if (RecentlyReadStore.ids.length === 0) {
    query.where(unreadMatchers);
  } else {
    let idKey = 'threadId';
    let unreadAttr = JoinTable.useAttribute(Thread.attributes.unread, 'Boolean').equal(true);
    if (isMessageView) {
      idKey = 'messageId';
      unreadAttr = Thread.attributes.unread.equal(true);
    }
    const whereOptions = [unreadAttr, Thread.attributes.state.equal(0)];
    const recentlyReadStoreWhereOptions = [
      JoinTable.useAttribute(idKey, 'String').in(RecentlyReadStore.ids),
      JoinTable.useAttribute(isMessageView ? 'state' : Thread.attributes.state, 'Number').equal(0),
    ];
    if (enableFocusedInboxKey) {
      const inboxCategoryAttr = isMessageView
        ? Thread.attributes.inboxCategory.in(inboxCategories)
        : JoinTable.useAttribute(Thread.attributes.inboxCategory, 'Number').in(inboxCategories);
      whereOptions.push(inboxCategoryAttr);
      recentlyReadStoreWhereOptions.push(inboxCategoryAttr);
    }
    query.where(
      new Matcher.JoinAnd([
        Thread.attributes.categories.containsAny(categoryIds),
        new Matcher.JoinOr([
          new Matcher.JoinAnd(whereOptions),
          new Matcher.JoinAnd(recentlyReadStoreWhereOptions),
        ]),
      ])
    );
  }

  return query;
};

export default class UnreadQuerySubscription extends MutableQuerySubscription {
  constructor(categoryIds, isOther = false) {
    super(buildQuery(categoryIds, isOther), { emitResultSet: true });
    this.isOther = isOther;
    this._categoryIds = categoryIds;
    this.inboxCategories = allInboxCategories({ toString: true });
    const enableFocusedInboxKey = AppEnv.config.get(EnableFocusedInboxKey);
    if (enableFocusedInboxKey) {
      if (isOther) {
        this.inboxCategories = inboxOtherCategories(false, { toString: true });
      } else {
        this.inboxCategories = inboxNotOtherCategories({ toString: true });
      }
    }
    this._unlisten = RecentlyReadStore.listen(this.onRecentlyReadChanged);
  }

  onRecentlyReadChanged = () => {
    const { limit, offset } = this._query.range();
    const query = buildQuery(this._categoryIds, this.isOther)
      .limit(limit)
      .offset(offset);
    this.replaceQuery(query);
  };

  onLastCallbackRemoved() {
    this._unlisten();
  }
}
