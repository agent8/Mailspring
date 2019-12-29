import _ from 'underscore';
import { Categories } from 'mailspring-observables';
import MailspringStore from 'mailspring-store';
import AccountStore from './account-store';
import Account from '../models/account';
import Category from '../models/category';
import Actions from '../actions';

const asAccount = a => {
  if (!a) {
    throw new Error('You must pass an Account or Account Id');
  }
  return a instanceof Account ? a : AccountStore.accountForId(a);
};

const asAccountId = a => {
  if (!a) {
    throw new Error('You must pass an Account or Account Id');
  }
  return a instanceof Account ? a.id : a;
};

const categoryUpdatingTimeout = 60000;

class CategoryStore extends MailspringStore {
  constructor() {
    super();
    this._categoryCache = {};
    this._standardCategories = {};
    this._userCategories = {};
    this._hiddenCategories = {};
    this._categorySyncState = {};

    AppEnv.config.onDidChange('core.workspace.showImportant', () => {
      if (this._categoryResult) {
        this._onCategoriesChanged(this._categoryResult);
      }
    });

    Categories.forAllAccounts()
      .sort()
      .subscribe(this._onCategoriesChanged);
    Actions.syncFolders.listen(this._onSyncCategory, this);
  }
  decodePath(pathString) {
    return Category.pathToDisplayName(pathString);
  }

  byId(accountOrId, categoryId) {
    const categories = this._categoryCache[asAccountId(accountOrId)] || {};
    return categories[categoryId];
  }

  // Public: Returns an array of all categories for an account, both
  // standard and user generated. The items returned by this function will be
  // either {Folder} or {Label} objects.
  //
  categories(accountOrId = null) {
    if (accountOrId) {
      const cached = this._categoryCache[asAccountId(accountOrId)];
      return cached ? Object.values(cached) : [];
    }
    let all = [];
    for (const accountCategories of Object.values(this._categoryCache)) {
      all = all.concat(Object.values(accountCategories));
    }
    return all;
  }

  // Public: Returns all of the standard categories for the given account.
  //
  standardCategories(accountOrId) {
    return this._standardCategories[asAccountId(accountOrId)] || [];
  }

  hiddenCategories(accountOrId) {
    return this._hiddenCategories[asAccountId(accountOrId)] || [];
  }

  // Public: Returns all of the categories that are not part of the standard
  // category set.
  //
  userCategories(accountOrId) {
    return this._userCategories[asAccountId(accountOrId)] || [];
  }

  // Public: Returns the Folder or Label object for a standard category name and
  // for a given account.
  // ('inbox', 'drafts', etc.) It's possible for this to return `null`.
  // For example, Gmail likely doesn't have an `archive` label.
  //
  getCategoryByRole(accountOrId, role) {
    if (!accountOrId) {
      return null;
    }

    if (!Category.StandardRoles.includes(role)) {
      throw new Error(`'${role}' is not a standard category`);
    }

    const accountCategories = this._standardCategories[asAccountId(accountOrId)];
    return (accountCategories && accountCategories.find(c => c.role === role)) || null;
  }

  // Public: Returns the set of all standard categories that match the given
  // names for each of the provided accounts
  getCategoriesWithRoles(accountsOrIds, ...names) {
    if (Array.isArray(accountsOrIds)) {
      let res = [];
      for (const accOrId of accountsOrIds) {
        const cats = names.map(name => this.getCategoryByRole(accOrId, name));
        res = res.concat(_.compact(cats));
      }
      return res;
    }
    return _.compact(names.map(name => this.getCategoryByRole(accountsOrIds, name)));
  }

  // Public: Returns the Folder or Label object that should be used for "Archive"
  // actions. On Gmail, this is the "all" label. On providers using folders, it
  // returns any available "Archive" folder, or null if no such folder exists.
  //
  getArchiveCategory(accountOrId) {
    if (!accountOrId) {
      return null;
    }
    const account = asAccount(accountOrId);
    if (!account) {
      return null;
    }

    return (
      this.getCategoryByRole(account.id, 'archive') || this.getCategoryByRole(account.id, 'all')
    );
  }

  // Public: Returns Label object for "All mail"
  //
  getAllMailCategory(accountOrId) {
    if (!accountOrId) {
      return null;
    }
    const account = asAccount(accountOrId);
    if (!account) {
      return null;
    }

    return this.getCategoryByRole(account.id, 'all');
  }

  // Public: Returns the Folder or Label object that should be used for
  // the inbox or null if it doesn't exist
  //
  getInboxCategory(accountOrId) {
    return this.getCategoryByRole(accountOrId, 'inbox');
  }

  // Public: Returns the Folder or Label object that should be used for
  // "Move to Trash", or null if no trash folder exists.
  //
  getTrashCategory(accountOrId) {
    return this.getCategoryByRole(accountOrId, 'trash');
  }

  // Public: Returns the Folder or Label object that should be used for
  // "Move to Spam", or null if no trash folder exists.
  //
  getSpamCategory(accountOrId) {
    return this.getCategoryByRole(accountOrId, 'spam');
  }

  isCategorySyncing = categoryId => {
    if (!categoryId || typeof categoryId !== 'string' || (categoryId.length === 0)) {
      return false;
    }
    const now = Date.now();
    if (!this._categorySyncState[categoryId]) {
      this._categorySyncState[categoryId] = { syncing: false, lastUpdate: now };
    } else {
      const lastUpdate = this._categorySyncState[categoryId].lastUpdate;
      if (
        now - lastUpdate > categoryUpdatingTimeout &&
        this._categorySyncState[categoryId].syncing
      ) {
        this._categorySyncState[categoryId] = { syncing: false, lastUpdate: now };
      }
    }
    return this._categorySyncState[categoryId].syncing;
  };

  _onSyncCategory = data => {
    if (!Array.isArray(data.foldersIds)) {
      return;
    }
    const categoryIds = data.foldersIds;
    const now = Date.now();
    categoryIds.forEach(id => {
      this._categorySyncState[id] = { syncing: true, lastUpdate: now };
    });
    this.trigger();
  };

  // We assume when we got message for particular category, that category have finished syncing.
  _onCategoryFinishedSyncing = (category, trigger = true) => {
    const now = Date.now();
    this._categorySyncState[category.id] = { syncing: false, lastUpdate: now };
    if (trigger) {
      this.trigger();
    }
  };

  _onCategoriesChanged = categories => {
    this._categoryResult = categories;
    const categoryCache = {};
    for (const cat of categories) {
      categoryCache[cat.accountId] = categoryCache[cat.accountId] || {};
      // don't overwrite bgColor
      const oldCat = this._categoryCache[cat.accountId] ? this._categoryCache[cat.accountId][cat.id] : null;
      if (oldCat && oldCat.bgColor && oldCat.id === cat.id) {
        cat.bgColor = oldCat.bgColor;
      }
      categoryCache[cat.accountId][cat.id] = cat;
      this._onCategoryFinishedSyncing(cat, false);
    }
    this._categoryCache = categoryCache;

    const filteredByAccount = fn => {
      const result = {};
      for (const cat of categories) {
        if (!fn(cat)) {
          continue;
        }
        result[cat.accountId] = result[cat.accountId] || [];
        result[cat.accountId].push(cat);
      }
      return result;
    };

    this._standardCategories = filteredByAccount(cat => cat.isStandardCategory());
    this._userCategories = filteredByAccount(cat => cat.isUserCategory());
    this._hiddenCategories = filteredByAccount(cat => cat.isHiddenCategory());

    // Ensure standard categories are always sorted in the correct order
    for (const accountCategories of Object.values(this._standardCategories)) {
      accountCategories.sort(
        (a, b) => Category.StandardRoles.indexOf(a.name) - Category.StandardRoles.indexOf(b.name)
      );
    }
    this.trigger();
  };
}

export default new CategoryStore();
