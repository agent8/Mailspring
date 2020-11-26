import Sift from '../../../src/flux/models/sift';
const _ = require('underscore');
const { CategoryStore, ExtensionRegistry, OutboxStore } = require('mailspring-exports');
const SidebarItem = require('./sidebar-item');
const SidebarActions = require('./sidebar-actions');
let sidebarStore = null;
const SidebarStore = () => {
  sidebarStore = sidebarStore || require('./sidebar-store');
  return sidebarStore;
};
const DIVIDER_OBJECT = { id: 'divider' };
const ADD_FOLDER_OBJECT = {
  id: 'addFolder',
  onRequestAddFolder: () => SidebarActions.requestAddFolderAccountSelection(),
};
const NEW_FOLDER_OBJECT = {
  id: 'newFolder',
  isHidden: true,
  newFolderAccountId: '',
  onEdited: data => SidebarActions.updateNewFolderData(data),
  onSave: () => SidebarActions.saveNewFolderRequest(),
};
const MORE_TOGGLE = { id: 'moreToggle' };
export const nonFolderIds = [
  DIVIDER_OBJECT.id,
  MORE_TOGGLE.id,
  ADD_FOLDER_OBJECT.id,
  NEW_FOLDER_OBJECT.id,
];
// function isSectionCollapsed(title) {
//   if (AppEnv.savedState.sidebarKeysCollapsed[title] !== undefined) {
//     return AppEnv.savedState.sidebarKeysCollapsed[title];
//   } else {
//     return false;
//   }
// }

// function toggleSectionCollapsed(section) {
//   if (!section) {
//     return;
//   }
//   SidebarActions.setKeyCollapsed(section.title, !isSectionCollapsed(section.title));
// }

export default class SidebarSection {
  static empty(title) {
    return {
      title,
      items: [],
    };
  }

  static standardSectionForAccount(account) {
    if (!account) {
      throw new Error('standardSectionForAccount: You must pass an account.');
    }

    const cats = CategoryStore.standardCategories(account);
    if (cats.length === 0) {
      return this.empty(account.label);
    }

    const items = _.reject(
      cats,
      cat => cat.role && cat.role !== 'all' && cat.role !== 'none' && cat.role !== 'important'
    ).map(cat => {
      if (cat.role === 'all' && account.provider === 'gmail') {
        return SidebarItem.forAllMail(cat, { editable: false, deletable: false });
      } else {
        return SidebarItem.forCategories([cat], { editable: false, deletable: false });
      }
    });
    let standardItem = SidebarItem.forSentMails([account.id]);
    if (standardItem) {
      items.unshift(standardItem);
    }
    if (account.provider !== 'gmail') {
      standardItem = SidebarItem.forArchived([account.id]);
      if (standardItem) {
        items.unshift(standardItem);
      }
    }
    standardItem = SidebarItem.forTrash(account.id);
    if (standardItem) {
      items.unshift(standardItem);
    }
    standardItem = SidebarItem.forSpam([account.id]);
    if (standardItem) {
      items.unshift(standardItem);
    }
    standardItem = SidebarItem.forDrafts([account.id], { key: `standard-${account.id}` });
    if (standardItem) {
      items.unshift(standardItem);
    }
    standardItem = SidebarItem.forStarred([account.id], { displayName: 'Flagged' });
    if (standardItem) {
      items.unshift(standardItem);
    }
    standardItem = SidebarItem.forUnread([account.id]);
    if (standardItem) {
      items.unshift(standardItem);
    }
    standardItem = SidebarItem.forToday([account.id], { displayName: 'Today' });
    if (standardItem) {
      items.unshift(standardItem);
    }
    standardItem = SidebarItem.forInbox([account.id]);
    if (standardItem) {
      items.unshift(standardItem);
    }
    // const attachmentsMail = SidebarItem.forAttachments([account.id]);

    items.push(...this.accountUserCategories(account));
    ExtensionRegistry.AccountSidebar.extensions()
      .filter(ext => ext.sidebarItem != null)
      .forEach(ext => {
        const { id, name, iconName, perspective, insertAtTop } = ext.sidebarItem([account.id]);
        const item = SidebarItem.forPerspective(id, perspective, { name, iconName });
        if (insertAtTop) {
          return items.splice(3, 0, item);
        } else {
          return items.push(item);
        }
      });

    return {
      title: 'MAILBOXES',
      items,
    };
  }

  static standardSectionForAccounts(accounts) {
    const items = [];
    const outboxCount = OutboxStore.count();
    const outboxOpts = {
      counterStyle: outboxCount.failed > 0 ? 'critical' : 'alt',
    };
    let outbox;
    if (accounts.length === 1) {
      outbox = SidebarItem.forOutbox([accounts[0].id], outboxOpts);
    } else {
      outbox = SidebarItem.forOutbox(
        accounts.map(act => act.id),
        outboxOpts
      );
    }
    if (!accounts || accounts.length === 0) {
      return this.empty('All Accounts');
    }
    if (CategoryStore.categories().length === 0) {
      return this.empty('All Accounts');
    }
    accounts.forEach(acc => {
      const accountItems = this.standardSectionForAccount(acc).items;
      const newFolder = SidebarStore().getNewFolder(acc.id);
      let forceExpand = undefined;
      if (newFolder) {
        forceExpand = true;
        accountItems.push(Object.assign({}, NEW_FOLDER_OBJECT, { newFolderAccountId: acc.id }));
      }
      let item = SidebarItem.forSingleInbox(acc.id, {
        name: acc.label,
        threadTitleName: 'Inbox',
        children: accountItems,
        forceExpand,
      });
      items.push(item);
    });
    if (accounts.length > 1) {
      items.push(ADD_FOLDER_OBJECT);
    }

    const accountIds = _.pluck(accounts, 'id');
    let folderItem;
    if (accounts.length > 1) {
      folderItem = SidebarItem.forAllInbox(accountIds, { displayName: 'All Inboxes' });
      if (folderItem) {
        items.unshift(DIVIDER_OBJECT);
        items.unshift(folderItem);
      }
    }
    if (outboxCount.total > 0) {
      items.unshift(outbox);
    }
    if (accounts.length > 1) {
      items.push(DIVIDER_OBJECT);
      folderItem = SidebarItem.forToday(accountIds, { displayName: 'Today', key: 'all' });
      if (folderItem) {
        items.push(folderItem);
      }
      folderItem = SidebarItem.forUnread(accountIds, { displayName: 'Unread', key: 'all' });
      if (folderItem) {
        items.push(folderItem);
      }
      folderItem = SidebarItem.forStarred(accountIds, { displayName: 'Flagged', key: 'all' });
      if (folderItem) {
        items.push(folderItem);
      }
      folderItem = SidebarItem.forDrafts(accountIds, { displayName: 'All Drafts', key: 'all' });
      if (folderItem) {
        items.push(folderItem);
      }
      // folderItem = SidebarItem.forSnoozed(accountIds, { displayName: 'Snoozed' });
      // if (folderItem) {
      //   items.push(folderItem);
      // }
      folderItem = SidebarItem.forSpam(accountIds, { displayName: 'Spam', key: 'all' });
      if (folderItem) {
        items.push(folderItem);
      }
      folderItem = SidebarItem.forAllTrash(accountIds, { displayName: 'Trash', key: 'all' });
      if (folderItem) {
        items.push(folderItem);
      }

      folderItem = SidebarItem.forArchived(accountIds, { displayName: 'All Archive', key: 'all' });
      if (folderItem) {
        items.push(folderItem);
      }
      folderItem = SidebarItem.forSentMails(accountIds, { displayName: 'All Sent', key: 'all' });
      if (folderItem) {
        items.push(folderItem);
      }
    }
    SidebarSection.forSiftCategories(accountIds, items);

    folderItem = SidebarItem.forJira(accountIds, { displayName: 'Jira' });
    if (folderItem) {
      items.push(folderItem);
    }

    ExtensionRegistry.AccountSidebar.extensions()
      .filter(ext => ext.sidebarItem != null)
      .forEach(ext => {
        const { id, name, iconName, perspective, insertAtTop } = ext.sidebarItem(accountIds);
        const item = SidebarItem.forPerspective(id, perspective, {
          name,
          iconName,
          children: accounts.map(acc => {
            const subItem = ext.sidebarItem([acc.id]);
            return SidebarItem.forPerspective(subItem.id + `-${acc.id}`, subItem.perspective, {
              name: acc.label,
              iconName: subItem.iconName,
            });
          }),
        });
        if (insertAtTop) {
          items.splice(3, 0, item);
        } else {
          items.push(item);
        }
      });
    return {
      title: 'MAILBOXES',
      items,
    };
  }

  static accountUserCategories(account) {
    const items = [];
    // const isExchange = account && account.provider === 'exchange';
    // let exchangeInboxCategory;
    // if (isExchange) {
    //   exchangeInboxCategory = CategoryStore.getInboxCategory(account.id);
    // }
    const isShowAll = AppEnv.savedState.sidebarKeysCollapsed[`${account.id}-single-moreToggle`];
    const moreOrLess = Object.assign({}, MORE_TOGGLE, {
      collapsed: isShowAll,
      name: `${account.id}-single-moreToggle`,
    });
    for (let category of CategoryStore.userCategories(account)) {
      let item;
      const parent = CategoryStore.getCategoryParent(category);
      if (parent) {
        continue;
      }
      item = SidebarItem.forCategories([category], { hideWhenCrowded: items.length >= 3 }, false);
      if (item) {
        if (items.length === 3 && !isShowAll) {
          items.push(moreOrLess);
        }
        items.push(item);
      }
    }
    if (isShowAll && items.length > 3) {
      items.push(moreOrLess);
    }
    return items.sort((a, b) => {
      if (DIVIDER_OBJECT.id.includes(a.id) || DIVIDER_OBJECT.id.includes(b.id)) {
        return 0;
      } else if (MORE_TOGGLE.id.includes(a.id)) {
        return 1;
      } else if (MORE_TOGGLE.id.includes(b.id)) {
        return -1;
      } else {
        return a.displayOrder - b.displayOrder;
      }
    });
  }

  static forSiftCategories(accountsOrIds, items) {
    if (!Array.isArray(accountsOrIds) || !Array.isArray(items)) {
      return;
    }
    let accountIds = accountsOrIds;
    if (accountsOrIds[0].id) {
      accountIds = accountsOrIds.map(acct => acct.id);
    }
    const siftItems = [];
    let folderItem = SidebarItem.forSift(accountIds, Sift.categories.Travel);
    if (folderItem) {
      siftItems.push(folderItem);
    }
    folderItem = SidebarItem.forSift(accountIds, Sift.categories.Packages);
    if (folderItem) {
      siftItems.push(folderItem);
    }
    folderItem = SidebarItem.forSift(accountIds, Sift.categories.Bill);
    if (folderItem) {
      siftItems.push(folderItem);
    }
    folderItem = SidebarItem.forSift(accountIds, Sift.categories.Entertainment);
    if (folderItem) {
      siftItems.push(folderItem);
    }
    if (siftItems.length > 0) {
      items.push(DIVIDER_OBJECT);
      for (const item of siftItems) {
        items.push(item);
      }
    }
  }
}
