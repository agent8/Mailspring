import MailspringStore from 'mailspring-store';
import DatabaseStore from './database-store';
import Thread from '../models/thread';
import _ from 'underscore';

const RECENT_READ_KEY = 'recent_read';
const MAX_RECORD = 100;
class ThreadStore extends MailspringStore {
  constructor() {
    super();
    this._recent = JSON.parse(localStorage.getItem(RECENT_READ_KEY) || '[]');
  }
  findBy({ threadId }) {
    return DatabaseStore.findBy(Thread, { id: threadId, state: 0 });
  }
  findAll() {
    return DatabaseStore.findAll(Thread, { state: 0 });
  }
  findAllByThreadIds({ threadIds }) {
    return this.findAll().where([Thread.attributes.id.in(threadIds)]);
  }
  getRecent() {
    if (!this._recent) {
      return [];
    }
    return this._recent.map(item => item.id);
  }
  addRecent(threadId) {
    if (!threadId) {
      return;
    }
    const index = this._recent.findIndex(item => item.id === threadId);
    // delete if exists
    if (index !== -1) {
      this._recent.splice(index, 1);
    }
    this._recent.unshift({
      id: threadId,
      time: new Date().getTime(),
    });
    if (this._recent.length > MAX_RECORD) {
      this._recent = this._recent.slice(0, MAX_RECORD);
    }
    this._saveToStorage();
  }
  _saveToStorage = _.debounce(() => {
    localStorage.setItem(RECENT_READ_KEY, JSON.stringify(this._recent));
  }, 1000);
}

const store = new ThreadStore();
export default store;
