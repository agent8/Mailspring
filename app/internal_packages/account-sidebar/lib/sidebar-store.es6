const _ = require('underscore');
const MailspringStore = require('mailspring-store').default;
const {
  Actions,
  AccountStore,
  ThreadCountsStore,
  WorkspaceStore,
  OutboxStore,
  FocusedPerspectiveStore,
  CategoryStore,
} = require('mailspring-exports');

const SidebarSection = require('./sidebar-section');
const SidebarActions = require('./sidebar-actions');
const AccountCommands = require('./account-commands');

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
      sections = Object.values(this.standardSection().items).filter(i => i.id !== 'divider');
    }
    sections.forEach(section => {
      if (!section) {
        return;
      }
      ret.push(section);
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
      this._keyboardFocusKey = sections[nextIndex].id;
      sections[nextIndex].onSelect(sections[nextIndex]);
      if (cb) {
        cb(this._keyboardFocusKey);
      }
    }
  };

  _registerListeners() {
    this.listenTo(Actions.setCollapsedSidebarItem, this._onSetCollapsedByName);
    this.listenTo(SidebarActions.setKeyCollapsed, this._onSetCollapsedByKey);
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
      if (item && item.id !== 'divider') {
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
    // const multiAccount = accounts.length > 1;

    this._sections[Sections.Standard] = SidebarSection.standardSectionForAccounts(accounts);
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
