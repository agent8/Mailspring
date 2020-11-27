import crypto from 'crypto';
const localStorage = window.localStorage;
const storageKey = 'categoryMetadata';
class CategoryMetaData {
  constructor() {
    this._loadStorage();
  }
  _loadStorage = () => {
    const storedString = localStorage.getItem(storageKey) || '{ "sift": {} }';
    if (storedString) {
      try {
        this._accounts = JSON.parse(storedString);
      } catch (e) {
        console.error(storedString);
        AppEnv.logError(e);
        this._accounts = { sift: {} };
      }
    }
  };
  _updateStorage = () => {
    localStorage.setItem(storageKey, JSON.stringify(this._accounts));
  };
  restore = () => {
    this._loadStorage();
  };
  saveToStorage = () => {
    this._updateStorage();
  };
  hide = ({ accountId, id, save = false }) => {
    const displayOrder = this.getDisplayOrder({ accountId, id });
    this.update({ accountId, id, displayOrder, hidden: true, save });
  };
  show = ({ accountId, id, save = false }) => {
    const displayOrder = this.getDisplayOrder({ accountId, id });
    this.update({ accountId, id, displayOrder, hidden: false, save });
  };
  setDisplayOrder = ({ accountId, id, displayOrder, save = true }) => {
    const hidden = this.isHidden({ accountId, id });
    this.update({ accountId, id, displayOrder, hidden, save });
  };
  update = ({ accountId, id, displayOrder, hidden, save = true } = {}) => {
    if (!accountId || !id) {
      return;
    }
    if (!this._accounts[accountId]) {
      this._accounts[accountId] = {};
    }
    const hashId = this.hashId(id);
    this._accounts[accountId][hashId] = { displayOrder, hidden };
    if (save) {
      this._updateStorage();
    }
  };
  deleteItem = ({ accountId, id, save = true }) => {
    if (!accountId || !id) {
      return;
    }
    if (!this._accounts[accountId]) {
      return;
    }
    const hashId = this.hashId(id);
    delete this._accounts[accountId][hashId];
    if (save) {
      this._updateStorage();
    }
  };
  isHidden = ({ accountId, id } = {}) => {
    return this._getValue(accountId, id, 'hidden');
  };
  getDisplayOrder = ({ accountId, id } = {}) => {
    return this._getValue(accountId, id, 'displayOrder') === null ||
      this._getValue(accountId, id, 'displayOrder') === undefined
      ? -1
      : this._getValue(accountId, id, 'displayOrder');
  };
  updateItemsByAccountId = ({ accountId, items, save = true }) => {
    if (!accountId) {
      return null;
    }
    this._accounts[accountId] = items;
    if (save) {
      this._updateStorage();
    }
  };
  getItemsByAccountId = accountId => {
    if (!accountId) {
      return null;
    }
    return Object.assign({}, this._accounts[accountId]);
  };
  getItem = (accountId, id) => {
    const hashId = this.hashId(id);
    if (this._accounts[accountId]) {
      return this._accounts[accountId][hashId];
    }
    return null;
  };
  _getValue = (accountId, id, valueType) => {
    if (!this._accounts[accountId]) {
      return null;
    }
    const hashId = this.hashId(id);
    if (!this._accounts[accountId][hashId]) {
      return null;
    }
    return this._accounts[accountId][hashId][valueType];
  };
  hashId(id) {
    if (typeof id !== 'string' || id.length === 0) {
      return id;
    }
    return crypto
      .createHash('md5')
      .update(id)
      .digest('hex');
  }
}

export default new CategoryMetaData();
