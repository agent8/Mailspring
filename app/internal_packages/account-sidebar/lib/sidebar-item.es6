import ThreadCategory from '../../../src/flux/models/thread-category';
import SidebarSection, { NEW_FOLDER_OBJECT, ADD_FOLDER_OBJECT } from './sidebar-section';
const _ = require('underscore');
const _str = require('underscore.string');
const { OutlineViewItem, RetinaImg } = require('mailspring-component-kit');
const {
  MailboxPerspective,
  FocusedPerspectiveStore,
  DestroyCategoryTask,
  CategoryStore,
  WorkspaceStore,
  Actions,
  AccountStore,
  DatabaseStore,
  TaskFactory,
  Constant,
} = require('mailspring-exports');

const SidebarActions = require('./sidebar-actions');

const idForCategories = categories => _.pluck(categories, 'id').join('-');

const countForItem = function(perspective) {
  const unreadCountEnabled = AppEnv.config.get('core.workspace.showUnreadForAllCategories');
  if (perspective.isInbox() || perspective.isDrafts() || unreadCountEnabled) {
    return perspective.unreadCount();
  }
  return 0;
};

const isChildrenSelected = (children = []) => {
  if (!children || children.length === 0) {
    return false;
  }
  for (let p of children) {
    if (p.id === ADD_FOLDER_OBJECT.id || p.id === NEW_FOLDER_OBJECT.id) {
      return true;
    }
    if (p.id !== 'moreToggle' && isItemSelected(p.perspective, p.children)) {
      return true;
    }
  }
  return false;
};
//
// const isTabSelected = (perspective, currentPerspective) => {
//   if (!perspective) {
//     console.error(new Error('no perspective'));
//   }
//   if (!perspective.tab || perspective.tab.length === 0) {
//     return false;
//   }
//   for (const tab of perspective.tab) {
//     if (tab && tab.isEqual(currentPerspective)) {
//       return true;
//     }
//   }
//   return false;
// };

const isItemSelected = (perspective, children = []) => {
  const sheet = WorkspaceStore.topSheet();
  if (
    sheet &&
    !['Threads', 'Thread', 'Drafts', 'Outbox', 'Preference', 'Sift'].includes(sheet.id)
  ) {
    return false;
  }

  const currentSidebar = FocusedPerspectiveStore.currentSidebar();
  if (currentSidebar.isEqual(perspective)) {
    return true;
  }

  return isChildrenSelected(children, currentSidebar);
};

const isItemCollapsed = function(id) {
  if (AppEnv.savedState.sidebarKeysCollapsed[id] !== undefined) {
    return AppEnv.savedState.sidebarKeysCollapsed[id];
  } else {
    return true;
  }
};

const toggleItemCollapsed = function(item) {
  if (!(item.children.length > 0)) {
    return;
  }
  if (item.syncFolderList && item.children.length > 0 && item.collapsed) {
    Actions.syncFolderList({ accountIds: item.accountIds, source: 'toggleItemCollapsed' });
  }
  SidebarActions.setKeyCollapsed(item.id, !isItemCollapsed(item.id));
};
const onChangeAllToRead = function(item) {
  if (!item.perspective.canChangeAllToRead()) {
    return;
  }
  const tasks = item.perspective.tasksForChangeAllToRead();
  if (tasks.length > 0) {
    Actions.queueTasks(tasks);
  }
};
const toggleItemHide = item => {
  if (item.perspective.isHidden()) {
    item.perspective.show();
  } else {
    item.perspective.hide();
  }
};

const onDeleteItem = function(item) {
  if (item.deleted === true) {
    return;
  }
  if (item.children.length > 0) {
    _.defer(() => {
      AppEnv.showErrorDialog({
        title: `Cannot delete ${(item.contextMenuLabel || item.name).toLocaleLowerCase()}`,
        message: `Must delete sub-${(
          item.contextMenuLabel || item.name
        ).toLocaleLowerCase()} first`,
      });
    });
    return;
  }
  const category = item.perspective.category();
  if (!category) {
    return;
  }
  const account = AccountStore.accountForId(category.accountId);
  if (account && (account.provider === 'gmail' || account.provider === 'onmail')) {
    Actions.queueTask(
      new DestroyCategoryTask({
        path: category.path,
        name: category.name,
        accountId: category.accountId,
      })
    );
    return;
  }
  DatabaseStore.findAll(ThreadCategory)
    .where({ categoryId: category.id, state: 0 })
    .count()
    .then(count => {
      if (count === 0) {
        Actions.queueTask(
          new DestroyCategoryTask({
            path: category.path,
            name: category.name,
            accountId: category.accountId,
          })
        );
      } else {
        _.defer(() => {
          AppEnv.showErrorDialog({
            title: `Cannot delete ${(item.contextMenuLabel || item.name).toLocaleLowerCase()}`,
            message: `Must empty ${(item.contextMenuLabel || item.name).toLocaleLowerCase()} first`,
          });
        });
      }
    });
};

const onEditItem = function(item, newEnteredValue, originalText) {
  let newDisplayName;
  if (!newEnteredValue) {
    return;
  }
  if (item.deleted === true) {
    return;
  }
  const category = item.perspective.category();
  if (!category) {
    return;
  }
  const account = AccountStore.accountForId(category.accountId);
  const isExchange = AccountStore.isExchangeAccount(account);
  if (isExchange) {
    newDisplayName = newEnteredValue;
  } else {
    let index = (category.fullDisplayName || '').lastIndexOf(originalText);
    if (index === -1) {
      index = category.fullDisplayName.length;
      AppEnv.logError(
        new Error(
          `Original Text not in original path text: ${originalText}, path: ${category.path}`
        )
      );
    }
    newDisplayName = `${(category.fullDisplayName || '').substring(0, index)}${newEnteredValue}`;
  }
  // const re = RegExpUtils.subcategorySplitRegex();
  // let match = re.exec(category.displayName);
  // let lastMatch = match;
  // while (match) {
  //   lastMatch = match;
  //   match = re.exec(category.displayName);
  // }
  // if (lastMatch) {
  //   newDisplayName = category.displayName.slice(0, lastMatch.index + 1) + value;
  // } else {
  //   newDisplayName = value;
  // }
  if (newDisplayName === category.displayName) {
    return;
  }
  const task = TaskFactory.tasksForRenamingPath({
    existingPath: category.path,
    newName: newDisplayName,
    accountId: category.accountId,
  });
  if (task) {
    Actions.queueTask(task);
  }
};

class SidebarItem {
  static forPerspective(id, perspective, opts = {}) {
    let counterStyle;
    if (perspective.isInbox()) {
      counterStyle = OutlineViewItem.CounterStyles.Alt;
    }
    if (opts) {
      perspective = Object.assign(perspective, opts);
    }
    const collapsed =
      opts.forceExpand !== undefined
        ? !opts.forceExpand
        : isItemCollapsed(opts.parentId ? `${opts.parentId}-${id}` : id);

    const ret = Object.assign(
      {
        selfId: id,
        _parentId: opts.parentId,
        get parentId() {
          return this._parentId ? `${this._parentId}-` : '';
        },
        set parentId(val) {
          this._parentId = val;
        },
        get id() {
          return `${this.parentId}${this.selfId}`;
        },
        // As we are not sure if 'Drafts-' as id have any special meaning, we are adding categoryIds
        categoryIds: opts.categoryIds ? opts.categoryIds : undefined,
        accountIds: perspective.accountIds,
        name: perspective.name,
        path: perspective.getPath(),
        displayName: perspective.displayName,
        get displayOrder() {
          return perspective.getDisplayOrder();
        },
        get categoryMetaDataInfo() {
          const info = perspective.categoryMetaDataInfo();
          info.displayOrder = this.displayOrder;
          info.isHidden = this.isHidden;
          return info;
        },
        toggleHide: toggleItemHide,
        isHidden: perspective.isHidden(),
        hideOnEditingMenu: opts.hideOnEditingMenu || false,
        threadTitleName: perspective.threadTitleName,
        contextMenuLabel: perspective.displayName,
        count: countForItem(perspective),
        iconName: perspective.iconName,
        bgColor: perspective.bgColor,
        iconColor: perspective.iconColor || perspective.bgColor,
        className: perspective.className,
        mode: perspective.mode,
        iconStyles: perspective.iconStyles,
        children: [],
        perspective,
        selected: isItemSelected(perspective, opts.children),
        collapsed: collapsed != null ? collapsed : true,
        counterStyle,
        onDelete: opts.deletable ? onDeleteItem : undefined,
        onEdited: opts.editable ? onEditItem : undefined,
        syncFolderList: opts.syncFolderList,
        onCollapseToggled: toggleItemCollapsed,
        onAllRead: perspective.canChangeAllToRead() ? onChangeAllToRead : undefined,
        onAddNewFolder: opts.onAddNewFolder ? opts.onAddNewFolder : undefined,
        addNewFolderLabel: opts.addNewFolderLabel,

        onDrop(item, event) {
          const threadsString = event.dataTransfer.getData('edison-threads-data');
          const categoryString = event.dataTransfer.getData(
            Constant.DROP_DATA_TYPE.FOLDER_TREE_ITEM
          );
          let jsonData = null;
          try {
            if (threadsString.length > 0) {
              jsonData = JSON.parse(threadsString);
            } else if (categoryString.length > 0) {
              jsonData = JSON.parse(categoryString);
            }
          } catch (err) {
            AppEnv.reportError(new Error(`JSON parse error: ${err}`));
          }
          if (!jsonData) {
            return;
          }
          if (threadsString.length > 0) {
            item.perspective.receiveThreadIds(jsonData.threadIds);
          } else if (categoryString.length > 0) {
            item.perspective.receiveCategoryMetaData(jsonData);
          }
        },

        shouldAcceptDrop(item, event) {
          const target = item.perspective;
          const current = FocusedPerspectiveStore.current();
          if (
            !event.dataTransfer.types.includes('edison-threads-data') &&
            !event.dataTransfer.types.includes(Constant.DROP_DATA_TYPE.FOLDER_TREE_ITEM)
          ) {
            return false;
          }
          if (event.dataTransfer.types.includes(Constant.DROP_DATA_TYPE.FOLDER_TREE_ITEM)) {
            return true;
          }
          if (target && target.isEqual(current)) {
            return false;
          }

          // We can't inspect the drag payload until drop, so we use a dataTransfer
          // type to encode the account IDs of threads currently being dragged.
          const accountsType = event.dataTransfer.types.find(t => t.startsWith('nylas-accounts='));
          const accountIds = (accountsType || '').replace('nylas-accounts=', '').split(',');
          return target.canReceiveThreadsFromAccountIds(accountIds);
        },

        onSelect(item) {
          // FocusedPerspectiveStore.refreshPerspectiveMessages({perspective: item});
          Actions.focusMailboxPerspective(item.perspective);
          if (item.syncFolderList && item.children.length === 0) {
            Actions.syncFolderList({ accountIds: item.accountIds, source: 'onSelectItem' });
          }
        },
      },
      opts
    );
    if (ret.displayOrder === -1) {
      ret.perspective.setDisplayOrder(opts.folderTreeIndex, false);
    }
    ret.perspective.processCategoryMetaDataChangeRecord();
    return ret;
  }

  static forCategories(categories = [], opts = {}, filterStandardParents = true) {
    if (filterStandardParents) {
      categories = categories.filter(cat => {
        if (cat.role !== 'none' && cat.role) {
          return true;
        }
        const parent = SidebarItem.getCategoryParent(cat);
        return !parent || (parent && (!parent.role || parent.role === 'none'));
      });
    }
    if (categories.length === 0) {
      return null;
    }
    const id = idForCategories(categories);
    const accountIds = new Set(categories.map(c => c.accountId));
    const contextMenuLabel = _str.capitalize(
      categories[0] != null ? categories[0].displayType() : undefined
    );
    let perspective;
    if (categories.every(cat => !cat.selectable)) {
      perspective = MailboxPerspective.forNoneSelectableCategories(categories);
      opts.editable = false;
      opts.deletable = false;
    } else {
      perspective = MailboxPerspective.forCategories(categories);
    }
    if (opts.deletable == null) {
      opts.deletable = true;
    }
    if (opts.editable == null) {
      opts.editable = true;
    }
    opts.contextMenuLabel = contextMenuLabel;
    return SidebarItem.appendSubPathByAccounts(
      accountIds,
      this.forPerspective(id, perspective, opts)
    );
  }

  static forSentMails(accountIds, opts = {}) {
    opts.iconName = 'sent.svg';
    let cats = [];
    for (let accountId of accountIds) {
      let tmp = CategoryStore.getCategoryByRole(accountId, 'sent');
      if (tmp) {
        cats.push(tmp);
      }
    }
    if (cats.length === 0) {
      return null;
    }
    let perspective;
    if (Array.isArray(accountIds) && accountIds.length > 1) {
      perspective = MailboxPerspective.forAllSent(cats);
    } else {
      perspective = MailboxPerspective.forCategories(cats);
    }
    let id = 'sent';
    if (opts.key) {
      id += `-${opts.key}`;
    } else {
      id += `-${accountIds.join('-')}`;
    }
    opts.categoryIds = this.getCategoryIds(accountIds, 'sent');
    return SidebarItem.appendSubPathByAccounts(
      accountIds,
      this.forPerspective(id, perspective, opts)
    );
  }

  static forSpam(accountIds, opts = {}) {
    let cats = [];
    for (let accountId of accountIds) {
      let tmp = CategoryStore.getCategoryByRole(accountId, 'spam');
      if (tmp) {
        cats.push(tmp);
      }
    }
    if (cats.length === 0) {
      return null;
    }
    const perspective =
      cats.length === 1
        ? MailboxPerspective.forCategories(cats)
        : MailboxPerspective.forAllSpam(cats);
    let id = 'spam';
    if (opts.key) {
      id += `-${opts.key}`;
    } else {
      id += `-${accountIds.join('-')}`;
    }
    opts.categoryIds = this.getCategoryIds(accountIds, 'spam');
    return SidebarItem.appendSubPathByAccounts(
      accountIds,
      this.forPerspective(id, perspective, opts)
    );
  }

  static forArchived(accountIds, opts = {}) {
    opts.iconName = 'archive.svg';
    let cats = [];
    for (let accountId of accountIds) {
      const account = AccountStore.accountForId(accountId);
      if (account) {
        let role = 'archive';
        if (account.provider === 'gmail' && accountIds.length > 1) {
          role = 'all';
        }
        let tmp = CategoryStore.getCategoryByRole(accountId, role);
        if (tmp) {
          cats.push(tmp);
        }
      }
    }
    if (cats.length === 0) {
      return null;
    }
    let perspective;
    if (opts.key === 'all') {
      perspective = MailboxPerspective.forAllArchived(cats);
    } else {
      perspective = MailboxPerspective.forCategories(cats);
    }
    let id = 'archive';
    if (opts.key) {
      id += `-${opts.key}`;
    } else {
      id += `-${accountIds.join('-')}`;
    }
    opts.categoryIds = this.getCategoryIds(accountIds, 'archive');
    return SidebarItem.appendSubPathByAccounts(
      accountIds,
      this.forPerspective(id, perspective, opts)
    );
  }

  static forSnoozed(accountIds, opts = {}) {
    opts.iconName = 'snoozed.svg';
    let cats = [];
    for (let accountId of accountIds) {
      let tmp = CategoryStore.getCategoryByRole(accountId, 'snoozed');
      if (tmp) {
        cats.push(tmp);
      }
    }
    if (cats.length === 0) {
      return null;
    }
    const perspective = MailboxPerspective.forCategories(cats);
    const id = _.pluck(cats, 'id').join('-');
    return this.forPerspective(id, perspective, opts);
  }

  static forStarred(accountIds, opts = {}) {
    opts.iconName = 'flag.svg';
    const perspective = MailboxPerspective.forStarred(accountIds);
    let id = 'Starred';
    if (opts.key) {
      id += `-${opts.key}`;
    } else {
      id += `-${accountIds.join('-')}`;
    }
    return this.forPerspective(id, perspective, opts);
  }

  static forUnread(accountIds, opts = {}) {
    let categories = accountIds.map(accId => {
      return CategoryStore.getCategoryByRole(accId, 'inbox');
    });

    // NOTE: It's possible for an account to not yet have an `inbox`
    // category. Since the `SidebarStore` triggers on `AccountStore`
    // changes, it'll trigger the exact moment an account is added to the
    // config. However, the API has not yet come back with the list of
    // `categories` for that account.
    categories = _.compact(categories);
    opts.iconName = 'unread.svg';
    const perspective = MailboxPerspective.forUnread(categories);
    let id = 'Unread';
    if (opts.key) {
      id += `-${opts.key}`;
    } else {
      id += `-${accountIds.join('-')}`;
    }
    return this.forPerspective(id, perspective, opts);
  }

  static forJira(accountIds, opts = {}) {
    const accounts = AccountStore.accounts();
    let isEdisonMail = false;
    for (const acc of accounts) {
      if (acc.emailAddress.includes('edison.tech')) {
        isEdisonMail = true;
        break;
      }
    }
    if (!isEdisonMail) {
      return null;
    }
    let categories = accountIds.map(accId => {
      return CategoryStore.getCategoryByRole(accId, 'inbox');
    });

    // NOTE: It's possible for an account to not yet have an `inbox`
    // category. Since the `SidebarStore` triggers on `AccountStore`
    // changes, it'll trigger the exact moment an account is added to the
    // config. However, the API has not yet come back with the list of
    // `categories` for that account.
    categories = _.compact(categories);
    opts.iconName = 'jira.svg';
    opts.className = 'jira-icon';
    const perspective = MailboxPerspective.forJira(categories);
    let id = 'Jira';
    if (opts.key) {
      id += `-${opts.key}`;
    }
    return this.forPerspective(id, perspective, opts);
  }

  static forSingleInbox(accountId, opts = {}) {
    opts.iconName = 'inbox.svg';
    const perspective = MailboxPerspective.forSingleInbox(accountId);
    opts.categoryIds = this.getCategoryIds([accountId], 'inbox');
    const id = `${accountId}-single`;
    if (Array.isArray(perspective.accountIds) && perspective.accountIds.length === 0) {
      opts.accountIds = [accountId];
    }
    opts.onAddNewFolder = () => {
      SidebarActions.addingNewFolderToAccount({ accountId });
    };
    const account = AccountStore.accountForId(accountId);
    if (account) {
      opts.url = account.picture;
      opts.iconName = `account-logo-${account.provider}.png`;
      opts.fallback = `account-logo-other.png`;
      opts.mode = RetinaImg.Mode.ContentPreserve;
      opts.syncFolderList = true;
      if (account.provider === 'gmail' || account.provider === 'onmail') {
        opts.addNewFolderLabel = 'New Label...';
      } else {
        opts.addNewFolderLabel = 'New Folder...';
      }
    }
    return this.forPerspective(id, perspective, opts);
  }
  static forOutbox(accountIds, opts = {}) {
    opts.iconName = 'outbox.svg';
    opts.hideOnEditingMenu = true;
    const perspective = MailboxPerspective.forOutbox(accountIds);
    const id = 'outbox';
    return this.forPerspective(id, perspective, opts);
  }

  static forInbox(accountId, opts = {}) {
    opts.iconName = 'inbox.svg';
    const perspective = MailboxPerspective.forInbox(accountId);
    opts.categoryIds = this.getCategoryIds(accountId, 'inbox');
    const id = `${accountId}-inbox`;
    return SidebarItem.appendSubPathByAccounts(
      accountId,
      this.forPerspective(id, perspective, opts)
    );
  }

  static forAllMail(allMailCategory, opts = {}) {
    const contextMenuLabel = _str.capitalize(allMailCategory.displayType() || undefined);
    const perspective = MailboxPerspective.forAllMail(allMailCategory);
    const id = `${allMailCategory.accountId}-allMail`;
    opts.contextMenuLabel = contextMenuLabel;
    return this.forPerspective(id, perspective, opts);
  }

  static forAllInbox(accountIds, opts = {}) {
    const perspective = MailboxPerspective.forAllInbox(accountIds);
    opts.categoryIds = this.getCategoryIds(accountIds, 'inbox');
    opts.mode = RetinaImg.Mode.ContentPreserve;
    const id = 'AllInbox';
    return this.forPerspective(id, perspective, opts);
  }

  // static forSingleAccount(accountId, opts = {}) {
  //   const perspective = MailboxPerspective.forSingleAccount(accountId);
  //   const id = accountId;
  //   return this.forPerspective(id, perspective, opts);
  // }

  static forAttachments(accountIds, opts = {}) {
    const perspetive = MailboxPerspective.forAttachments(accountIds);
    const id = accountIds.join('-') + 'attachments';
    return this.forPerspective(id, perspetive, opts);
  }

  static forDrafts(accountIds, opts = {}) {
    opts.iconName = 'drafts.svg';
    const perspective = MailboxPerspective.forDrafts(accountIds);
    opts.categoryIds = this.getCategoryIds(accountIds, 'drafts');
    if (!Array.isArray(opts.categoryIds) || opts.categoryIds.length === 0) {
      return null;
    }
    let id = `Drafts-`;
    if (opts.key) {
      id += `${opts.key}`;
    } else {
      id += `${accountIds.join('-')}`;
    }

    // return this.forPerspective(id, perspective, opts);
    return SidebarItem.appendSubPathByAccounts(
      accountIds,
      this.forPerspective(id, perspective, opts)
    );
  }

  static forSift(accountIds, siftCategory, opts = {}) {
    if (!Array.isArray(accountIds)) {
      accountIds = [accountIds];
    }
    const perspective = MailboxPerspective.forSiftCategory({
      accountIds,
      siftCategory,
    });
    const id = `accountIds-${siftCategory}`;
    return this.forPerspective(id, perspective, opts);
  }

  static forToday(accountIds, opts = {}) {
    if (!Array.isArray(accountIds)) {
      accountIds = [accountIds];
    }
    const perspective = MailboxPerspective.forToday(accountIds);
    let id = 'today-';
    if (opts && opts.key) {
      id += opts.key;
    } else {
      id += accountIds.join('-');
    }
    return this.forPerspective(id, perspective, opts);
  }

  static forAllTrash(accountIds, opts = {}) {
    opts.iconName = 'trash.svg';
    const perspective = MailboxPerspective.forAllTrash(accountIds);
    opts.categoryIds = this.getCategoryIds(accountIds, 'trash');
    if (!Array.isArray(opts.categoryIds) || opts.categoryIds.length === 0) {
      return null;
    }
    const id = `AllTrash`;
    // return this.forPerspective(id, perspective, opts);
    return SidebarItem.appendSubPathByAccounts(
      accountIds,
      this.forPerspective(id, perspective, opts)
    );
  }

  static forTrash(accountId, opts = {}) {
    opts.iconName = 'trash.svg';
    const category = CategoryStore.getCategoryByRole(accountId, 'trash');
    if (!category) {
      return null;
    }
    const perspective = MailboxPerspective.forCategory(category);
    opts.categoryIds = [category.id];
    const id = `Trash-${accountId}`;
    return SidebarItem.appendSubPathByAccounts(
      [accountId],
      this.forPerspective(id, perspective, opts)
    );
  }

  static appendSubPathByAccounts(accountIds, parentPerspective) {
    for (const accountId of accountIds) {
      const categories = parentPerspective ? parentPerspective.perspective.categories() : [];
      if (categories.length === 1) {
        SidebarItem.appendSubPathByAccount(accountId, parentPerspective, categories[0], {
          startIndex: parentPerspective.startIndex ? parentPerspective.startIndex : 0,
        });
      }
    }
    return parentPerspective;
  }

  static appendSubPathByAccount(
    accountId,
    parentPerspective,
    parentCategory,
    { startIndex = 0 } = {}
  ) {
    const { path } = parentCategory;
    if (!path) {
      AppEnv.logError(new Error('path must not be empty'));
      return;
    }
    if (!parentPerspective) {
      AppEnv.logError(new Error('parentItem must not be empty'));
      return;
    }
    if (!accountId) {
      AppEnv.logError(new Error('accountId must not be empty'));
      return;
    }
    const account = AccountStore.accountForId(accountId);
    if (!account) {
      AppEnv.logError(new Error(`Cannot find account for ${accountId}`));
      return;
    }
    if (
      typeof parentPerspective.parentCollapsed === 'function' &&
      parentPerspective.parentCollapsed()
    ) {
      return;
    }
    const isExchange = AccountStore.isExchangeAccount(account);
    const categories = CategoryStore.userCategories(accountId);
    let foundParent = false;
    if (isExchange) {
      startIndex = 0;
    }
    for (let i = startIndex; i < categories.length; i++) {
      const category = categories[i];
      let item, parentKey;
      // let itemKey;

      let parent = null;
      if (isExchange) {
        // itemKey = CategoryStore.decodePath(category.path);
        if (category.parentId === path && path !== category.path) {
          parentKey = path;
          parent = parentPerspective;
        } else {
          continue;
        }
      } else {
        if (parentCategory.isParentOf(category)) {
          parentKey = parentCategory.displayName;
          parent = parentPerspective;
        }
      }
      if (parent) {
        let itemDisplayName = category.displayName.substr(parentKey.length + 1);
        if (isExchange) {
          itemDisplayName = category.displayName;
        }
        item = SidebarItem.forCategories(
          [category],
          {
            name: itemDisplayName,
            folderTreeIndex: parent.children.length,
            startIndex: i,
            stopOnFirstChild: () => isItemCollapsed(parentPerspective.id),
            parentCollapsed: () => isItemCollapsed(parentPerspective.id),
            parentId: parent.id,
          },
          false
        );
        if (item) {
          foundParent = true;
          parent.children.push(item);
          if (item.selected) {
            parent.selected = true;
          }
          if (
            typeof parentPerspective.stopOnFirstChild === 'function' &&
            parentPerspective.stopOnFirstChild()
          ) {
            break;
          }
        }
      }
      if (!isExchange && foundParent && !parent && !parentCategory.isAncestorOf(category)) {
        break;
      }
    }
    if (
      typeof parentPerspective.stopOnFirstChild !== 'function' ||
      !parentPerspective.stopOnFirstChild()
    ) {
      SidebarSection.sortByDisplayOrderAndUpdateDisplayOrderToIndexOrder(
        parentPerspective.children
      );
    }
  }

  static getCategoryIds = (accountIds, categoryName) => {
    const categoryIds = [];
    for (let accountId of accountIds) {
      let tmp = CategoryStore.getCategoryByRole(accountId, categoryName);
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
  static getCategoryParent = category => {
    return CategoryStore.getCategoryParent(category);
  };
}

module.exports = SidebarItem;
