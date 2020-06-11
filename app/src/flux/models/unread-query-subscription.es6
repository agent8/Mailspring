import MutableQuerySubscription from './mutable-query-subscription';
import DatabaseStore from '../stores/database-store';
import RecentlyReadStore from '../stores/recently-read-store';
import Matcher from '../attributes/matcher';
import Thread from '../models/thread';
import Category from '../models/category';
import JoinTable from '../models/join-table';

const EnableFocusedInboxKey = 'core.workspace.enableFocusedInbox';

const buildQuery = (categoryIds, isOther) => {
  const unreadWhereOptions = [
    Thread.attributes.categories.containsAny(categoryIds),
    JoinTable.useAttribute('unread', 'Number').equal(1),
    Thread.attributes.state.equal(0),
  ];

  // The "Unread" view shows all threads which are unread. When you read a thread,
  // it doesn't disappear until you leave the view and come back. This behavior
  // is implemented by keeping track of messages being read and manually
  // whitelisting them in the query.
  let inboxCategories = 'all';
  const enableFocusedInboxKey = AppEnv.config.get(EnableFocusedInboxKey);
  if (enableFocusedInboxKey) {
    if (isOther) {
      inboxCategories = Category.inboxOtherCategorys().map(categoryNum => `${categoryNum}`);
    } else {
      inboxCategories = Category.inboxNotOtherCategorys().map(categoryNum => `${categoryNum}`);
    }
    unreadWhereOptions.push(
      JoinTable.useAttribute(Thread.attributes.inboxCategory, 'Number').in(inboxCategories)
    );
  }
  const unreadMatchers = new Matcher.JoinAnd(unreadWhereOptions);
  const query = DatabaseStore.findAll(Thread).limit(0);
  if (RecentlyReadStore.ids.length === 0) {
    query.where(unreadMatchers);
  } else {
    const whereOptions = [
      JoinTable.useAttribute('unread', 'Number').equal(1),
      Thread.attributes.state.equal(0),
    ];
    const recentlyReadStoreWhereOptions = [
      JoinTable.useAttribute('threadId', 'String').in(RecentlyReadStore.ids),
      JoinTable.useAttribute('state', 'Number').equal(0),
    ];
    if (enableFocusedInboxKey) {
      whereOptions.push(
        JoinTable.useAttribute(Thread.attributes.inboxCategory, 'Number').in(inboxCategories)
      );
      recentlyReadStoreWhereOptions.push(
        JoinTable.useAttribute(Thread.attributes.inboxCategory, 'Number').in(inboxCategories)
      );
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
    this.inboxCategories = 'all';
    const enableFocusedInboxKey = AppEnv.config.get(EnableFocusedInboxKey);
    if (enableFocusedInboxKey) {
      if (isOther) {
        this.inboxCategories = Category.inboxOtherCategorys().map(categoryNum => `${categoryNum}`);
      } else {
        this.inboxCategories = Category.inboxNotOtherCategorys().map(
          categoryNum => `${categoryNum}`
        );
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
