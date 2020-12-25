/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import Sift from '../../../src/flux/models/sift';
const _ = require('underscore');
const { CategoryStore, ExtensionRegistry, OutboxStore } = require('mailspring-exports');

const SidebarItem = require('./sidebar-item');
// const SidebarActions = require('./sidebar-actions');
const DIVIDER_OBJECT = { id: 'divider' };
const MORE_TOGGLE = { id: 'moreToggle' };
export const nonFolderIds = [DIVIDER_OBJECT.id, MORE_TOGGLE.id];
// function isSectionCollapsed(title) {
//   if (AppEnv.savedState.sidebarKeysCollapsed[title] !== undefined) {
//     return AppEnv.savedState.sidebarKeysCollapsed[title];
//   } else {
//     return false;
//   }
// }
//
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
    CategoryStore.restoreCategoriesForFolderTree();
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
    // if (accounts.length === 1) {
    //   const ret = this.standardSectionForAccount(accounts[0]);
    //   if (outboxCount.total > 0) {
    //     const inbox = ret.items.shift();
    //     ret.items.unshift(inbox);
    //     ret.items.unshift(outbox);
    //   }
    //   SidebarSection.forSiftCategories([accounts[0]], ret.items);
    //   return ret;
    // } else {
    accounts.forEach(acc => {
      let item = SidebarItem.forSingleInbox([acc.id], {
        name: acc.label,
        threadTitleName: 'Inbox',
        children: this.standardSectionForAccount(acc).items,
      });
      items.push(item);
    });
    // }

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

  static accountUserCategories(account, { title, collapsible } = {}) {
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
    const categories = CategoryStore.userCategoriesForFolderTree(account);
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i];
      let item;
      const parent = CategoryStore.getCategoryParent(category);
      if (parent) {
        continue;
      }
      CategoryStore.removeFromFolderTreeRenderArray(account, i);
      item = SidebarItem.forCategories([category], { hideWhenCrowded: items.length >= 3 }, false);
      if (item) {
        if (items.length === 3 && !isShowAll) {
          items.push(moreOrLess);
        }
        items.push(item);
        // if (items.length > 4 && item.selected) {
        //   items[3].collapsed = false;
        // }
      }
    }
    if (isShowAll && items.length > 3) {
      items.push(moreOrLess);
    }
    return items;
  }

  // static forUserCategories(account, { title, collapsible } = {}) {
  //   let onCollapseToggled;
  //   if (!account) {
  //     return;
  //   }
  //   // Compute hierarchy for user categories using known "path" separators
  //   // NOTE: This code uses the fact that userCategoryItems is a sorted set, eg:
  //   //
  //   // Inbox
  //   // Inbox.FolderA
  //   // Inbox.FolderA.FolderB
  //   // Inbox.FolderB
  //   //
  //   const items = [];
  //   const seenItems = {};
  //   for (let category of CategoryStore.userCategories(account)) {
  //     // https://regex101.com/r/jK8cC2/1
  //     var item, parentKey;
  //     const re = RegExpUtils.subcategorySplitRegex();
  //     const itemKey = category.displayName.replace(re, '/');
  //
  //     let parent = null;
  //     const parentComponents = itemKey.split('/');
  //     for (let i = parentComponents.length; i >= 1; i--) {
  //       parentKey = parentComponents.slice(0, i).join('/');
  //       parent = seenItems[parentKey];
  //       if (parent) {
  //         break;
  //       }
  //     }
  //
  //     if (parent) {
  //       const itemDisplayName = category.displayName.substr(parentKey.length + 1);
  //       item = SidebarItem.forCategories([category], { name: itemDisplayName }, false);
  //       if (item) {
  //         parent.children.push(item);
  //       }
  //     } else {
  //       item = SidebarItem.forCategories([category], {}, false);
  //       if (item) {
  //         items.push(item);
  //       }
  //     }
  //     seenItems[itemKey] = item;
  //   }
  //
  //   const inbox = CategoryStore.getInboxCategory(account);
  //   let iconName = null;
  //
  //   if (inbox && inbox.constructor === Label) {
  //     if (title == null) {
  //       title = 'Labels';
  //     }
  //     iconName = 'tag.png';
  //   } else {
  //     if (title == null) {
  //       title = 'Folders';
  //     }
  //     iconName = 'folder.png';
  //   }
  //   const collapsed = isSectionCollapsed(title);
  //   if (collapsible) {
  //     onCollapseToggled = toggleSectionCollapsed;
  //   }
  //
  //   return {
  //     title,
  //     iconName,
  //     items,
  //     collapsed,
  //     onCollapseToggled,
  //     onItemCreated(displayName) {
  //       if (!displayName) {
  //         return;
  //       }
  //       Actions.queueTask(
  //         SyncbackCategoryTask.forCreating({
  //           name: displayName,
  //           accountId: account.id,
  //         })
  //       );
  //     },
  //   };
  // }

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
