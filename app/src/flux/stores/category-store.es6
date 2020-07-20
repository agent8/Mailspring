import _ from 'underscore';
import MailspringStore from 'mailspring-store';
import DatabaseStore from './database-store';
import AccountStore from './account-store';
import Account from '../models/account';
import Category from '../models/category';
import Actions from '../actions';
import FolderState from '../models/folder-state';
import Folder from '../models/folder';
import crypto from 'crypto';
import utf7 from 'utf7';
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

const categoryUpdatingTimeout = 300000;

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
    DatabaseStore.findAll(Folder, { state: 0 })
      .order(Folder.attributes.name.ascending())
      .then(this._onCategoriesChanged);
    Actions.syncFolders.listen(this._onSyncCategory, this);
    this.listenTo(DatabaseStore, this._onFolderStateChange);
  }
  decodePath(pathString) {
    return Category.pathToDisplayName(pathString);
  }
  byFolderId(categoryId) {
    const accountIds = Object.keys(this._categoryCache);
    for (let accountId of accountIds) {
      const category = this.byId(accountId, categoryId);
      if (category) {
        return category;
      }
    }
    return null;
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
  getCategoryParent = category => {
    const account = AccountStore.accountForId(category.accountId);
    if (account && category) {
      const isExchange = account.provider.includes('exchange');
      let parent = null;
      if (isExchange) {
        const inboxCategory = this.getInboxCategory(account.id);
        if (inboxCategory && category.parentId === inboxCategory.parentId) {
          return null;
        }
        parent = this.getCategoryByPath(category.parentId);
      } else {
        const parentComponents = category.path.split(category.delimiter);
        if (parentComponents.length > 1) {
          let k = 1;
          while (!parent && k <= parentComponents.length - 1) {
            parent = this.getCategoryByPath(
              parentComponents.slice(0, k).join(category.delimiter),
              account.id
            );
            if (parent && parent.role === 'inbox') {
              parent = null;
            }
            k++;
          }
        }
      }
      return parent;
    }
    return null;
  };

  getCategoryByPath(path, accountId = '') {
    if (accountId) {
      const cache = this._categoryCache && this._categoryCache[accountId];
      if (cache) {
        return Object.values(cache).find(cat => cat && cat.path === path);
      }
    }
    if (Array.isArray(this._categoryResult)) {
      return this._categoryResult.find(cat => cat && cat.path === path);
    }
    return null;
  }

  isCategorySyncing = categoryId => {
    if (!categoryId || typeof categoryId !== 'string' || categoryId.length === 0) {
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
  _onFolderStateChange = ({ objectClass, objects, processAccountId }) => {
    if (objectClass === Folder.name) {
      return this._onCategoriesChanged(objects, processAccountId);
    }
    if (objectClass !== FolderState.name) {
      return;
    }
    let updated = false;
    objects.forEach(folderState => {
      const folder = this.byFolderId(folderState.accountId, folderState.id);
      if (folder) {
        updated = true;
        folder.updatedAt = folderState.lastSynced;
      }
    });
    if (updated) {
      this.trigger();
    }
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
  _generateParents(category, stopAtAncestor = 0) {
    if (!category.selectable || !!category.role) {
      return [];
    }
    const paths = category.path.split(category.delimiter);
    const ret = [];
    if (paths.length > 1) {
      let i = paths.length - 2;
      while (i >= 0 && i >= stopAtAncestor) {
        const path = paths.slice(0, i + 1).join(category.delimiter);
        const id = crypto
          .createHash('md5')
          .update(`${category.accountId}${path}`)
          .digest('hex');
        const newFolder = new Folder({
          id,
          path,
          accountId: category.accountId,
          name: utf7.imap.encode(path),
          type: category.type,
          selectable: false,
          delimiter: category.delimiter,
          state: 0,
          role: '',
        });
        if (newFolder.pathWithPrefixStripped().length > 0) {
          ret.unshift(newFolder);
        }
        i--;
      }
    }
    return ret;
  }
  _createMissingParentPathAfterSortedByName(categories) {
    if (!Array.isArray(categories) || categories.length === 0) {
      return [];
    }
    if (categories.length === 1) {
      return this._generateParents(categories[0]);
    }
    const ret = [];
    let lastCategory = categories[categories.length - 1];
    let lastLayers = lastCategory.displayName.split(lastCategory.delimiter);
    ret.push(lastCategory);
    for (let i = categories.length - 2; i > -1; i--) {
      const cat = categories[i];
      if (cat) {
        const layers = cat.displayName.split(cat.delimiter);
        if (lastCategory.selectable && !lastCategory.role) {
          if (cat.areStrangers(lastCategory)) {
            ret.unshift(...this._generateParents(lastCategory));
          } else if (cat.isAncestorOf(lastCategory)) {
            const tmp = this._generateParents(lastCategory, layers.length);
            // console.warn(cat, 'is ancestor of ', lastCategory, tmp);
            ret.unshift(...tmp);
          } else if (cat.areRelatives(lastCategory)) {
            let k = 0;
            while (layers[k] === lastLayers[k] && k < layers.length && k < lastLayers.length) {
              k++;
            }
            const tmp = this._generateParents(lastCategory, k);
            // console.warn(cat, 'are relatives', lastCategory, k, tmp);
            ret.unshift(...tmp);
          } else if (cat.areSiblings(lastCategory)) {
            // console.warn(cat, 'are siblings', lastCategory);
          } else if (cat.isParentOf(lastCategory)) {
            // console.warn(cat, 'is parent of', lastCategory);
          } else {
            // console.error('should not happen', lastCategory, cat);
          }
        }
        ret.unshift(cat);
        lastCategory = cat;
        lastLayers = layers;
      }
    }
    if (ret[0] && ret[0].selectable && !ret[0].role) {
      ret.unshift(...this._generateParents(ret[0]));
    }
    return ret;
  }

  _onCategoriesChanged = (categories, accountId = '') => {
    if (!this._categoryResult) {
      this._categoryResult = [];
    }
    const sortByName = (a, b) => {
      return (a.name || '').localeCompare(b.name || '');
    };

    const categoryResults = {};
    for (const cat of categories) {
      categoryResults[cat.accountId] = categoryResults[cat.accountId] || [];
      // don't overwrite bgColor
      const oldCat = this._categoryCache[cat.accountId]
        ? this._categoryCache[cat.accountId][cat.id]
        : null;
      if (oldCat && oldCat.bgColor && oldCat.id === cat.id) {
        cat.bgColor = oldCat.bgColor;
      }
      categoryResults[cat.accountId].push(cat);
      this._onCategoryFinishedSyncing(cat, false);
    }
    const categoryCache = {};
    Object.keys(categoryResults).forEach(accountId => {
      categoryResults[accountId].sort(sortByName);
      const account = AccountStore.accountForId(accountId);
      const isExchange = account && account.provider.includes('exchange');
      if (!isExchange) {
        categoryResults[accountId] = this._createMissingParentPathAfterSortedByName(
          categoryResults[accountId]
        );
      }
      categoryCache[accountId] = {};
      Object.values(categoryResults[accountId]).forEach(cat => {
        categoryCache[accountId][cat.id] = cat;
      });
    });
    if (accountId) {
      this._categoryResult = this._categoryResult.filter(cat => cat.accountId !== accountId);
      const cats = categoryResults[accountId];
      if (Array.isArray(cats) && cats.length > 0) {
        this._categoryResult = this._categoryResult.concat(cats);
      }
    } else {
      this._categoryResult = [];
      Object.keys(categoryResults).forEach(accountId => {
        const cats = categoryResults[accountId];
        if (Array.isArray(cats) && cats.length > 0) {
          this._categoryResult = this._categoryResult.concat(cats);
        }
      });
    }
    if (accountId) {
      this._categoryCache[accountId] = categoryCache[accountId] || {};
    } else {
      this._categoryCache = categoryCache;
    }

    const filteredByAccount = accountId => {
      const cats = categoryResults[accountId];
      if (!Array.isArray(cats) || cats.length === 0) {
        return;
      }
      if (!this._standardCategories) {
        this._standardCategories = {};
      }
      this._standardCategories[accountId] = [];
      if (!this._userCategories) {
        this._userCategories = {};
      }
      this._userCategories[accountId] = [];
      if (!this._hiddenCategories) {
        this._hiddenCategories = {};
      }
      this._hiddenCategories[accountId] = [];
      for (const cat of cats) {
        if (cat && cat.isStandardCategory()) {
          this._standardCategories[accountId].push(cat);
        }
        if (cat && cat.isUserCategory()) {
          this._userCategories[accountId].push(cat);
        }
        if (cat && cat.isHiddenCategory()) {
          this._hiddenCategories[accountId].push(cat);
        }
      }
    };
    if (accountId) {
      filteredByAccount(accountId);
    } else {
      Object.keys(categoryResults).forEach(id => {
        if (id) {
          filteredByAccount(id);
        }
      });
    }

    // Ensure standard categories are always sorted in the correct order
    for (const accountCategories of Object.values(this._standardCategories)) {
      (accountCategories || []).sort(
        (a, b) => Category.StandardRoles.indexOf(a.name) - Category.StandardRoles.indexOf(b.name)
      );
    }
    this.trigger();
  };
}

export default new CategoryStore();
