import _ from 'underscore';
import MailspringStore from 'mailspring-store';
import AccountStore from './account-store';
import OutboxStore from './outbox-store';
import WorkspaceStore from './workspace-store';
import MailboxPerspective from '../../mailbox-perspective';
import CategoryStore from './category-store';
import Actions from '../actions';
import Label from '../models/label';

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
      'navigation:go-to-contacts': () => {}, // TODO,
      'navigation:go-to-tasks': () => {}, // TODO,
      'navigation:go-to-label': () => {}, // TODO,
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
    if (!this._initialized) {
      this._initializeFromSavedState();
    } else if (!this._isValidPerspective(this._current)) {
      this._setPerspective(this._defaultPerspective(this._current.accountIds));
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

  _isTabOfCurrentSidebar(perspective) {
    if (!perspective.isTab) {
      return false;
    }
    const tab = this._currentSidebar.tab || [];
    const equalTab = tab.filter(per => {
      return perspective.isEqual(per);
    });
    return equalTab.length > 0;
  }

  _setPerspective(perspective, sidebarAccountIds, forceTrigger = false) {
    if (perspective.isTab) {
      // if this perspective is a tab, it must be a tab of this current sidebar

      if (!this._isTabOfCurrentSidebar(perspective)) {
        return;
      }
    } else {
      // if this perspective not a tab, judge if current sidebar need to update

      if (perspective.isEqual(this._currentSidebar)) {
        return;
      } else {
        this._currentSidebar = perspective;
        AppEnv.savedState.perspective = perspective.toJSON();
      }
    }

    let focusPerspective;
    if (perspective.tab && perspective.tab.length) {
      focusPerspective = perspective.tab[0];
    } else {
      focusPerspective = perspective;
    }

    let shouldTrigger = forceTrigger;

    if (!focusPerspective.isEqual(this._current)) {
      this._current = focusPerspective;
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
    Actions.popToRootSheet({ reason: 'FocusedPerspectiveStore:setPerspective' });
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
      for (let key of Object.keys(accounts)) {
        Actions.syncFolders({ accountId: key, foldersIds: accounts[key], source });
      }
    } else if (
      perspective.categoryIds &&
      perspective.categoryIds.length === perspective.accountIds.length
    ) {
      for (let i = 0; i < perspective.categoryIds.length; i++) {
        accounts[perspective.accountIds[i]] = [perspective.categoryIds[i]];
        Actions.syncFolders({
          accountId: perspective.accountIds[i],
          foldersIds: [perspective.categoryIds[i]],
          source
        });
      }
    }
    return accounts;
  }
}

export default new FocusedPerspectiveStore();
