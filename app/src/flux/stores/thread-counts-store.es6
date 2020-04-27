import _ from 'underscore';
import MailspringStore from 'mailspring-store';
import DatabaseStore from './database-store';
import Thread from '../models/thread';
import ThreadCounts from '../models/thread-counts';
import ThreadCategory from '../models/thread-category';
import Category from '../models/category';
import CategoryStore from './category-store';
import Matcher from '../attributes/matcher';
import JoinTable from '../models/join-table';
let _accountStore = null;
const AccountStore = () => {
  return _accountStore || require('./account-store').default;
};

const EnableFocusedInbox = 'core.workspace.enableFocusedInbox'

class ThreadCountsStore extends MailspringStore {
  constructor() {
    super();
    this._counts = {};

    if (AppEnv.isMainWindow()) {
      // For now, unread counts are only retrieved in the main window.
      this._onCountsChangedDebounced = _.throttle(this._onCountsChanged, 1000);
      DatabaseStore.listen(change => {
        if (
          change.objectClass === ThreadCounts.name ||
          change.objectClass === ThreadCategory.name ||
          change.objectClass === Thread.name
        ) {
          this._onCountsChangedDebounced();
        }
      });
      this.listenTo(CategoryStore, this._reCalculateTodayNumber);
      AppEnv.config.onDidChange(EnableFocusedInbox, this._reCalculateTodayNumber);
      this._onCountsChangedDebounced();
    }
  }

  _onCountsChanged = () => {
    DatabaseStore._query('SELECT * FROM `ThreadCounts`').then(results => {
      const nextCounts = {};
      for (const { categoryId, unread, total } of results) {
        nextCounts[categoryId] = { unread, total };
      }
      if (_.isEqual(nextCounts, this._counts)) {
        this._reCalculateTodayNumber();
        return;
      }
      this._counts = nextCounts;
      this._reCalculateTodayNumber();
      this.trigger();
    });
  };
  _getCategoryIds = accounts => {
    const categoryIds = [];
    if(!Array.isArray(accounts)){
      accounts = AccountStore().accounts();
    }
    accounts.forEach(account => {
      if (account) {
        const category = CategoryStore.getCategoryByRole(account.id, 'inbox');
        if (category) {
          categoryIds.push(category.id);
        }
      }
    });
    return categoryIds;
  };
  _populateTodayCount = ({todayType, result, resultType} = {}) =>{
    if(!this._counts[todayType]){
      this._counts[todayType]={unread: 0, total: 0};
    }
    if(resultType === 'unread'){
      this._counts[todayType].unread = result;
    } else {
      this._counts[todayType].total = result;
    }
  };
  _generateTodayViewQuery = (countType, categoryIds) => {
    const enableFocusedInboxKey = AppEnv.config.get(EnableFocusedInbox);
    const now = new Date();
    const startOfDay = new Date(now.toDateString());
    const whereOption = { state: 0 };
    if (enableFocusedInboxKey) {
      const notOtherCategorys = Category.inboxNotOtherCategorys().map(
        categoryNum => `${categoryNum}`
      );
      whereOption['inboxCategory'] = notOtherCategorys;
    }
    let query = DatabaseStore.count(Thread, whereOption);
    if (countType === 'unread' && categoryIds.length > 0) {
      const unreadMatchers = new Matcher.JoinAnd([
        Thread.attributes.categories.containsAny(categoryIds),
        JoinTable.useAttribute('unread', 'Number').equal(1),
        Thread.attributes.state.equal(0),
        JoinTable.useAttribute('lastDate', 'DateTime').greaterThan(startOfDay / 1000)
      ]);
      query = query.where([unreadMatchers]);
    }else if (countType === 'total' && categoryIds.length > 0) {
      const conditions = new Matcher.JoinAnd([
        Thread.attributes.categories.containsAny(categoryIds),
        Thread.attributes.state.equal(0),
        JoinTable.useAttribute('lastDate', 'DateTime').greaterThan(startOfDay / 1000)
      ]);
      query = query.where([conditions]);
    } else {
      query = query.where([Thread.attributes.lastMessageTimestamp.greaterThan(startOfDay / 1000)]);
    }
    return query;
  };
  _reCalculateTodayNumber = () => {
    let i = 0;
    const totalCount = AccountStore().accounts().length * 2;
    if(totalCount === 0){
      AppEnv.logDebug('No accounts found, no need to look for unread/total for today');
      return;
    }
    const calculateTotal = () => {
      const ret = {unread: 0, total: 0};
      AccountStore().accounts().forEach(account => {
        if(account){
          const id=`today-${account.id}`;
          if(this._counts[id]){
            ret.unread = ret.unread + this._counts[id].unread;
            ret.total = ret.total + this._counts[id].total;
          }
        }
      });
      this._counts['today-all'] = ret;
      this.trigger();
    };
    AccountStore().accounts().forEach(account => {
      if(!account){
        return;
      }
      const categoryIds = this._getCategoryIds([account]);
      if(categoryIds.length > 0){
        this._generateTodayViewQuery('total', categoryIds).then(ret => {
          this._populateTodayCount({todayType: `today-${account.id}`, result: ret, resultType: 'total'});
          i++;
          if (i === totalCount) {
            calculateTotal();
          }
        });
        this._generateTodayViewQuery('unread', categoryIds).then(ret => {
          this._populateTodayCount({todayType: `today-${account.id}`, result: ret, resultType: 'unread'});
          i++;
          if (i === totalCount) {
            calculateTotal();
          }
        });
      }
    });
  };

  unreadCountForCategoryId(catId) {
    if (this._counts[catId] === undefined) {
      return null;
    }
    return this._counts[catId]['unread'];
  }

  totalCountForCategoryId(catId) {
    if (this._counts[catId] === undefined) {
      return null;
    }
    return this._counts[catId]['total'];
  }
}

export default new ThreadCountsStore();
