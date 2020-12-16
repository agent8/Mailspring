import _ from 'underscore';
import MailspringStore from 'mailspring-store';
import DatabaseStore from './database-store';
import AccountStore from './account-store';
import Account from '../models/account';
import Category from '../models/category';
import CategoryMetaData from '../models/category-metadata';
import Actions from '../actions';
import FolderState from '../models/folder-state';
import Folder from '../models/folder';
import crypto from 'crypto';
import utf7 from 'utf7';
import SyncbackCategoryTask from '../tasks/syncback-category-task';
import DestroyCategoryTask from '../tasks/destroy-category-task';
import Task from '../tasks/task';
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
      .then(results => {
        AppEnv.logDebug(`Folders: ${JSON.stringify(results)}`);
        this._onCategoriesChanged(results);
      });
    Actions.queueTasks.listen(this._processCategoryChangeTasks, this);
    Actions.queueTask.listen(this._processCategoryChangeTasks, this);
    Actions.syncFolders.listen(this._onSyncCategory, this);
    Actions.cancelCategoryMeteDataChange.listen(this.cancelCategoryMetaDataChange, this);
    Actions.saveCategoryMetaDataChange.listen(this.saveCategoryMetaDataChange, this);
    this.listenTo(DatabaseStore, this._onFolderStateChange);
  }
  // decodePath(pathString) {
  //   return Category.pathToDisplayName(pathString);
  // }
  byFolderId(categoryId) {
    if (!categoryId) {
      return null;
    }
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
  _categoriesRelationSanityCheckPass(catA, catB) {
    if (!(catA instanceof Category) || !(catB instanceof Category)) {
      AppEnv.logError(`Either catA or catB is not instance of Category`);
      return false;
    }
    if (catA.accountId !== catB.accountId) {
      AppEnv.logDebug(`catA ${catA.accountId} is not catB ${catB.accountId} account id`);
      return false;
    }
    const account = AccountStore.accountForId(catA.accountId);
    if (!account) {
      AppEnv.reportError(new Error(`catA ${catA.accountId} dose not exist in AccountStore`), {
        errorData: { account: AccountStore.accountIds(), accountId: catA.accountId },
      });
      return false;
    }
    return true;
  }
  isCategoryAParentOfB(catA, catB) {
    if (!this._categoriesRelationSanityCheckPass(catA, catB)) {
      return false;
    }
    if (catA.id === catB.id) {
      return false;
    }
    const isExchange = AccountStore.isExchangeAccountId(catA.accountId);
    if (!isExchange) {
      return catA.isParentOf(catB);
    } else {
      return catA.path === catB.parentId;
    }
  }
  getCategoryParent = category => {
    const account = AccountStore.accountForId(category.accountId);
    if (account && category) {
      const isExchange = AccountStore.isExchangeAccount(account);
      let parent = null;
      if (isExchange) {
        const inboxCategory = this.getInboxCategory(account.id);
        if (inboxCategory && category.parentId === inboxCategory.parentId) {
          return null;
        }
        parent = this.getCategoryByPath(category.parentId, account.id);
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
  replaceCategoryMetaDataId = ({ accountId, oldId, newId, save = true } = {}) => {
    const oldItem = CategoryMetaData.getItem(accountId, oldId);
    if (oldItem) {
      CategoryMetaData.deleteItem({ accountId, id: oldId, save: false });
      CategoryMetaData.update({
        accountId,
        id: newId,
        displayOrder: oldItem.displayOrder,
        hidden: oldItem.hidden,
        save,
      });
    }
  };
  removeCategoryMetaData = ({ accountId, id, save } = {}) => {
    CategoryMetaData.deleteItem({ accountId, id, save });
  };
  isCategoryHiddenInFolderTree = ({ accountId, categoryId } = {}) => {
    return CategoryMetaData.isHidden({ accountId, id: categoryId });
  };
  hideCategoryById = ({ accountId, categoryId, save = true } = {}) => {
    let category;
    if (accountId && categoryId) {
      this.hideCategoryInFolderTree({ accountId, id: categoryId }, save);
    } else if (categoryId) {
      category = this.byFolderId(categoryId);
      if (category) {
        this.hideCategoryInFolderTree({ accountId: category.accountId, id: categoryId }, save);
      }
    }
  };
  hideCategoryInFolderTree = ({ accountId, id } = {}, save = true) => {
    if (accountId && id) {
      console.warn(`saving ${accountId} ${id} ${save} `);
      if (!CategoryMetaData.isHidden({ accountId, id })) {
        console.warn(`saved ${accountId} ${id} ${save} `);
        CategoryMetaData.hide({ accountId, id, save });
        this.trigger();
      }
    }
  };
  showCategoryById = ({ accountId, categoryId, save = true } = {}) => {
    let category;
    if (accountId && categoryId) {
      this.showCategoryInFolderTree({ accountId, id: categoryId }, save);
    } else if (categoryId) {
      category = this.byFolderId(categoryId);
      if (category) {
        this.showCategoryInFolderTree({ accountId: category.accountId, id: categoryId }, save);
      }
    }
  };
  showCategoryInFolderTree = ({ accountId, id } = {}, save = true) => {
    if (accountId && id) {
      if (CategoryMetaData.isHidden({ accountId, id })) {
        CategoryMetaData.show({ accountId, id, save });
        this.trigger();
      }
    }
  };

  getCategoryDisplayOrderInFolderTree = ({ accountId, id } = {}) => {
    if (accountId && id) {
      return CategoryMetaData.getDisplayOrder({ accountId, id });
    }
    return -1;
  };
  recordCategoryDisplayOrderChange = (
    droppingFolderData = { accountId: '', id: '', categories: [], displayOrder: -1 },
    targetFolderData = { accountId: '', id: '', categories: [], displayOrder: -1 }
  ) => {
    this._categoryMetaDataChangeRecord = {
      droppingFolderData,
      targetFolderData,
      type: 'displayOrder',
    };
    console.warn('dropping', droppingFolderData, 'target', targetFolderData);
  };
  getCategoryDisplayOrderChangeRecord = () => {
    return this._categoryMetaDataChangeRecord;
  };
  clearCategoryDisplayOrderChangeRecord = (trigger = true) => {
    if (this._categoryMetaDataChangeRecord) {
      console.warn('clear change record');
      this._categoryMetaDataChangeRecord = null;
      if (trigger) {
        this.trigger();
      }
    }
  };
  setCategoryDisplayOrderInFolderTree = ({
    accountId,
    id,
    displayOrder,
    save = true,
    trigger = true,
  } = {}) => {
    if (accountId && id) {
      CategoryMetaData.setDisplayOrder({ accountId, id, displayOrder, save });
      if (trigger) {
        this.trigger();
      }
    }
  };
  saveCategoryMetaDataChange = (trigger = true) => {
    CategoryMetaData.saveToStorage();
    this.clearCategoryDisplayOrderChangeRecord(trigger);
    if (trigger) {
      this.trigger();
    }
  };
  cancelCategoryMetaDataChange = (trigger = true) => {
    CategoryMetaData.restore();
    this.clearCategoryDisplayOrderChangeRecord(trigger);
    if (trigger) {
      this.trigger();
    }
  };
  clearOldCategoryMetaData = ({ accountId, newCategories }) => {
    const currentMetaDataItems = CategoryMetaData.getItemsByAccountId(accountId);
    if (!currentMetaDataItems) {
      return;
    }
    const newItems = {};
    if (Array.isArray(newCategories) && newCategories.length > 0) {
      newCategories.forEach(cat => {
        if (cat.accountId !== accountId) {
          return;
        }
        const hashId = CategoryMetaData.hashId(cat.path);
        const item = currentMetaDataItems[hashId];
        if (item) {
          newItems[hashId] = item;
        }
      });
      CategoryMetaData.updateItemsByAccountId({ accountId, items: newItems, save: true });
    }
  };
  _processCategoryChangeTasks = tasks => {
    if (!Array.isArray(tasks)) {
      tasks = [tasks];
    }
    let changed = false;
    tasks.forEach(task => {
      if (!task) {
        return;
      }
      const accountId = task.accountId;
      const isExchange = AccountStore.isExchangeAccountId(accountId);
      if (task instanceof SyncbackCategoryTask && !isExchange) {
        if (task.error || task.status === Task.Status.Cancelled) {
          this.replaceCategoryMetaDataId({
            accountId,
            newId: task.existingPath,
            oldId: task.path,
            save: true,
          });
          changed = true;
        } else if (task.status === Task.Status.Local) {
          this.replaceCategoryMetaDataId({
            accountId,
            oldId: task.existingPath,
            newId: task.path,
            save: true,
          });
        }
      } else if (task instanceof DestroyCategoryTask && task.status === Task.Status.Local) {
        this.removeCategoryMetaData({ accountId, id: task.path, save: true });
        changed = true;
      }
    });
    if (changed) {
      this.trigger();
    }
  };
  _onFolderStateChange = ({ objectClass, objects, processAccountId }) => {
    if (objectClass === Folder.name) {
      return this._onCategoriesChanged(objects, processAccountId);
    }
    if (objectClass === 'Task') {
      return this._processCategoryChangeTasks(objects);
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
  _generateParents(
    category,
    stopAtAncestor = 0,
    { checkForDuplicates = false, currentResults = [] } = {}
  ) {
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
          name: utf7.imap.decode(path),
          type: category.type,
          selectable: false,
          delimiter: category.delimiter,
          state: 0,
          role: '',
        });
        if (newFolder.pathWithPrefixStripped().length > 0) {
          if (checkForDuplicates) {
            const exists = currentResults.find(cat => cat && cat.path === newFolder.path);
            if (!exists) {
              ret.unshift(newFolder);
            }
          } else {
            ret.unshift(newFolder);
          }
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
            let tmp;
            if (lastCategory.startWithPrefix()) {
              tmp = this._generateParents(lastCategory, layers.length + 1);
            } else {
              tmp = this._generateParents(lastCategory, layers.length);
            }
            // console.warn(cat, 'is ancestor of ', lastCategory, tmp);
            ret.unshift(...tmp);
          } else if (cat.areSiblings(lastCategory)) {
            // console.warn(cat, 'are siblings', lastCategory);
          } else if (cat.isParentOf(lastCategory)) {
            // console.warn(cat, 'is parent of', lastCategory);
          } else if (cat.areRelatives(lastCategory)) {
            let k = 0;
            while (layers[k] === lastLayers[k] && k < layers.length && k < lastLayers.length) {
              k++;
            }
            if (lastCategory.startWithPrefix()) {
              k++;
            }
            const tmp = this._generateParents(lastCategory, k);
            // console.warn(cat, 'are relatives', lastCategory, k, tmp);
            ret.unshift(...tmp);
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
      const isExchange = AccountStore.isExchangeAccountId(accountId);
      if (!isExchange) {
        categoryResults[accountId] = this._createMissingParentPathAfterSortedByName(
          categoryResults[accountId]
        );
      }
      categoryCache[accountId] = {};
      const account = AccountStore.accountForId(accountId);
      const isGmail = account && account.provider === 'gmail';
      let isNewAccount = false;
      if (Array.isArray(categoryResults[accountId])) {
        if (isGmail) {
          isNewAccount = !!categoryResults[accountId].find(
            cat => cat && cat.role === 'all' && cat.isNew
          );
        } else {
          isNewAccount = !!categoryResults[accountId].find(
            cat => cat && cat.role === 'inbox' && cat.isNew
          );
        }
      }
      Object.values(categoryResults[accountId]).forEach((cat, index) => {
        categoryCache[accountId][cat.id] = cat;
        if (cat.isNew && isNewAccount) {
          cat.isNew = false;
        }
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
      const userCats = [];
      const newUserCats = [];
      for (const cat of cats) {
        if (cat && cat.isStandardCategory()) {
          this._standardCategories[accountId].push(cat);
        }
        if (cat && cat.isUserCategory()) {
          if (cat.isNew) {
            cat.isNew = false;
            newUserCats.push(cat);
          } else {
            userCats.push(cat);
          }
        }
        if (cat && cat.isHiddenCategory()) {
          this._hiddenCategories[accountId].push(cat);
        }
      }
      this._userCategories[accountId] = [...userCats, ...newUserCats];
      this.clearOldCategoryMetaData({ accountId, newCategories: this._userCategories[accountId] });
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
