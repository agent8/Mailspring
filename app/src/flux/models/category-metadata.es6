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
    this._accounts[accountId][id] = { displayOrder, hidden };
    if (save) {
      this._updateStorage();
    }
  };
  isHidden = ({ accountId, id } = {}) => {
    return this._getValue(accountId, id, 'hidden');
  };
  getDisplayOrder = ({ accountId, id } = {}) => {
    return this._getValue(accountId, id, 'displayOrder') || 0;
  };
  getItem = (accountId, id) => {
    if (this._accounts[accountId]) {
      return this._accounts[accountId][id];
    }
    return null;
  };
  _getValue = (accountId, id, valueType) => {
    if (!this._accounts[accountId]) {
      return null;
    }
    if (!this._accounts[accountId][id]) {
      return null;
    }
    return this._accounts[accountId][id][valueType];
  };
}

export default new CategoryMetaData();
