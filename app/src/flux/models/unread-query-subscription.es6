import MutableQuerySubscription from './mutable-query-subscription';
import DatabaseStore from '../stores/database-store';
import RecentlyReadStore from '../stores/recently-read-store';
import Matcher from '../attributes/matcher';
import Thread from '../models/thread';
import Category from '../models/category';
import JoinTable from '../models/join-table';

const EnableFocusedInboxKey = 'core.workspace.enableFocusedInbox';

const buildQuery = (categoryIds, isOther) => {
  const unreadMatchers = new Matcher.JoinAnd([
    Thread.attributes.categories.containsAny(categoryIds),
    JoinTable.useAttribute('unread', 'Number').equal(1),
    Thread.attributes.state.equal(0),
  ]);

  const query = DatabaseStore.findAll(Thread).limit(0);

  // The "Unread" view shows all threads which are unread. When you read a thread,
  // it doesn't disappear until you leave the view and come back. This behavior
  // is implemented by keeping track of messages being read and manually
  // whitelisting them in the query.
  if (RecentlyReadStore.ids.length === 0) {
    query.where(unreadMatchers);
  } else {
    const whereOptions = [
      JoinTable.useAttribute('unread', 'Number').equal(1),
      Thread.attributes.state.equal(0),
    ];
    const enableFocusedInboxKey = AppEnv.config.get(EnableFocusedInboxKey);
    if (enableFocusedInboxKey) {
      const notOtherCategorys = Category.inboxNotOtherCategorys().map(
        categoryNum => `${categoryNum}`
      );
      const otherCategorys = Category.inboxOtherCategorys().map(categoryNum => `${categoryNum}`);
      whereOptions.push(
        JoinTable.useAttribute('primary', 'Number').in(isOther ? otherCategorys : notOtherCategorys)
      );
    }
    query.where(
      new Matcher.JoinAnd([
        Thread.attributes.categories.containsAny(categoryIds),
        new Matcher.JoinOr([
          new Matcher.JoinAnd(whereOptions),
          new Matcher.JoinAnd([
            JoinTable.useAttribute('threadId', 'String').in(RecentlyReadStore.ids),
            JoinTable.useAttribute('state', 'Number').equal(0),
          ]),
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
    this._unlisten = RecentlyReadStore.listen(this.onRecentlyReadChanged);
  }

  onRecentlyReadChanged = () => {
    const { limit, offset } = this._query.range();
    this._query = buildQuery(this._categoryIds, this.isOther)
      .limit(limit)
      .offset(offset);
  };

  onLastCallbackRemoved() {
    this._unlisten();
  }
}
