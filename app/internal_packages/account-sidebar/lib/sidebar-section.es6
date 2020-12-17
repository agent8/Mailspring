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
export const ADD_FOLDER_OBJECT = {
  id: 'addFolder',
  onRequestAddFolder: () => SidebarActions.requestAddFolderAccountSelection(),
};
export const NEW_FOLDER_OBJECT = {
  id: 'newFolder',
  isHidden: true,
  newFolderAccountId: '',
  onEdited: data => SidebarActions.updateNewFolderData(data),
  onSave: () => SidebarActions.saveNewFolderRequest(),
  onCancel: () => SidebarActions.cancelAddFolderRequest(),
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

    const items = [];
    let standardItem = SidebarItem.forInbox([account.id], { folderTreeIndex: items.length });
    if (standardItem) {
      items.push(standardItem);
    }
    standardItem = SidebarItem.forToday([account.id], {
      displayName: 'Today',
      folderTreeIndex: items.length,
    });
    if (standardItem) {
      items.push(standardItem);
    }
    standardItem = SidebarItem.forUnread([account.id], { folderTreeIndex: items.length });
    if (standardItem) {
      items.push(standardItem);
    }
    standardItem = SidebarItem.forStarred([account.id], {
      displayName: 'Flagged',
      folderTreeIndex: items.length,
    });
    if (standardItem) {
      items.push(standardItem);
    }
    standardItem = SidebarItem.forDrafts([account.id], {
      key: `standard-${account.id}`,
      folderTreeIndex: items.length,
    });
    if (standardItem) {
      items.push(standardItem);
    }
    standardItem = SidebarItem.forSpam([account.id], { folderTreeIndex: items.length });
    if (standardItem) {
      items.push(standardItem);
    }
    standardItem = SidebarItem.forTrash(account.id, { folderTreeIndex: items.length });
    if (standardItem) {
      items.push(standardItem);
    }
    if (account.provider !== 'gmail') {
      standardItem = SidebarItem.forArchived([account.id], { folderTreeIndex: items.length });
      if (standardItem) {
        items.push(standardItem);
      }
    }
    standardItem = SidebarItem.forSentMails([account.id], { folderTreeIndex: items.length });
    if (standardItem) {
      items.push(standardItem);
    }
    _.reject(
      cats,
      cat => cat.role && cat.role !== 'all' && cat.role !== 'none' && cat.role !== 'important'
    ).forEach(cat => {
      if (cat.role === 'all' && account.provider === 'gmail') {
        const item = SidebarItem.forAllMail(cat, {
          editable: false,
          deletable: false,
          folderTreeIndex: items.length,
        });
        items.push(item);
      } else {
        const item = SidebarItem.forCategories([cat], {
          editable: false,
          deletable: false,
          folderTreeIndex: items.length,
        });
        items.push(item);
      }
    });

    // const attachmentsMail = SidebarItem.forAttachments([account.id]);

    this.accountUserCategories(account, items);
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
    const accountItems = [];
    accounts.forEach(acc => {
      const accountFolderItems = this.standardSectionForAccount(acc).items;
      accountFolderItems.sort(SidebarSection.sortByDisplayOrder);
      const newFolder = SidebarStore().getNewFolder();
      let forceExpand = undefined;
      if (newFolder) {
        forceExpand = newFolder.accountId === acc.id;
        if (forceExpand) {
          accountFolderItems.push(
            Object.assign({}, NEW_FOLDER_OBJECT, { newFolderAccountId: acc.id })
          );
        }
      }
      let item = SidebarItem.forSingleInbox(acc.id, {
        name: acc.label,
        threadTitleName: 'Inbox',
        children: accountFolderItems,
        folderTreeIndex: accountItems.length,
        forceExpand,
      });
      accountItems.push(item);
    });
    accountItems.sort(SidebarSection.sortByDisplayOrder);
    items.push(...accountItems);
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
      const shortcutItems = [];
      items.push(DIVIDER_OBJECT);
      folderItem = SidebarItem.forToday(accountIds, {
        displayName: 'Today',
        key: 'all',
        folderTreeIndex: shortcutItems.length,
      });
      if (folderItem) {
        shortcutItems.push(folderItem);
      }
      folderItem = SidebarItem.forUnread(accountIds, {
        displayName: 'Unread',
        key: 'all',
        folderTreeIndex: shortcutItems.length,
      });
      if (folderItem) {
        shortcutItems.push(folderItem);
      }
      folderItem = SidebarItem.forStarred(accountIds, {
        displayName: 'Flagged',
        key: 'all',
        folderTreeIndex: shortcutItems.length,
      });
      if (folderItem) {
        shortcutItems.push(folderItem);
      }
      folderItem = SidebarItem.forDrafts(accountIds, {
        displayName: 'All Drafts',
        key: 'all',
        folderTreeIndex: shortcutItems.length,
      });
      if (folderItem) {
        shortcutItems.push(folderItem);
      }
      // folderItem = SidebarItem.forSnoozed(accountIds, { displayName: 'Snoozed' });
      // if (folderItem) {
      //   items.push(folderItem);
      // }
      folderItem = SidebarItem.forSpam(accountIds, {
        displayName: 'Spam',
        key: 'all',
        folderTreeIndex: shortcutItems.length,
      });
      if (folderItem) {
        shortcutItems.push(folderItem);
      }
      folderItem = SidebarItem.forAllTrash(accountIds, {
        displayName: 'Trash',
        key: 'all',
        folderTreeIndex: shortcutItems.length,
      });
      if (folderItem) {
        shortcutItems.push(folderItem);
      }

      folderItem = SidebarItem.forArchived(accountIds, {
        displayName: 'All Archive',
        key: 'all',
        folderTreeIndex: shortcutItems.length,
      });
      if (folderItem) {
        shortcutItems.push(folderItem);
      }
      folderItem = SidebarItem.forSentMails(accountIds, {
        displayName: 'All Sent',
        key: 'all',
        folderTreeIndex: shortcutItems.length,
      });
      if (folderItem) {
        shortcutItems.push(folderItem);
      }
      shortcutItems.sort(SidebarSection.sortByDisplayOrder);
      items.push(...shortcutItems);
    }
    SidebarSection.forSiftCategories(accountIds, items);

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

  static accountUserCategories(account, items) {
    const baseNumber = items.length;
    const showAll = Object.assign({}, MORE_TOGGLE, {
      accountIds: [account.id],
      showAll: true,
      collapsed: true,
      name: `${account.id}-single-moreToggle`,
      onToggleMoreOrLess: () => SidebarActions.toggleMore(`${account.id}-single-moreToggle`, false),
    });
    const showLess = Object.assign({}, MORE_TOGGLE, {
      accountIds: [account.id],
      showAll: false,
      collapsed: false,
      name: `${account.id}-single-moreToggle`,
      onToggleMoreOrLess: () => SidebarActions.toggleMore(`${account.id}-single-moreToggle`, true),
    });
    for (let category of CategoryStore.userCategories(account)) {
      let item;
      const parent = CategoryStore.getCategoryParent(category);
      if (parent) {
        continue;
      }
      item = SidebarItem.forCategories(
        [category],
        {
          hideWhenCrowded: items.length - baseNumber >= 3,
          folderTreeIndex: items.length,
        },
        false
      );
      if (item) {
        if (items.length - baseNumber === 3) {
          items.push(showAll);
        }
        items.push(item);
      }
    }
    if (items.length - baseNumber > 3 && items[items.length - 1].id !== showLess.id) {
      items.push(showLess);
    }
  }

  static sortByDisplayOrder = (a, b) => {
    if (DIVIDER_OBJECT.id.includes(a.id) || DIVIDER_OBJECT.id.includes(b.id)) {
      return 0;
    } else if (MORE_TOGGLE.id.includes(a.id)) {
      return 1;
    } else if (MORE_TOGGLE.id.includes(b.id)) {
      return -1;
    } else {
      return a.displayOrder - b.displayOrder;
    }
  };

  static forSiftCategories(accountsOrIds, items) {
    if (!Array.isArray(accountsOrIds) || !Array.isArray(items)) {
      return;
    }
    let accountIds = accountsOrIds;
    if (accountsOrIds[0].id) {
      accountIds = accountsOrIds.map(acct => acct.id);
    }
    const siftItems = [];
    let folderItem = SidebarItem.forSift(accountIds, Sift.categories.Travel, {
      folderTreeIndex: siftItems.length,
    });
    if (folderItem) {
      siftItems.push(folderItem);
    }
    folderItem = SidebarItem.forSift(accountIds, Sift.categories.Packages, {
      folderTreeIndex: siftItems.length,
    });
    if (folderItem) {
      siftItems.push(folderItem);
    }
    folderItem = SidebarItem.forSift(accountIds, Sift.categories.Bill, {
      folderTreeIndex: siftItems.length,
    });
    if (folderItem) {
      siftItems.push(folderItem);
    }
    folderItem = SidebarItem.forSift(accountIds, Sift.categories.Entertainment, {
      folderTreeIndex: siftItems.length,
    });
    if (folderItem) {
      siftItems.push(folderItem);
    }
    folderItem = SidebarItem.forJira(accountIds, {
      displayName: 'Jira',
      folderTreeIndex: siftItems.length,
    });
    if (folderItem) {
      siftItems.push(folderItem);
    }
    if (siftItems.length > 0) {
      siftItems.sort(SidebarSection.sortByDisplayOrder);
      items.push(DIVIDER_OBJECT);
      for (const item of siftItems) {
        items.push(item);
      }
    }
  }
}
