import _ from 'underscore';
import MailspringStore from 'mailspring-store';
import {
  Actions,
  AccountStore,
  ThreadCountsStore,
  WorkspaceStore,
  OutboxStore,
  FocusedPerspectiveStore,
  CategoryStore,
  TaskQueue,
} from 'mailspring-exports';
import React from 'react';
import SidebarSection, { nonFolderIds } from './sidebar-section';
import SidebarActions from './sidebar-actions';
import AccountCommands from './account-commands';
import NewCategoryAccountSelectPopover from './components/new-category-account-select-popover';
import TaskFactory from '../../../src/flux/tasks/task-factory';

const Sections = {
  Standard: 'Standard',
  User: 'User',
};

class SidebarStore extends MailspringStore {
  constructor() {
    super();

    if (AppEnv.savedState.sidebarKeysCollapsed == null) {
      AppEnv.savedState.sidebarKeysCollapsed = {};
    }

    this._sections = {};
    this._sections[Sections.Standard] = {};
    this._sections[Sections.User] = [];
    this._editingMenu = false;
    this._newFolder = { accountId: null };
    this._itemShowAllChildern = {};
    this._keyboardFocusKey = null;
    this._registerCommands();
    this._registerMenuItems();
    this._registerTrayItems();
    this._registerListeners();
    this._updateSections();
    this._onShiftItemThrottle = _.throttle((delta, cb) => this._onShiftItem(delta, cb), 100);
  }

  accounts() {
    return AccountStore.accounts();
  }

  sidebarAccountIds() {
    return FocusedPerspectiveStore.sidebarAccountIds();
  }

  standardSection() {
    return this._sections[Sections.Standard];
  }

  userSections() {
    return this._sections[Sections.User];
  }
  flattenStandardSections(sections) {
    const ret = [];
    if (!Array.isArray(sections)) {
      sections = Object.values(this.standardSection().items).filter(
        i => !nonFolderIds.includes(i.id)
      );
    }
    sections.forEach(section => {
      if (!section) {
        return;
      }
      if (!nonFolderIds.includes(section.id)) {
        ret.push(section);
      }
      if (Array.isArray(section.children) && section.children.length > 0 && !section.collapsed) {
        const tmp = this.flattenStandardSections(section.children);
        ret.push(...tmp);
      }
    });
    return ret;
  }

  onShift(delta, cb) {
    this._onShiftItemThrottle(delta, cb);
  }
  setItemShowAllChildren(id, value) {
    this._itemShowAllChildern[id] = value;
    AppEnv.savedState.sidebarKeysCollapsed[id] = value;
    this._updateSections();
  }
  itemShowAllChildren(id) {
    return !!this._itemShowAllChildern[id];
  }
  _findKeyboardFocusKeyFromCurrentSelected = () => {
    const getLowestSelected = sections => {
      if (!Array.isArray(sections)) {
        return null;
      }
      const selectedItem = sections.find(section => section.selected);
      if (selectedItem) {
        if (
          Array.isArray(selectedItem.children) &&
          selectedItem.children.length > 0 &&
          !selectedItem.collapsed
        ) {
          const childSelected = getLowestSelected(selectedItem.children);
          if (childSelected) {
            return childSelected;
          }
        }
      }
      return selectedItem;
    };
    const selectedItem = getLowestSelected(this.standardSection().items);
    if (selectedItem) {
      return selectedItem.id;
    }
    return null;
  };

  _onShiftItem = (delta, cb) => {
    let forceUpdate = false;
    if (!this._keyboardFocusKey) {
      this._keyboardFocusKey = this._findKeyboardFocusKeyFromCurrentSelected();
      forceUpdate = true;
    }
    if (!this._keyboardFocusKey) {
      return;
    }
    const sections = this.flattenStandardSections();
    const currentIndex = sections.findIndex(section => section.id === this._keyboardFocusKey);
    let nextIndex = currentIndex + delta;
    if (nextIndex < 0) {
      nextIndex = 0;
    } else if (nextIndex >= sections.length) {
      nextIndex = sections.length - 1;
    }
    if (currentIndex !== nextIndex || forceUpdate) {
      const nextItem = sections[nextIndex];
      this._keyboardFocusKey = nextItem.id;
      sections[nextIndex].onSelect(nextItem);
      if (cb) {
        cb(this._keyboardFocusKey);
      }
      if (
        nextItem.hideWhenCrowded &&
        Array.isArray(nextItem.accountIds) &&
        nextItem.accountIds.length === 1
      ) {
        this.setItemShowAllChildren(`${nextItem.accountIds[0]}-single-moreToggle`, true);
      }
    }
  };
  _toggleItemHide = item => {
    if (item) {
      item.toggleHide(item);
    }
  };

  _registerListeners() {
    this.listenTo(Actions.setEditingMenu, this._onSetEditingMenu);
    this.listenTo(Actions.setCollapsedSidebarItem, this._onSetCollapsedByName);
    this.listenTo(SidebarActions.toggleMore, this.setItemShowAllChildren);
    this.listenTo(SidebarActions.setKeyCollapsed, this._onSetCollapsedByKey);
    this.listenTo(
      SidebarActions.requestAddFolderAccountSelection,
      this._onAddFolderAccountSelection
    );
    this.listenTo(SidebarActions.cancelMenuChanges, this._onCancelMenuChanges);
    this.listenTo(SidebarActions.saveMenuChanges, this._onSaveMenuChanges);
    this.listenTo(SidebarActions.addingNewFolderToAccount, this._onAddingNewFolderToAccount);
    this.listenTo(SidebarActions.updateNewFolderData, this._onUpdateNewFolderData);
    this.listenTo(SidebarActions.saveNewFolderRequest, this._onSaveNewFolderRequest);
    this.listenTo(SidebarActions.cancelAddFolderRequest, this._onCancelNewFolderRequest);
    this.listenTo(AccountStore, this._onAccountsChanged);
    this.listenTo(FocusedPerspectiveStore, this._onFocusedPerspectiveChanged);
    this.listenTo(WorkspaceStore, this._updateSections);
    this.listenTo(OutboxStore, this._updateSections);
    this.listenTo(ThreadCountsStore, this._updateSections);
    this.listenTo(CategoryStore, this._updateSections);

    this.configSubscription = AppEnv.config.onDidChange(
      'core.workspace.showUnreadForAllCategories',
      this._updateSections
    );
  }
  getNewFolder(accountId) {
    if (!accountId) {
      return this._newFolder.accountId ? this._newFolder : null;
    }
    if (this._newFolder.accountId === accountId) {
      return this._newFolder;
    }
    return null;
  }
  _onAddFolderAccountSelection = () => {
    Actions.openPopover(<NewCategoryAccountSelectPopover accounts={AccountStore.accounts()} />, {
      popoverClassName: 'fixed-popover-add-folder',
      isFixedToWindow: true,
      originRect: {
        top: 0,
        left: 0,
      },
      position: { top: '30%', left: '50%' },
      disablePointer: true,
      closeOnAppBlur: true,
      onClose: () => this._onCancelNewFolderRequest(true),
    });
  };
  _onAddingNewFolderToAccount = ({ accountId, newFolderName, isHiddenInFolderTree }) => {
    this._onUpdateNewFolderData({ accountId, newFolderName, isHiddenInFolderTree });
    this._updateSections();
  };
  _onUpdateNewFolderData = ({ accountId, newFolderName, isHiddenInFolderTree }) => {
    if (!accountId) {
      return;
    }
    this._newFolder = { accountId, newFolderName, isHiddenInFolderTree };
  };
  _onCancelNewFolderRequest = (autoClose = false) => {
    if (autoClose && this._newFolder.accountId) {
      return;
    }
    this._newFolder = { accountId: null };
    Actions.setEditingMenu(false);
    this._updateSections();
  };
  _onSaveNewFolderRequest = () => {
    if (!this._newFolder.accountId) {
      return;
    }
    const accountId = this._newFolder.accountId;
    const name = this._newFolder.newFolderName;
    const isHidden = this._newFolder.isHiddenInFolderTree;
    const task = TaskFactory.tasksForCreatingPath({
      name,
      accountId,
    });
    if (task) {
      TaskQueue.waitForPerformRemote(task).then(finishedTask => {
        if (!finishedTask.created) {
          AppEnv.showErrorDialog({ title: 'Error', message: `Could not create folder.` });
          return;
        }
        const category = finishedTask.created;
        if (isHidden) {
          AppEnv.logDebug(`${accountId} ${category.id || category.pid} is Hidden`);
          CategoryStore.hideCategoryById({
            accountId,
            categoryId: category.id || category.pid,
            save: true,
          });
          this._updateSections();
          AppEnv.logDebug(
            `${accountId} ${category.id || category.pid} category data saved to storage`
          );
        }
      });
      Actions.queueTask(task);
    }
    this._newFolder = { accountId: null };
    Actions.setEditingMenu(false);
  };

  _onCancelMenuChanges = () => {
    this._newFolder = { accountId: null };
    Actions.cancelCategoryMeteDataChange();
    Actions.setEditingMenu(false);
    this._updateSections();
  };
  _onSaveMenuChanges = () => {
    Actions.saveCategoryMetaDataChange();
    if (this._newFolder.accountId) {
      this._onSaveNewFolderRequest();
    }
    this._newFolder = { accountId: null };
    Actions.setEditingMenu(false);
    this._updateSections();
  };
  _onSetEditingMenu = val => {
    if (val !== this._editingMenu) {
      this._editingMenu = val;
      if (!val) {
        this._newFolder = { accountId: null };
        this._updateSections();
      } else {
        this.trigger();
      }
    }
  };
  isEditingMenu = () => {
    return this._editingMenu;
  };

  _onSetCollapsedByKey = (itemKey, collapsed) => {
    const currentValue = AppEnv.savedState.sidebarKeysCollapsed[itemKey];
    if (currentValue !== collapsed) {
      AppEnv.savedState.sidebarKeysCollapsed[itemKey] = collapsed;
      this._updateSections();
    }
  };

  setAllCollapsed = () => {
    const sections = this.standardSection();
    const items = sections ? sections.items : [];
    items.forEach(item => {
      if (item && !nonFolderIds.includes(item.id)) {
        this._onSetCollapsedByKey(item.id, true);
      }
    });
  };

  _onSetCollapsedByName = (itemName, collapsed) => {
    let item = _.findWhere(this.standardSection().items, { name: itemName });
    if (!item) {
      for (let section of this.userSections()) {
        item = _.findWhere(section.items, { name: itemName });
        if (item) {
          break;
        }
      }
    }
    if (!item) {
      return;
    }
    this._onSetCollapsedByKey(item.id, collapsed);
  };

  _registerCommands = accounts => {
    if (accounts == null) {
      accounts = AccountStore.accounts();
    }
    AccountCommands.registerCommands(accounts);
  };

  _registerMenuItems = accounts => {
    if (accounts == null) {
      accounts = AccountStore.accounts();
    }
    const currentPerspective = FocusedPerspectiveStore.current();
    let currentSelectedAccountIds = [];
    if (currentPerspective) {
      if (Array.isArray(currentPerspective.accountIds)) {
        currentSelectedAccountIds = currentPerspective.accountIds;
      } else if (currentPerspective.accountIds) {
        currentSelectedAccountIds = [currentPerspective.accountIds];
      }
    }
    AccountCommands.registerMenuItems(accounts, currentSelectedAccountIds);
  };

  _registerTrayItems = () => {
    AccountCommands.registerTrayItems();
  };

  // TODO Refactor this
  // Listen to changes on the account store only for when the account label
  // or order changes. When accounts or added or removed, those changes will
  // come in through the FocusedPerspectiveStore
  _onAccountsChanged = () => {
    this._updateSections();
  };

  // TODO Refactor this
  // The FocusedPerspectiveStore tells this store the accounts that should be
  // displayed in the sidebar (i.e. unified inbox vs single account) and will
  // trigger whenever an account is added or removed, as well as when a
  // perspective is focused.
  // However, when udpating the SidebarSections, we also depend on the actual
  // accounts in the AccountStore. The problem is that the FocusedPerspectiveStore
  // triggers before the AccountStore is actually updated, so we need to wait for
  // the AccountStore to get updated (via `defer`) before updateing our sidebar
  // sections
  _onFocusedPerspectiveChanged = () => {
    _.defer(() => {
      this._registerCommands();
      this._registerMenuItems();
      this._registerTrayItems();
      this._updateSections();
    });
  };

  _updateSections = () => {
    const accounts = FocusedPerspectiveStore.sidebarAccountIds()
      .map(id => AccountStore.accountForId(id))
      .filter(a => !!a);

    if (accounts.length === 0) {
      console.warn(`accounts is []`);
      return;
    }
    console.log('sidebar store change');
    this._sections[Sections.Standard] = SidebarSection.standardSectionForAccounts(accounts);
    console.log('sidebar store change finished');
    const keyboardFocusKey = this._findKeyboardFocusKeyFromCurrentSelected();
    if (keyboardFocusKey !== this._keyboardFocusKey) {
      this._keyboardFocusKey = keyboardFocusKey;
    }
    // this._sections[Sections.User] = accounts.map(function(acc) {
    //   const opts = {};
    //   if (multiAccount) {
    //     opts.title = acc.label;
    //     opts.collapsible = true;
    //   }
    //   return SidebarSection.forUserCategories(acc, opts);
    // });
    this.trigger();
  };
}

module.exports = new SidebarStore();
