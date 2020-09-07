/* eslint global-require: 0 */
/* eslint no-use-before-define: 0 */
import _ from 'underscore';
import Utils from './flux/models/utils';
import TaskFactory from './flux/tasks/task-factory';
import AccountStore from './flux/stores/account-store';
import CategoryStore from './flux/stores/category-store';
import DatabaseStore from './flux/stores/database-store';
import OutboxStore from './flux/stores/outbox-store';
import ThreadCountsStore from './flux/stores/thread-counts-store';
import MutableQuerySubscription from './flux/models/mutable-query-subscription';
import UnreadQuerySubscription from './flux/models/unread-query-subscription';
import Thread from './flux/models/thread';
import Message from './flux/models/message';
import Sift from './flux/models/sift';
import Category from './flux/models/category';
import Actions from './flux/actions';
import { LabelColorizer } from 'mailspring-component-kit';
import Matcher from './flux/attributes/matcher';
import JoinTable from './flux/models/join-table';

let WorkspaceStore = null;
let ChangeStarredTask = null;
let ChangeLabelsTask = null;
let ChangeFolderTask = null;
let ChangeUnreadTask = null;
let FocusedPerspectiveStore = null;
const EnableFocusedInboxKey = 'core.workspace.enableFocusedInbox';

// This is a class cluster. Subclasses are not for external use!
// https://developer.apple.com/library/ios/documentation/General/Conceptual/CocoaEncyclopedia/ClassClusters/ClassClusters.html

export default class MailboxPerspective {
  // Factory Methods
  static forNothing(data) {
    return new EmptyMailboxPerspective(data);
  }

  static forSingleAccount(accountId) {
    return new SingleAccountMailboxPerspective(accountId);
  }

  static forOutbox(accountsOrIds) {
    return new OutboxMailboxPerspective(accountsOrIds);
  }

  static forDrafts(accountsOrIds) {
    return new DraftsMailboxPerspective(accountsOrIds);
  }
  static forSiftCategory({ siftCategory, accountIds } = {}) {
    return new SiftMailboxPerspective({ siftCategory, accountIds });
  }

  static forAllMail(allMailCategory) {
    if (!Array.isArray(allMailCategory)) {
      allMailCategory = [allMailCategory];
    }
    return new AllMailMailboxPerspective(allMailCategory);
  }

  static forAllTrash(accountsOrIds) {
    const categories = CategoryStore.getCategoriesWithRoles(accountsOrIds, 'trash');
    if (Array.isArray(categories) && categories.length > 0) {
      return this.forCategories(categories);
    } else {
      return null;
    }
  }

  static forAttachments(accountIds) {
    return new AttachementMailboxPerspective(accountIds);
  }

  static forToday(accountIds) {
    const categories = [];
    accountIds.forEach(accountId => {
      const account = AccountStore.accountForId(accountId);
      if (account) {
        const category = CategoryStore.getCategoryByRole(accountId, 'inbox');
        if (category) {
          categories.push(category);
        }
      }
    });
    if (categories.length === 0) {
      AppEnv.reportError(new Error('Today view cannot find inbox category'), {
        errorData: {
          accountIds,
          categories: CategoryStore.categories(),
        },
      });
      return this.forNothing();
    }
    let ret;
    try {
      ret = new TodayMailboxPerspective(categories);
    } catch (e) {
      ret = this.forNothing();
      AppEnv.reportError(new Error('Today view perspective error'), {
        errorData: {
          error: e,
          accountIds,
          categories: CategoryStore.categories(),
        },
      });
    }
    return ret;
  }

  static forCategory(category) {
    return category ? new CategoryMailboxPerspective([category]) : this.forNothing();
  }
  static forAllArchived(categories) {
    return categories.length > 0
      ? new AllArchiveCategoryMailboxPerspective(categories)
      : this.forNothing();
  }

  static forAllSent(categories) {
    return categories.length > 0 ? new AllSentMailboxPerspective(categories) : this.forNothing();
  }

  static forCategories(categories) {
    return categories.length > 0 ? new CategoryMailboxPerspective(categories) : this.forNothing();
  }
  static forNoneSelectableCategories(categories) {
    return categories.length > 0 ? new NoneSelectablePerspective(categories) : this.forNothing();
  }

  static forStandardCategories(accountsOrIds, ...names) {
    const categories = CategoryStore.getCategoriesWithRoles(accountsOrIds, ...names);
    if (Array.isArray(categories) && categories.length > 0) {
      return this.forCategories(categories);
    } else {
      return this.forNothing();
    }
  }

  static forStarred(accountIds) {
    if (
      Array.isArray(accountIds) &&
      accountIds.length > 0 &&
      accountIds.every(id => typeof id === 'string')
    ) {
      return new StarredMailboxPerspective(accountIds);
    } else {
      return this.forNothing();
    }
  }

  static forUnread(categories) {
    return categories.length > 0 ? new UnreadMailboxPerspective(categories) : this.forNothing();
  }

  static forJira(categories) {
    return categories.length > 0 ? new JiraMailboxPerspective(categories) : this.forNothing();
  }

  static forInboxFocused(categories) {
    return categories.length > 0
      ? new InboxMailboxFocusedPerspective(categories)
      : this.forNothing();
  }

  static forInboxOther(categories) {
    return categories.length > 0 ? new InboxMailboxOtherPerspective(categories) : this.forNothing();
  }

  static forUnreadFocused(categories) {
    return categories.length > 0
      ? new UnreadMailboxFocusedPerspective(categories)
      : this.forNothing();
  }

  static forUnreadOther(categories) {
    return categories.length > 0
      ? new UnreadMailboxOtherPerspective(categories)
      : this.forNothing();
  }

  static forUnreadByAccounts(accountIds) {
    let categories = accountIds.map(accId => {
      return CategoryStore.getCategoryByRole(accId, 'inbox');
    });

    // NOTE: It's possible for an account to not yet have an `inbox`
    // category. Since the `SidebarStore` triggers on `AccountStore`
    // changes, it'll trigger the exact moment an account is added to the
    // config. However, the API has not yet come back with the list of
    // `categories` for that account.
    categories = _.compact(categories);
    return MailboxPerspective.forUnread(categories);
  }

  static getCategoryIds = (accountsOrIds, categoryName) => {
    const categoryIds = [];
    for (let accountId of accountsOrIds) {
      let tmp = CategoryStore.getCategoryByRole(accountsOrIds, categoryName);
      if (tmp) {
        categoryIds.push(tmp.id);
      }
    }
    if (categoryIds.length > 0) {
      return categoryIds.slice();
    } else {
      return undefined;
    }
  };

  static forSent(accountsOrIds) {
    let cats = [];
    for (let accountId of accountsOrIds) {
      let tmp = CategoryStore.getCategoryByRole(accountId, 'sent');
      if (tmp) {
        cats.push(tmp);
      }
    }
    let perspective;
    if (cats.length > 1) {
      perspective = MailboxPerspective.forAllSent(cats);
    } else {
      perspective = MailboxPerspective.forCategories(cats);
    }
    if (Array.isArray(accountsOrIds) && accountsOrIds.length > 1) {
      perspective.displayName = 'All Sent';
    }
    perspective.iconName = 'sent.svg';
    perspective.categoryIds = MailboxPerspective.getCategoryIds(accountsOrIds, 'sent');
    return perspective;
  }

  static forInbox(accountsOrIds) {
    const perspective = this.forStandardCategories(accountsOrIds, 'inbox');
    perspective.iconName = 'all-mail.svg';
    if (accountsOrIds.length > 1) {
      perspective.displayName = 'All Inboxes';
      perspective.iconName = 'account-logo-edison.png';
    }
    perspective.categoryIds = this.getCategoryIds(accountsOrIds, 'inbox');
    return perspective;
  }

  static fromJSON(json) {
    try {
      if (json.type === InboxMailboxFocusedPerspective.name) {
        const categories = JSON.parse(json.serializedCategories).map(Utils.convertToModel);
        return this.forInboxFocused(categories);
      }
      if (json.type === InboxMailboxOtherPerspective.name) {
        const categories = JSON.parse(json.serializedCategories).map(Utils.convertToModel);
        return this.forInboxOther(categories);
      }
      if (json.type === UnreadMailboxFocusedPerspective.name) {
        const categories = JSON.parse(json.serializedCategories).map(Utils.convertToModel);
        return this.forUnreadFocused(categories);
      }
      if (json.type === UnreadMailboxOtherPerspective.name) {
        const categories = JSON.parse(json.serializedCategories).map(Utils.convertToModel);
        return this.forUnreadOther(categories);
      }
      if (json.type === TodayMailboxPerspective.name) {
        const categories = JSON.parse(json.serializedCategories).map(Utils.convertToModel);
        if (Array.isArray(categories) && categories.length > 0) {
          return MailboxPerspective.forToday(categories.map(cat => cat.accountId));
        }
      }
      if (json.type === AllSentMailboxPerspective.name) {
        const categories = JSON.parse(json.serializedCategories).map(Utils.convertToModel);
        return MailboxPerspective.forAllSent(categories);
      }
      if (json.type === AllArchiveCategoryMailboxPerspective.name) {
        const categories = JSON.parse(json.serializedCategories).map(Utils.convertToModel);
        return this.forAllArchived(categories);
      }
      if (json.type === UnreadMailboxPerspective.name) {
        const categories = JSON.parse(json.serializedCategories).map(Utils.convertToModel);
        return this.forUnread(categories);
      }
      if (json.type === StarredMailboxPerspective.name) {
        return this.forStarred(json.accountIds);
      }
      if (json.type === DraftsMailboxPerspective.name) {
        return this.forDrafts(json.accountIds);
      }
      if (json.type === SiftMailboxPerspective.name) {
        const data = JSON.parse(json.serializedCategories);
        return this.forSiftCategory({
          siftCategory: data.siftCategory,
          accountsOrIds: json.accountIds,
        });
      }
      if (json.type === CategoryMailboxPerspective.name) {
        const categories = JSON.parse(json.serializedCategories).map(Utils.convertToModel);
        return this.forCategories(categories);
      }
      return this.forInbox(json.accountIds);
    } catch (error) {
      AppEnv.reportError(new Error(`Could not restore mailbox perspective: ${error}`));
      return null;
    }
  }

  // Instance Methods

  constructor(accountIds) {
    this.accountIds = accountIds;
    if (
      !(accountIds instanceof Array) ||
      !accountIds.every(aid => typeof aid === 'string' || typeof aid === 'number')
    ) {
      throw new Error(`${this.constructor.name}: You must provide an array of string "accountIds"`);
    }
    this._displayName = null;
  }

  get providers() {
    if (this.accountIds.length > 0) {
      return this.accountIds.map(aid => {
        const account = AccountStore.accountForId(aid);
        if (account) {
          return { accountId: account.id, provider: account.provider };
        } else {
          return {};
        }
      });
    } else {
      return [];
    }
  }

  providerByAccountId(accountId) {
    if (!accountId) {
      return null;
    }
    return this.providers.find(provider => {
      return provider.accountId === accountId;
    });
  }

  get displayName() {
    return this._displayName;
  }

  set displayName(value) {
    this._displayName = value;
  }

  toJSON() {
    return { accountIds: this.accountIds, type: this.constructor.name };
  }

  isEqual(other) {
    if (!other || this.constructor !== other.constructor) {
      return false;
    }
    if (other.name !== this.name) {
      return false;
    }
    if (!_.isEqual(this.accountIds, other.accountIds)) {
      return false;
    }
    return true;
  }

  isDrafts() {
    return this.categoriesSharedRole() === 'drafts';
  }

  isInbox() {
    return this.categoriesSharedRole() === 'inbox';
  }

  isSent() {
    return this.categoriesSharedRole() === 'sent';
  }

  isTrash() {
    return this.categoriesSharedRole() === 'trash';
  }

  isSpam() {
    return this.categoriesSharedRole() === 'spam';
  }

  isArchive() {
    return false;
  }

  emptyMessage() {
    return 'No Message';
  }

  emptyListIcon() {
    return '';
  }

  categories() {
    return [];
  }

  sheet() {
    if (!WorkspaceStore || !WorkspaceStore.Sheet) {
      WorkspaceStore = require('./flux/stores/workspace-store');
    }
    return WorkspaceStore.Sheet && WorkspaceStore.Sheet.Threads;
  }

  // overwritten in CategoryMailboxPerspective
  hasSyncingCategories() {
    return false;
  }

  categoriesSharedRole() {
    this._categoriesSharedRole =
      this._categoriesSharedRole || Category.categoriesSharedRole(this.categories());
    return this._categoriesSharedRole;
  }

  category() {
    return this.categories().length === 1 ? this.categories()[0] : null;
  }

  getPath() {
    const ret = [];
    for (const category of this.categories()) {
      if (AccountStore.accountForId(category.accountId).provider === 'gmail') {
        ret.push({
          accountId: category.accountId,
          path: category.path.replace('[Gmail]/', ''),
          displayName: category.displayName,
          role: category.role,
        });
      } else {
        ret.push({
          role: category.role,
          accountId: category.accountId,
          path: category.path,
          parentId: category.parentId,
          displayName: category.displayName,
        });
      }
    }
    return ret;
  }

  threads() {
    throw new Error('threads: Not implemented in base class.');
  }

  unreadCount() {
    return 0;
  }

  // Public:
  // - accountIds {Array} Array of unique account ids associated with the threads
  // that want to be included in this perspective
  //
  // Returns true if the accountIds are part of the current ids, or false
  // otherwise. This means that it checks if I am attempting to move threads
  // between the same set of accounts:
  //
  // E.g.:
  // perpective = Starred for accountIds: a1, a2
  // thread1 has accountId a3
  // thread2 has accountId a2
  //
  // perspective.canReceiveThreadsFromAccountIds([a2, a3]) -> false -> I cant move those threads to Starred
  // perspective.canReceiveThreadsFromAccountIds([a2]) -> true -> I can move that thread to Starred
  canReceiveThreadsFromAccountIds(accountIds) {
    if (!accountIds || accountIds.length === 0) {
      return false;
    }
    const areIncomingIdsInCurrent = _.difference(accountIds, this.accountIds).length === 0;
    return areIncomingIdsInCurrent;
  }

  receiveThreadIds(threadIds) {
    DatabaseStore.modelify(Thread, threadIds).then(threads => {
      const tasks = TaskFactory.tasksForThreadsByAccountId(threads, (accountThreads, accountId) => {
        return this.actionsForReceivingThreads(accountThreads, accountId);
      });
      if (tasks.length > 0) {
        Actions.queueTasks(tasks);
      }
    });
  }

  actionsForReceivingThreads(threads, accountId) {
    // eslint-disable-line
    throw new Error('actionsForReceivingThreads: Not implemented in base class.');
  }

  canArchiveThreads(threads) {
    if (this.isArchive()) {
      return false;
    }
    const accounts = AccountStore.accountsForItems(threads);
    return (
      accounts.every(acc => acc.canArchiveThreads()) &&
      threads.every(thread => {
        const account = AccountStore.accountForId(thread.accountId);
        if (account && account.provider === 'gmail') {
          if (this.isInbox()) {
            // make sure inbox label can archive
            // if (!thread.labels.some(label => label.role === 'inbox')) {
            //   console.error(`The thread in inbox, but do not have inbox label. Thread id is ${thread.id}. subject is [${thread.subject}]`);
            //   AppEnv.reportError(
            //     new Error(`The thread in inbox, but do not have inbox label. Thread id is ${thread.id}`)
            //   );
            // }
            return true;
          }
          return thread.labels.some(label => label.role === 'inbox');
        } else {
          return true;
        }
      })
    );
  }

  canTrashThreads(threads) {
    return this.canMoveThreadsTo(threads, 'trash');
  }

  canMoveThreadsTo(threads, standardCategoryName) {
    if (this.categoriesSharedRole() === standardCategoryName) {
      return false;
    }
    return AccountStore.accountsForItems(threads).every(
      acc => CategoryStore.getCategoryByRole(acc, standardCategoryName) !== null
    );
  }

  canExpungeThreads(threads) {
    if (this.categoriesSharedRole() === 'trash') {
      return true;
    }

    // if searching in trash
    if (this.sourcePerspective && this.sourcePerspective.categoriesSharedRole() === 'trash') {
      return true;
    }

    const categories = this.categories();
    if (Array.isArray(categories) && categories.length === 1 && categories[0]) {
      const category = categories[0];
      const account = AccountStore.accountForId(category.accountId);
      const isExchange = AccountStore.isExchangeAccount(account);
      const trashCategory = CategoryStore.getCategoryByRole(category.accountId, 'trash');
      if (!isExchange) {
        if (trashCategory) {
          if (trashCategory.isParentOf(category) || trashCategory.isAncestorOf(category)) {
            return true;
          }
        }
      } else {
        if (CategoryStore.isCategoryAParentOfB(trashCategory, category)) {
          return true;
        }
      }
    }

    return false;
  }

  tasksForRemovingItems(threads) {
    if (!(threads instanceof Array)) {
      throw new Error('tasksForRemovingItems: you must pass an array of threads or thread ids');
    }
    return [];
  }
}

class SingleAccountMailboxPerspective extends MailboxPerspective {
  constructor(accountId) {
    super([accountId]);
    this.iconName = 'inbox.png';
  }
}

class OutboxMailboxPerspective extends MailboxPerspective {
  constructor(accountIds) {
    super(accountIds);
    this.name = 'Outbox';
    this.iconName = 'outbox.svg';
    this.outbox = true; // The OutboxStore looks for this
    this._categories = [];
  }

  categories() {
    return this._categories;
  }

  threads() {
    return null;
  }

  unreadCount() {
    const ret = OutboxStore.count();
    if (ret.failed > 0) {
      return ret.failed;
    }
    return ret.total;
  }

  canReceiveThreadsFromAccountIds() {
    return false;
  }
  canArchiveThreads(threads) {
    return false;
  }
  canMoveThreadsTo(threads, standardCategoryName) {
    return true;
  }

  tasksForRemovingItems(messages, source) {
    return TaskFactory.tasksForDestroyingDraft({ messages, source });
  }

  sheet() {
    if (!WorkspaceStore || !WorkspaceStore.Sheet) {
      WorkspaceStore = require('./flux/stores/workspace-store');
    }
    return WorkspaceStore.Sheet && WorkspaceStore.Sheet.Outbox;
  }
}

class DraftsMailboxPerspective extends MailboxPerspective {
  constructor(accountIds) {
    super(accountIds);
    this.name = 'Drafts';
    this.iconName = 'drafts.svg';
    this.drafts = true; // The DraftListStore looks for this
    this._categories = [];
    for (const id of accountIds) {
      const cat = CategoryStore.getCategoryByRole(id, 'drafts');
      if (cat) {
        this._categories.push(cat);
      }
    }
    if (Array.isArray(accountIds) && accountIds.length > 1) {
      this.displayName = 'All Drafts';
    }
  }

  categories() {
    return this._categories;
  }

  threads() {
    return null;
  }

  unreadCount() {
    let sum = 0;
    if (Array.isArray(this.categoryIds)) {
      for (const catId of this.categoryIds) {
        sum += ThreadCountsStore.totalCountForCategoryId(catId);
      }
    }
    return sum;
  }

  canReceiveThreadsFromAccountIds() {
    return false;
  }

  tasksForRemovingItems(messages, source) {
    return TaskFactory.tasksForMovingToTrash({ messages, source });
  }

  sheet() {
    if (!WorkspaceStore || !WorkspaceStore.Sheet) {
      WorkspaceStore = require('./flux/stores/workspace-store');
    }
    return WorkspaceStore.Sheet && WorkspaceStore.Sheet.Drafts;
  }
}
class SiftMailboxPerspective extends MailboxPerspective {
  constructor({ siftCategory, accountIds = [''] } = {}) {
    super(accountIds);
    this.name = siftCategory;
    this.sift = true; // Mark this perspective as sift;
    this.siftCategory = siftCategory;
    if (siftCategory === Sift.categories.Travel) {
      this.iconName = 'menu-travel.svg';
      this.className = 'sift sift-Travel';
    } else if (siftCategory === Sift.categories.Bill) {
      this.iconName = 'menu-finance.svg';
      this.className = 'sift sift-Bill';
    } else if (siftCategory === Sift.categories.Packages) {
      this.iconName = `menu-packages.svg`;
      this.className = 'sift sift-Packages';
    } else if (siftCategory === Sift.categories.Entertainment) {
      this.iconName = `menu-entertainment.svg`;
      this.className = 'sift sift-Entertainment';
    }
    this.iconStyles = { borderRadius: '50%' };
    this._categories = [];
  }

  threads() {
    return null;
  }
  messages() {
    const siftCategory = Sift.categoryStringToIntString(this.siftCategory);
    const query = DatabaseStore.findAll(Message)
      .where([Message.attributes.siftCategory.containsAnyAtColumn('category', [siftCategory])])
      .where({ deleted: false, draft: false })
      .order([Message.attributes.date.descending()])
      .page(0, 1)
      .distinct();
    return new MutableQuerySubscription(query, { emitResultSet: true });
  }
  canArchiveThreads() {
    return false;
  }

  canReceiveThreadsFromAccountIds() {
    return false;
  }

  sheet() {
    if (!WorkspaceStore || !WorkspaceStore.Sheet) {
      WorkspaceStore = require('./flux/stores/workspace-store');
    }
    return WorkspaceStore.Sheet && WorkspaceStore.Sheet.Sift;
  }

  toJSON() {
    const json = super.toJSON();
    json.serializedCategories = JSON.stringify({ siftCategory: this.siftCategory });
    return json;
  }

  emptyListIcon() {
    if (this.siftCategory === Sift.categories.Bill) {
      return 'sift-bills-and-receipts-animation';
    } else if (this.siftCategory === Sift.categories.Travel) {
      return 'sift-travel-animation';
    } else if (this.siftCategory === Sift.categories.Packages) {
      return 'sift-packages-animation';
    } else {
      return 'sift-entertainment-animation';
    }
  }
}

class StarredMailboxPerspective extends MailboxPerspective {
  constructor(accountIds) {
    super(accountIds);
    this.starred = true;
    this.name = 'Flagged';
    this.iconName = 'flag.svg';
  }

  gmailThreads() {
    const categoryIds = [];
    this.accountIds.forEach(accountId => {
      const cat = CategoryStore.categories(accountId).filter(cat => cat.role === 'flagged');
      if (Array.isArray(cat) && cat[0]) {
        categoryIds.push(cat[0].id);
      } else {
        AppEnv.reportError(new Error(`No starred found for gmail account`), {
          errorData: CategoryStore.categories(accountId),
        });
      }
    });
    if (categoryIds.length === 0) {
      return null;
    }
    const query = DatabaseStore.findAll(Thread)
      .where([Thread.attributes.categories.containsAny(categoryIds)])
      .where({ inAllMail: true, state: 0 })
      .limit(0);
    return new MutableQuerySubscription(query, { emitResultSet: true });
  }

  threads() {
    if (this.providers.every(item => item.provider === 'gmail')) {
      const querySub = this.gmailThreads();
      if (querySub) {
        return querySub;
      }
    }
    const query = DatabaseStore.findAll(Thread)
      .where([
        Thread.attributes.starred.equal(true),
        Thread.attributes.inAllMail.equal(true),
        Thread.attributes.state.equal(0),
      ])
      .order([Thread.attributes.lastMessageTimestamp.descending()])
      .limit(0);

    // Adding a "account_id IN (a,b,c)" clause to our query can result in a full
    // table scan. Don't add the where clause if we know we want results from all.
    if (this.accountIds.length < AccountStore.accounts().length) {
      query.where(Thread.attributes.accountId.in(this.accountIds));
    }

    return new MutableQuerySubscription(query, { emitResultSet: true });
  }

  canReceiveThreadsFromAccountIds(...args) {
    return super.canReceiveThreadsFromAccountIds(...args);
  }

  actionsForReceivingThreads(threads, accountId) {
    ChangeStarredTask = ChangeStarredTask || require('./flux/tasks/change-starred-task').default;
    const task = new ChangeStarredTask({
      accountId,
      threads,
      starred: true,
      source: 'Dragged Into List',
    });
    Actions.queueTask(task);
  }

  tasksForRemovingItems(threads) {
    const tasks = TaskFactory.taskForInvertingStarred({
      threads: threads,
      source: 'Removed From List',
    });
    return tasks;
  }
}

class AttachementMailboxPerspective extends MailboxPerspective {
  constructor(accountIds) {
    super(accountIds);
    this.hasAttachment = true;
    this.name = 'Attachment';
    this.iconName = 'attachments.svg';
  }

  threads() {
    const query = DatabaseStore.findAll(Thread)
      .where(
        [Thread.attributes.hasAttachments.equal(true)],
        Thread.attributes.inAllMail.equal(true)
      )
      .limit(0);
    return new MutableQuerySubscription(query, { emitResultSet: true });
  }

  canReceiveThreadsFromAccountIds() {
    return false;
  }
}

class EmptyMailboxPerspective extends MailboxPerspective {
  constructor({ name = '', iconName = 'folder.svg' } = {}) {
    super([]);
    this.name = name;
    this.iconName = iconName;
  }

  threads() {
    // We need a Thread query that will not return any results and take no time.
    // We use lastMessageReceivedTimestamp because it is the first column on an
    // index so this returns zero items nearly instantly. In the future, we might
    // want to make a Query.forNothing() to go along with MailboxPerspective.forNothing()
    const query = DatabaseStore.findAll(Thread)
      .where({ lastMessageTimestamp: -1 })
      .limit(0);
    return new MutableQuerySubscription(query, { emitResultSet: true });
  }

  canReceiveThreadsFromAccountIds() {
    return false;
  }
}

class CategoryMailboxPerspective extends MailboxPerspective {
  constructor(_categories) {
    super(_.uniq(_categories.map(c => c.accountId)));
    this._categories = _categories;

    if (this._categories.length === 0) {
      throw new Error('CategoryMailboxPerspective: You must provide at least one category.');
    }
    this._parseCategories();
  }
  _parseCategories = () => {
    if (AccountStore.isExchangeAccountId(this._categories[0].accountId)) {
      this.name = this._categories[0].displayName;
    } else {
      this.name = this._categories[0].roleDisplayName;
    }
    if (this._categories[0].role) {
      this.iconName = `${this._categories[0].role}.svg`;
    } else {
      this.iconName = this._categories[0].isLabel() ? 'label.svg' : 'folder.svg';
      if (this.iconName === 'label.svg') {
        const bgColor = LabelColorizer.backgroundColor(this._categories[0]);
        this.bgColor = bgColor;
      }
    }
    if (
      this.isInbox() &&
      this.constructor === CategoryMailboxPerspective &&
      AppEnv.config.get(EnableFocusedInboxKey)
    ) {
      this.tab = [
        new InboxMailboxFocusedPerspective(this._categories),
        new InboxMailboxOtherPerspective(this._categories),
      ];
    }
  };
  updateCategories = categories => {
    if (!Array.isArray(categories) || categories.length === 0) {
      AppEnv.logError(
        new Error('CategoryMailboxPerspective: You must provide at least one category.')
      );
      return;
    }
    this._categories = categories;
    if (this._categories[0]) {
      if (AccountStore.isExchangeAccountId(this._categories[0].accountId)) {
        this.name = this._categories[0].displayName;
      } else {
        this.name = this._categories[0].roleDisplayName;
      }
    }
  };

  toJSON() {
    const json = super.toJSON();
    json.serializedCategories = JSON.stringify(this._categories);
    return json;
  }

  isEqual(other) {
    return (
      super.isEqual(other) &&
      _.isEqual(this.categories().map(c => c.id), other.categories().map(c => c.id))
    );
  }

  threads() {
    const categoryIds = [];
    this.categories().forEach(c => {
      if (!c.state) {
        //In case Category will also add state in future versions
        categoryIds.push(c.id);
      }
    });
    const query = DatabaseStore.findAll(Thread)
      .where([Thread.attributes.categories.containsAny(categoryIds)])
      .limit(0);

    if (this.isSent()) {
      query.order(Thread.attributes.lastMessageTimestamp.descending());
    }

    if (!['spam', 'trash', 'inbox'].includes(this.categoriesSharedRole())) {
      query.where({ inAllMail: true, state: 0 });
    } else {
      query.where({ state: 0 });
    }

    if (this.categoriesSharedRole() === 'trash') {
      query.forceShowDrafts = true;
    }

    // if (['spam', 'trash'].includes(this.categoriesSharedRole())) {
    //   query.where(new Matcher.Not([
    //     Thread.attributes.id.like('delete')
    //   ]));
    // }

    if (this._categories.length > 1 && this.accountIds.length < this._categories.length) {
      // The user has multiple categories in the same account selected, which
      // means our result set could contain multiple copies of the same threads
      // (since we do an inner join) and we need SELECT DISTINCT. Note that this
      // can be /much/ slower and we shouldn't do it if we know we don't need it.
      query.distinct();
    }

    return new MutableQuerySubscription(query, { emitResultSet: true });
  }

  unreadCount() {
    const enableFocusedInboxKey = AppEnv.config.get(EnableFocusedInboxKey);
    let sum = 0;
    for (const cat of this._categories) {
      if (this.isInbox()) {
        const categorieId = enableFocusedInboxKey ? `${cat.accountId}_Focused` : cat.id;
        sum += ThreadCountsStore.unreadCountForCategoryId(categorieId);
      } else {
        sum += ThreadCountsStore.unreadCountForCategoryId(cat.id);
      }
    }
    return sum;
  }

  categories() {
    return this._categories;
  }

  hasSyncingCategories() {
    return this._categories.some(cat => {
      return CategoryStore.isCategorySyncing(cat.id);
    });
  }

  isArchive() {
    return this._categories.every(cat => cat.isArchive());
  }

  canReceiveThreadsFromAccountIds(...args) {
    return (
      super.canReceiveThreadsFromAccountIds(...args) &&
      !this._categories.some(c => c.isLockedCategory())
    );
  }

  actionsForReceivingThreads(threads, accountId) {
    FocusedPerspectiveStore =
      FocusedPerspectiveStore || require('./flux/stores/focused-perspective-store').default;
    ChangeLabelsTask = ChangeLabelsTask || require('./flux/tasks/change-labels-task').default;
    ChangeFolderTask = ChangeFolderTask || require('./flux/tasks/change-folder-task').default;
    ChangeStarredTask = ChangeStarredTask || require('./flux/tasks/change-starred-task').default;

    const current = FocusedPerspectiveStore.current();

    // This assumes that the we don't have more than one category per
    // accountId attached to this perspective
    // Even though most of the time it doesn't make much sense to move "send/draft"
    // mails around to other folder/labels, but if the user want to they should be able to
    // if (Category.LockedRoles.includes(current.categoriesSharedRole())) {
    //   return [];
    // }

    const myCat = this.categories().find(c => c.accountId === accountId);
    const currentCat = current.categories().find(c => c.accountId === accountId);

    // Don't drag and drop on ourselves
    // NOTE: currentCat can be nil in case of SearchPerspective
    if (currentCat && myCat.id === currentCat.id) {
      return [];
    }
    const previousFolder = TaskFactory.findPreviousFolder(current, accountId);
    return TaskFactory.tasksForGeneralMoveFolder({
      threads,
      targetCategory: myCat,
      sourceCategory: currentCat,
      previousFolder,
      source: 'Dragged into List',
    });
  }

  // Public:
  // Returns the tasks for removing threads from this perspective and moving them
  // to the default destination based on the current view:
  //
  // if you're looking at a folder:
  // - spam: null
  // - trash: null
  // - archive: trash
  // - all others: "finished category (archive or trash)"

  // if you're looking at a label
  // - if finished category === "archive" remove the label
  // - if finished category === "trash" move to trash folder, keep labels intact
  //
  tasksForRemovingItems(threads, source = 'Removed from list') {
    FocusedPerspectiveStore =
      FocusedPerspectiveStore || require('./flux/stores/focused-perspective-store').default;
    ChangeLabelsTask = ChangeLabelsTask || require('./flux/tasks/change-labels-task').default;
    ChangeFolderTask = ChangeFolderTask || require('./flux/tasks/change-folder-task').default;

    // TODO this is an awful hack
    const role = this.isArchive() ? 'archive' : this.categoriesSharedRole();

    if (role === 'spam' || role === 'trash') {
      return [];
    }

    if (role === 'archive') {
      return TaskFactory.tasksForMovingToTrash({ threads, source, currentPerspective: this });
    }

    return TaskFactory.tasksForThreadsByAccountId(threads, (accountThreads, accountId) => {
      const acct = AccountStore.accountForId(accountId);
      const preferred = acct.preferredRemovalDestination();
      if (!preferred && (acct.provider !== 'gmail' || acct.preferDelete())) {
        AppEnv.reportError(new Error('We cannot find our preferred removal destination'), {
          errorData: { account: acct, errorCode: 'folderNotAvailable' },
        });
        return;
      }
      const cat = this.categories().find(c => c.accountId === accountId);
      const currentPerspective = FocusedPerspectiveStore.current();
      const previousFolder = TaskFactory.findPreviousFolder(currentPerspective, accountId);
      if (cat.isLabel() && preferred && preferred.role !== 'trash') {
        const inboxCat = CategoryStore.getInboxCategory(accountId);
        return new ChangeLabelsTask({
          threads: accountThreads,
          labelsToAdd: [],
          labelsToRemove: [cat, inboxCat],
          source: source,
          previousFolder,
        });
      } else if (!preferred && acct.provider === 'gmail' && !acct.preferDelete() && cat.isLabel()) {
        const inboxCat = CategoryStore.getInboxCategory(accountId);
        return new ChangeLabelsTask({
          threads: accountThreads,
          labelsToAdd: [],
          labelsToRemove: [cat, inboxCat],
          source: source,
          previousFolder,
        });
      }
      if (preferred) {
        return new ChangeFolderTask({
          threads: accountThreads,
          folder: preferred,
          source: source,
          previousFolder,
        });
      }
    });
  }
}

class NoneSelectablePerspective extends CategoryMailboxPerspective {
  constructor(data) {
    super(data);
    this.noneSelectable = true;
  }
  threads() {
    // We need a Thread query that will not return any results and take no time.
    // We use lastMessageReceivedTimestamp because it is the first column on an
    // index so this returns zero items nearly instantly. In the future, we might
    // want to make a Query.forNothing() to go along with MailboxPerspective.forNothing()
    const query = DatabaseStore.findAll(Thread)
      .where({ lastMessageTimestamp: -1 })
      .limit(0);
    return new MutableQuerySubscription(query, { emitResultSet: true });
  }
  unreadCount() {
    return 0;
  }
  canReceiveThreadsFromAccountIds() {
    return false;
  }
  receiveThreadIds(threadIds) {
    return;
  }
  actionsForReceivingThreads(threads, accountId) {
    return;
  }
}
class AllSentMailboxPerspective extends CategoryMailboxPerspective {
  constructor(props) {
    super(props);
    this.name = 'All Sent';
    this.iconName = 'sent.svg';
    this.isAllSent = true;
  }
  toJSON() {
    const json = super.toJSON();
    json.isAllSent = true;
    return json;
  }
  isEqual(other) {
    return other.isAllSent;
  }
}
class TodayMailboxPerspective extends CategoryMailboxPerspective {
  constructor(categories) {
    super(categories);
    this.name = 'Today';
    this.iconName = 'today.svg';
    this._categories = categories;
    this.isToday = true;
  }
  categories() {
    return this._categories;
  }

  threads() {
    const isMessageView = AppEnv.isDisableThreading();
    let query = DatabaseStore.findAll(Thread, { state: 0 }).limit(0);
    const now = new Date();
    const startOfDay = new Date(now.toDateString());
    const categoryIds = [];
    this.categories().forEach(category => {
      if (category) {
        categoryIds.push(category.id);
      }
    });
    if (categoryIds.length > 0) {
      const lastMessageTimestampAttr = isMessageView
        ? Thread.attributes.lastMessageTimestamp.greaterThan(startOfDay / 1000)
        : JoinTable.useAttribute(Thread.attributes.lastMessageTimestamp, 'DateTime').greaterThan(
            startOfDay / 1000
          );
      const conditions = [
        Thread.attributes.categories.containsAny(categoryIds),
        lastMessageTimestampAttr,
        Thread.attributes.state.equal(0),
      ];
      const enableFocusedInboxKey = AppEnv.config.get(EnableFocusedInboxKey);
      if (enableFocusedInboxKey) {
        const notOtherCategories = Category.inboxNotOtherCategorys({ toString: true });
        const inboxCategoryAttr = isMessageView
          ? Thread.attributes.inboxCategory.in(notOtherCategories)
          : JoinTable.useAttribute(Thread.attributes.inboxCategory, 'Number').in(
              notOtherCategories
            );
        conditions.push(inboxCategoryAttr);
      }
      query = query.where([new Matcher.JoinAnd(conditions)]);
    } else {
      query = query.where([Thread.attributes.lastMessageTimestamp.greaterThan(startOfDay / 1000)]);
    }
    return new MutableQuerySubscription(query, { emitResultSet: true });
  }

  unreadCount() {
    if (this.accountIds.length > 1) {
      let sum = 0;
      this.accountIds.forEach(accountId => {
        sum += ThreadCountsStore.unreadCountForCategoryId(`${accountId}_Today`);
      });
      return sum;
    } else {
      return ThreadCountsStore.unreadCountForCategoryId(`${this.accountIds[0]}_Today`);
    }
  }

  canReceiveThreadsFromAccountIds() {
    return false;
  }
  receiveThreadIds(threadIds) {
    return;
  }
  actionsForReceivingThreads(threads, accountId) {
    return;
  }
}

class AllArchiveCategoryMailboxPerspective extends CategoryMailboxPerspective {
  constructor(data) {
    super(data);
    this.isAllArchive = true;
    this.displayName = 'All Archive';
  }
  toJSON() {
    const json = super.toJSON();
    json.isAllArchive = true;
    return json;
  }

  isEqual(other) {
    return other.isAllArchive;
  }
}

class AllMailMailboxPerspective extends CategoryMailboxPerspective {
  constructor(_categories) {
    super(_categories);
  }
  threads() {
    const query = DatabaseStore.findAll(Thread)
      .where({ inAllMail: true, state: 0, accountId: this.accountIds[0] })
      .order([Thread.attributes.lastMessageTimestamp.descending()])
      .limit(0);

    if (this._categories.length > 1 && this.accountIds.length < this._categories.length) {
      // The user has multiple categories in the same account selected, which
      // means our result set could contain multiple copies of the same threads
      // (since we do an inner join) and we need SELECT DISTINCT. Note that this
      // can be /much/ slower and we shouldn't do it if we know we don't need it.
      query.distinct();
    }

    return new MutableQuerySubscription(query, { emitResultSet: true });
  }
}

class JiraMailboxPerspective extends CategoryMailboxPerspective {
  constructor(_categories) {
    super(_categories);
  }
  unreadCount() {
    let sum = 0;
    for (const aid of this.accountIds) {
      sum += ThreadCountsStore.unreadCountForCategoryId(`${aid}_JIRA`);
    }
    return sum;
  }
  threads() {
    const query = DatabaseStore.findAll(Thread)
      .where({
        inAllMail: true,
        state: 0,
        isJIRA: true,
      })
      .order([Thread.attributes.lastMessageTimestamp.descending()])
      .limit(0);

    if (this._categories.length > 1 && this.accountIds.length < this._categories.length) {
      // The user has multiple categories in the same account selected, which
      // means our result set could contain multiple copies of the same threads
      // (since we do an inner join) and we need SELECT DISTINCT. Note that this
      // can be /much/ slower and we shouldn't do it if we know we don't need it.
      query.distinct();
    }

    return new MutableQuerySubscription(query, { emitResultSet: true });
  }
}

class UnreadMailboxPerspective extends CategoryMailboxPerspective {
  constructor(categories) {
    super(categories);
    this.unread = true;
    this.name = 'Unread';
    this.iconName = 'unread.svg';
    if (
      this.isInbox() &&
      this.constructor === UnreadMailboxPerspective &&
      AppEnv.config.get(EnableFocusedInboxKey)
    ) {
      this.tab = [
        new UnreadMailboxFocusedPerspective(this._categories),
        new UnreadMailboxOtherPerspective(this._categories),
      ];
    }
  }

  threads() {
    return new UnreadQuerySubscription(this.categories().map(c => c.id));
  }

  unreadCount() {
    const enableFocusedInboxKey = AppEnv.config.get(EnableFocusedInboxKey);
    let sum = 0;
    for (const cat of this._categories) {
      const categorieId = enableFocusedInboxKey ? `${cat.accountId}_Focused` : cat.id;
      sum += ThreadCountsStore.unreadCountForCategoryId(categorieId);
    }
    return sum;
  }

  actionsForReceivingThreads(threads, accountId) {
    ChangeUnreadTask = ChangeUnreadTask || require('./flux/tasks/change-unread-task').default;
    const tasks = super.actionsForReceivingThreads(threads, accountId);
    tasks.push(
      new ChangeUnreadTask({
        threads: threads,
        unread: true,
        source: 'Dragged Into List',
      })
    );
    return tasks;
  }

  tasksForRemovingItems(threads, ruleset, source) {
    ChangeUnreadTask = ChangeUnreadTask || require('./flux/tasks/change-unread-task').default;

    const tasks = super.tasksForRemovingItems(threads, ruleset, source);
    tasks.push(
      new ChangeUnreadTask({ threads, unread: false, source: source || 'Removed From List' })
    );
    return tasks;
  }
}

class InboxMailboxFocusedPerspective extends CategoryMailboxPerspective {
  constructor(categories) {
    super(categories);
    // const isAllInbox = categories && categories.length > 1;
    // this.name = `${isAllInbox ? 'All ' : ''}Focused`;
    this.name = `Focused`;
    this.isTab = true;
    this.isFocusedOtherPerspective = true;
  }

  isTabOfPerspective(other) {
    const tab = other.tab || [];
    return tab.some(per => {
      return this.isEqual(per);
    });
  }

  unreadCount() {
    let sum = 0;

    for (const accountId of this.accountIds) {
      sum += ThreadCountsStore.unreadCountForCategoryId(`${accountId}_Focused`);
    }

    return sum;
  }

  threads() {
    const categoryIds = [];
    this.categories().forEach(c => {
      if (!c.state) {
        //In case Category will also add state in future versions
        categoryIds.push(c.id);
      }
    });

    const notOtherCategories = Category.inboxNotOtherCategorys({ toString: true });
    const isMessageView = AppEnv.isDisableThreading();
    const inboxCategoryAttr = isMessageView
      ? Thread.attributes.inboxCategory.in(notOtherCategories)
      : JoinTable.useAttribute(Thread.attributes.inboxCategory, 'Number').in(notOtherCategories);
    const query = DatabaseStore.findAll(Thread)
      .where(
        new Matcher.JoinAnd([
          Thread.attributes.categories.containsAny(categoryIds),
          inboxCategoryAttr,
          Thread.attributes.state.equal(0),
        ])
      )
      .limit(0);

    if (this._categories.length > 1 && this.accountIds.length < this._categories.length) {
      // The user has multiple categories in the same account selected, which
      // means our result set could contain multiple copies of the same threads
      // (since we do an inner join) and we need SELECT DISTINCT. Note that this
      // can be /much/ slower and we shouldn't do it if we know we don't need it.
      query.distinct();
    }

    return new MutableQuerySubscription(query, { emitResultSet: true });
  }
}

class InboxMailboxOtherPerspective extends CategoryMailboxPerspective {
  constructor(categories) {
    super(categories);
    // const isAllInbox = categories && categories.length > 1;
    // this.name = `${isAllInbox ? 'All ' : ''}Other`;
    this.name = `Other`;
    this.isTab = true;
    this.isOther = true;
    this.isFocusedOtherPerspective = true;
  }

  isTabOfPerspective(other) {
    const tab = other.tab || [];
    return tab.some(per => {
      return this.isEqual(per);
    });
  }

  unreadCount() {
    let sum = 0;

    for (const accountId of this.accountIds) {
      sum += ThreadCountsStore.unreadCountForCategoryId(`${accountId}_Other`);
    }
    return sum;
  }

  threads() {
    const categoryIds = [];
    this.categories().forEach(c => {
      if (!c.state) {
        //In case Category will also add state in future versions
        categoryIds.push(c.id);
      }
    });

    const otherCategories = Category.inboxOtherCategorys().map(categoryNum => `${categoryNum}`);
    const isMessageView = AppEnv.isDisableThreading();
    const inboxCategoryAttr = isMessageView
      ? Thread.attributes.inboxCategory.in(otherCategories)
      : JoinTable.useAttribute(Thread.attributes.inboxCategory, 'Number').in(otherCategories);
    const query = DatabaseStore.findAll(Thread)
      .where(
        new Matcher.JoinAnd([
          Thread.attributes.categories.containsAny(categoryIds),
          inboxCategoryAttr,
          Thread.attributes.state.equal(0),
        ])
      )
      .limit(0);

    if (this._categories.length > 1 && this.accountIds.length < this._categories.length) {
      // The user has multiple categories in the same account selected, which
      // means our result set could contain multiple copies of the same threads
      // (since we do an inner join) and we need SELECT DISTINCT. Note that this
      // can be /much/ slower and we shouldn't do it if we know we don't need it.
      query.distinct();
    }

    return new MutableQuerySubscription(query, { emitResultSet: true });
  }
}

class UnreadMailboxFocusedPerspective extends UnreadMailboxPerspective {
  constructor(categories) {
    super(categories);
    this.name = `Focused`;
    this.isTab = true;
    this.isFocusedOtherPerspective = true;
  }

  isTabOfPerspective(other) {
    const tab = other.tab || [];
    return tab.some(per => {
      return this.isEqual(per);
    });
  }

  unreadCount() {
    // Unread tab hidden the num of unread
    return 0;
  }

  threads() {
    return new UnreadQuerySubscription(this.categories().map(c => c.id));
  }
}

class UnreadMailboxOtherPerspective extends UnreadMailboxPerspective {
  constructor(categories) {
    super(categories);
    this.name = `Other`;
    this.isTab = true;
    this.isOther = true;
    this.isFocusedOtherPerspective = true;
  }

  isTabOfPerspective(other) {
    const tab = other.tab || [];
    return tab.some(per => {
      return this.isEqual(per);
    });
  }

  unreadCount() {
    // Unread tab hidden the num of unread
    return 0;
  }

  threads() {
    return new UnreadQuerySubscription(this.categories().map(c => c.id), this.isOther);
  }
}
