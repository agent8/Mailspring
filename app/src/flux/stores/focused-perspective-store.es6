import _ from 'underscore';
import MailspringStore from 'mailspring-store';
import AccountStore from './account-store';
import OutboxStore from './outbox-store';
import WorkspaceStore from './workspace-store';
import MailboxPerspective from '../../mailbox-perspective';
import CategoryStore from './category-store';
import Actions from '../actions';

class FocusedPerspectiveStore extends MailspringStore {
  constructor() {
    super();
    this._current = MailboxPerspective.forNothing();
    this._currentSidebar = MailboxPerspective.forNothing();
    this._initialized = false;
    this._refreshPerspectiveTimer = null;

    this.listenTo(CategoryStore, this._onCategoryStoreChanged);
    this.listenTo(Actions.focusMailboxPerspective, this._onFocusPerspective);
    this.listenTo(
      Actions.focusDefaultMailboxPerspectiveForAccounts,
      this._onFocusDefaultPerspectiveForAccounts
    );
    this.listenTo(Actions.ensureCategoryIsFocused, this._onEnsureCategoryIsFocused);
    this._listenToCommands();
    AppEnv.config.onDidChange('core.workspace.enableFocusedInbox', this._onFocusedInboxToggle);
    AppEnv.config.onDidChange('core.appearance.dateFormat', this._onDateFormatChange);
    AppEnv.config.onDidChange('core.workspace.use24HourClock', this._onDateFormatChange);
  }

  current() {
    return this._current;
  }

  currentSidebar() {
    return this._currentSidebar;
  }

  getLastUpdatedTime() {
    const current = this.current();
    let lastUpdate = 0;
    if (current && current.categories() && current.categories().length) {
      current.categories().forEach(cat => {
        let tmp = CategoryStore.byId(cat.accountId, cat.id);
        if (!tmp) {
          return lastUpdate;
        }
        if (tmp.updatedAt) {
          if (tmp.updatedAt.getTime() > lastUpdate) {
            lastUpdate = tmp.updatedAt;
          }
        }
      });
    }
    return lastUpdate;
  }

  sidebarAccountIds() {
    let ids = AppEnv.savedState.sidebarAccountIds;
    // if (!ids || !ids.length || !ids.every(id => AccountStore.accountForId(id))) {
    ids = AppEnv.savedState.sidebarAccountIds = AccountStore.accountIds();
    // }

    // Always defer to the AccountStore for the desired order of accounts in
    // the sidebar - users can re-arrange them!
    const order = AccountStore.accountIds();
    ids = ids.sort((a, b) => order.indexOf(a) - order.indexOf(b));

    return ids;
  }

  _listenToCommands() {
    AppEnv.commands.add(document.body, {
      'navigation:got-to-outbox': () => {
        this.gotoOutbox();
      },
      'navigation:go-to-all-unread': () => {
        this._setPerspective(MailboxPerspective.forUnreadByAccounts(this.sidebarAccountIds()));
      },
      'navigation:go-to-all-inbox': () => this.gotoAllInbox(),
      'navigation:go-to-all-sent': () =>
        this._setPerspective(MailboxPerspective.forSent(this.sidebarAccountIds())),
      'navigation:go-to-starred': () =>
        this._setPerspective(MailboxPerspective.forStarred(this._current.accountIds)),
      'navigation:go-to-drafts': () =>
        this._setPerspective(MailboxPerspective.forDrafts(this._current.accountIds)),
      'navigation:go-to-all': () => {
        const categories = this._current.accountIds.map(id => CategoryStore.getArchiveCategory(id));
        this._setPerspective(MailboxPerspective.forCategories(categories));
      },
      'navigation:go-to-chat': () => this.gotoChat(),
      // 'navigation:go-to-contacts': () => {}, // TODO,
      // 'navigation:go-to-tasks': () => {}, // TODO,
      // 'navigation:go-to-label': () => {}, // TODO,
    });
  }
  gotoOutbox = () => {
    console.log('go to outbox');
    const total = OutboxStore.count().total;
    if (total > 0) {
      this._setPerspective(MailboxPerspective.forOutbox(this.sidebarAccountIds()));
    }
  };

  gotoChat = () => {
    Actions.goToMostRecentChat();
    Actions.popToRootSheet({ reason: 'FocusedPerspectiveStore:gotoChat' });
    Actions.selectRootSheet(WorkspaceStore.Sheet.ChatView);
  };

  gotoAllInbox = () => {
    return this._setPerspective(MailboxPerspective.forInbox(this.sidebarAccountIds()));
  };

  _isValidAccountSet(ids) {
    const accountIds = AccountStore.accountIds();
    return ids.every(a => accountIds.includes(a));
  }

  _isValidPerspective(perspective) {
    // Ensure all the accountIds referenced in the perspective still exist
    if (!this._isValidAccountSet(perspective.accountIds)) {
      return false;
    }

    // Ensure all the categories referenced in the perspective still exist
    const categoriesStillExist = perspective.categories().every(c => {
      return !!CategoryStore.byId(c.accountId, c.id);
    });
    if (!categoriesStillExist) {
      return false;
    }

    return true;
  }

  _initializeFromSavedState() {
    const json = AppEnv.savedState.perspective;
    let { sidebarAccountIds } = AppEnv.savedState;
    let perspective;

    if (json) {
      perspective = MailboxPerspective.fromJSON(json);
    }
    this._initialized = true;

    if (!perspective || !this._isValidPerspective(perspective)) {
      perspective = this._defaultPerspective();
      sidebarAccountIds = perspective.accountIds;
      this._initialized = false;
    }

    if (
      !sidebarAccountIds ||
      !this._isValidAccountSet(sidebarAccountIds) ||
      sidebarAccountIds.length < perspective.accountIds.length
    ) {
      sidebarAccountIds = perspective.accountIds;
      this._initialized = false;
    }

    this._setPerspective(perspective, sidebarAccountIds);
  }

  // Inbound Events
  _onCategoryStoreChanged = () => {
    if (!this._initialized && AppEnv.isMainWindow()) {
      this._initializeFromSavedState();
    } else if (!this._isValidPerspective(this._current)) {
      this._setPerspective(this._defaultPerspective(this._current.accountIds));
    } else {
      this._onCurrentPerspectiveCategoryNameChange();
    }
  };

  _onFocusPerspective = (perspective, forceTrigger = false) => {
    // If looking at unified inbox, don't attempt to change the sidebar accounts
    const sidebarIsUnifiedInbox = this.sidebarAccountIds().length > 1;
    if (sidebarIsUnifiedInbox) {
      this._setPerspective(perspective, null, forceTrigger);
    } else {
      this._setPerspective(perspective, perspective.accountIds, forceTrigger);
    }
  };

  /*
   * Takes an optional array of `sidebarAccountIds`. By default, this method will
   * set the sidebarAccountIds to the perspective's accounts if no value is
   * provided
   */
  _onFocusDefaultPerspectiveForAccounts = (accountsOrIds, { sidebarAccountIds } = {}) => {
    if (!accountsOrIds) {
      return;
    }
    const perspective = this._defaultPerspective(accountsOrIds);
    this._setPerspective(perspective, sidebarAccountIds || perspective.accountIds);
  };

  _onEnsureCategoryIsFocused = (categoryName, accountIds = [], forceTrigger = false) => {
    // if current is All Inboxes, don't navigate to the specific inbox
    if (this.current().accountIds.length > 1) {
      accountIds = this.sidebarAccountIds();
    }
    const ids = accountIds instanceof Array ? accountIds : [accountIds];
    const categories = ids.map(id => CategoryStore.getCategoryByRole(id, categoryName));
    const perspective = MailboxPerspective.forCategories(categories);
    this._onFocusPerspective(perspective, forceTrigger);
  };

  _defaultPerspective(accountsOrIds = AccountStore.accountIds()) {
    const perspective = MailboxPerspective.forInbox(accountsOrIds);

    // If no account ids were selected, or the categories for these accounts have
    // not loaded yet, return forNothing(). This means that the next time the
    // CategoryStore triggers, we'll try again.
    if (perspective.categories().length === 0) {
      return MailboxPerspective.forNothing();
    }
    return perspective;
  }
  _isInChatView() {
    const currentSheet = WorkspaceStore.topSheet();
    return currentSheet && currentSheet.id === 'ChatView';
  }

  _setPerspective(perspective, sidebarAccountIds, forceTrigger = false) {
    if (!(perspective instanceof MailboxPerspective)) {
      return;
    }
    // Should back to mail list if click account or inbox while one mail is opened in reading pane off mode
    if (perspective.isEqual(this._currentSidebar) && !this._isInChatView()) {
      const topSheet = WorkspaceStore.topSheet();
      if (topSheet && topSheet.id === 'Thread') {
        Actions.popSheet({
          reason: 'Thread View, same perspective clicked',
        });
      }
    }

    let shouldTrigger = forceTrigger;
    let focusPerspective;

    if (perspective.isTab) {
      // if this perspective is a tab, it must be a tab of this current sidebar
      if (!perspective.isTabOfPerspective(this._currentSidebar)) {
        return;
      }
      focusPerspective = perspective;
    } else {
      // if this perspective not a tab, judge if current sidebar need to update
      if (!perspective.isEqual(this._currentSidebar)) {
        this._currentSidebar = perspective;
        AppEnv.savedState.perspective = perspective.toJSON();
        shouldTrigger = true;
      }
      if (perspective.tab && perspective.tab.length) {
        focusPerspective = perspective.tab[0];
      } else {
        focusPerspective = perspective;
      }
    }

    if (!focusPerspective.isEqual(this._current)) {
      this._current = focusPerspective;
      shouldTrigger = true;
    } else if (this._isInChatView()) {
      console.log('trigger because we are in chat view');
      shouldTrigger = true;
    }

    const shouldSaveSidebarAccountIds =
      sidebarAccountIds &&
      !_.isEqual(AppEnv.savedState.sidebarAccountIds, sidebarAccountIds) &&
      this._initialized === true;
    if (shouldSaveSidebarAccountIds) {
      AppEnv.savedState.sidebarAccountIds = sidebarAccountIds;
      shouldTrigger = true;
    }

    if (shouldTrigger) {
      if (this._refreshPerspectiveTimer) {
        clearTimeout(this._refreshPerspectiveTimer);
        this._refreshPerspectiveTimer = null;
      }
      this._refreshPerspectiveTimer = setTimeout(() => {
        this.refreshPerspectiveMessages();
        this._refreshPerspectiveTimer = null;
      }, 700);
      this.trigger();
    }

    let desired = focusPerspective.sheet();

    // Always switch to the correct sheet and pop to root when perspective set
    if (desired && WorkspaceStore.rootSheet() !== desired) {
      Actions.selectRootSheet(desired);
    }
    Actions.popToRootSheet({
      reason: 'FocusedPerspectiveStore:setPerspective',
    });
  }

  _setPerspectiveByName(categoryName) {
    let categories = this._current.accountIds.map(id => {
      return CategoryStore.getCategoryByRole(id, categoryName);
    });
    categories = _.compact(categories);
    if (categories.length === 0) {
      return;
    }
    this._setPerspective(MailboxPerspective.forCategories(categories));
  }

  _onFocusedInboxToggle = () => {
    Actions.popToRootSheet({ reason: 'focused inbox toggle' });
    const json = this.currentSidebar().toJSON();
    let newPerspective = MailboxPerspective.fromJSON(json);
    if (!newPerspective || !this._isValidPerspective(newPerspective)) {
      newPerspective = this._defaultPerspective();
    }
    this._currentSidebar = newPerspective;
    if (newPerspective.tab && newPerspective.tab.length) {
      this._current = newPerspective.tab[0];
    } else {
      this._current = newPerspective;
    }
    this.trigger();
  };

  _onDateFormatChange = () => {
    Actions.popToRootSheet({ reason: 'date format change' });
    const accountsIds = AccountStore.accountIds();
    const perspective = this._defaultPerspective(accountsIds);
    this._setPerspective(perspective, accountsIds || perspective.accountIds, true);
  };
  _onCurrentPerspectiveCategoryNameChange = () => {
    const currentPerspective = this.current();
    const currentSidebar = this.currentSidebar();
    const updatePerspective = perspective => {
      if (perspective && typeof perspective.updateCategories === 'function') {
        const categories = perspective.categories();
        if (Array.isArray(categories) && categories.length === 1) {
          const currentCategory = categories[0];
          if (currentCategory && !currentCategory.role) {
            const newCategory = CategoryStore.byId(currentCategory.accountId, currentCategory.id);
            if (newCategory && newCategory.displayName !== currentCategory.displayName) {
              perspective.updateCategories([newCategory]);
              return true;
            }
          }
        }
      }
    };
    let changed = updatePerspective(currentPerspective);
    changed = changed || updatePerspective(currentSidebar);
    if (changed) {
      this.trigger();
    }
  };

  refreshPerspectiveMessages({ perspective = null, source = 'folderItem' } = {}) {
    if (!perspective) {
      perspective = this.current();
    }
    if (!perspective) {
      return;
    }
    const accounts = {};
    if (perspective.categories && perspective.categories().length > 0) {
      perspective.categories().forEach(cat => {
        if (!accounts[cat.accountId]) {
          accounts[cat.accountId] = [];
        }
        accounts[cat.accountId].push(cat.id);
      });
      if (!perspective.noneSelectable) {
        for (let key of Object.keys(accounts)) {
          Actions.syncFolders({
            accountId: key,
            foldersIds: accounts[key],
            source,
          });
        }
      }
    } else if (
      perspective.categoryIds &&
      perspective.categoryIds.length === perspective.accountIds.length
    ) {
      for (let i = 0; i < perspective.categoryIds.length; i++) {
        accounts[perspective.accountIds[i]] = [perspective.categoryIds[i]];
        if (!perspective.noneSelectable) {
          Actions.syncFolders({
            accountId: perspective.accountIds[i],
            foldersIds: [perspective.categoryIds[i]],
            source,
          });
        }
      }
    }
    return accounts;
  }
}

export default new FocusedPerspectiveStore();
