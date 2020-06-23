import MailspringStore from 'mailspring-store';
import Actions from '../actions';
import DestroyDraftTask from '../tasks/destroy-draft-task';
import RestoreDraftTask from '../tasks/restore-draft-task';
import SendDraftTask from '../tasks/send-draft-task';
import SyncbackDraftTask from '../tasks/syncback-draft-task';
import Message from '../models/message';
import Thread from '../models/thread';
import DatabaseStore from './database-store';

const state = {
  normal: 0,
  deleted: 1,
};
class DraftCacheStore extends MailspringStore {
  constructor() {
    super();
    this.cache = {};
    this.listenTo(Actions.queueTasks, this._taskQueue);
    this.listenTo(Actions.queueTask, task => this._taskQueue([task]));
    this.listenTo(Actions.requestDraftCacheFromMain, this._onRequestForDraftCache);
    this.listenTo(Actions.broadcastDraftCache, this._onBroadcastDraftCacheReceived);
    this.listenTo(DatabaseStore, this._onDBDataChange);
  }
  _onDBDataChange = change => {
    if (change.objectClass === Message.name) {
      const messages = [];
      change.objects.forEach(msg => {
        if (msg && msg.draft && !msg.calendarReply && !msg.ignoreSift) {
          if (change.type === 'persist') {
            const cache = this.findDraft(msg);
            if (cache) {
              messages.push(msg);
              this.updateDraftCache(msg, false);
            }
          } else {
            messages.push(msg);
            this.removeDraftFromCache(msg, false);
          }
        }
      });
      if (messages.length > 0) {
        this.trigger({ drafts: messages, type: change.type });
      }
    } else if (change.objectClass === Thread.name && change.type === 'unpersist') {
      change.objects.forEach(thread => {
        if (thread && thread.id) {
          this.removeDraftCacheByThreadId(thread.id, false);
        }
      });
      //We don't need to specify what changed because at this stage, the thread window should have/going to closed
      this.trigger();
    }
  };
  _onBroadcastDraftCacheReceived = ({ messages, threadId, type }) => {
    if (!AppEnv.isThreadWindow()) {
      AppEnv.logDebug(`Not thread window, ignoring`);
      return;
    }
    if (!threadId) {
      AppEnv.logWarning(`ThreadId is null, ignoring update`);
      return;
    }
    if (!this.cache[threadId]) {
      this.cache[threadId] = { state: state.normal, messages: {} };
    }
    if (!Array.isArray(messages)) {
      AppEnv.logWarning(`ThreadId ${threadId} messages is not array, ignoring`);
      return;
    }
    if (messages.length === 0 && type === 'unpersist') {
      this.removeDraftCacheByThreadId(threadId);
      return;
    }
    messages.forEach(msg => {
      if (msg) {
        if (type === 'persist') {
          this.updateDraftCache(msg, false);
        } else {
          this.removeDraftFromCache(msg, false);
        }
      }
    });
    this.trigger({ drafts: messages, type });
  };
  _onRequestForDraftCache = ({ threadId } = {}) => {
    if (!AppEnv.isMainWindow()) {
      AppEnv.logDebug(`Not Main window, ignoring request`);
      return;
    }
    if (!threadId) {
      AppEnv.logWarning(`ThreadId is null, request invalid`);
      return;
    }
    const messages = this.findDraftsByThreadId(threadId);
    if (messages.length > 0) {
      AppEnv.logDebug(`ThreadId ${threadId} found, broadcasting draft cache data`);
      Actions.broadcastDraftCache({ messages, threadId, type: 'persist' });
    }
  };
  getDraftsFromMain = () => {
    if (!AppEnv.isThreadWindow()) {
      AppEnv.logDebug(`Is not thread window, igonring`);
      return;
    }
    const props = AppEnv.getWindowProps();
    console.log(props);
    if (props && props.threadId) {
      Actions.requestDraftCacheFromMain({ threadId: props.threadId });
    }
  };
  findDraft(draft = { id: '', threadId: '' }) {
    if (!draft) {
      AppEnv.logWarning(`draft null, cannot find drafts in draft cache`);
      return null;
    }
    const threadId = draft.threadId;
    const messageId = draft.id;
    if (!threadId || !messageId) {
      AppEnv.logWarning(
        `ThreadId ${threadId} or MessageId ${messageId} is null, cannot find drafts in draft cache`
      );
      return null;
    }
    if (this.cache[threadId]) {
      return this.cache[threadId].messages[messageId];
    }
    AppEnv.logDebug(`ThreadId ${threadId}, messageId ${messageId} cannot be found in draft cache`);
    return null;
  }
  findDraftsByThreadId(threadId) {
    if (!threadId) {
      AppEnv.logWarning(`ThreadId is null, cannot find drafts in draft cache`);
      return [];
    }
    if (this.cache[threadId]) {
      return Object.values(this.cache[threadId].messages);
    }
    AppEnv.logDebug(`ThreadId ${threadId} cannot be found in draft cache`);
    return [];
  }
  findDraftsByAccountIds(accountIds = []) {
    return [];
  }
  findDraftById(messageId) {
    if (!messageId) {
      AppEnv.logWarning(`MessageId is null, cannot find draft in draft cache`);
      return null;
    }
    const threadIds = Object.keys(this.cache);
    for (let i = 0; i < threadIds.length; i++) {
      const threadId = threadIds[i];
      const messages = Object.values(this.cache[threadId].messages);
      for (let k = 0; k < messages.length; k++) {
        const draft = messages[k];
        if (draft && draft.id === messageId) {
          return draft;
        }
      }
    }
    return null;
  }
  updateDraftCache = (draft = {}, trigger = true) => {
    const threadId = draft.threadId;
    const messageId = draft.id;
    if (!this.cache[threadId]) {
      AppEnv.logWarning(`Draft ${messageId} with thread ${threadId} updated to cache`);
      this.cache[threadId] = { state: state.normal, messages: {} };
    }
    if (this.cache[threadId].messages[messageId]) {
      AppEnv.logDebug(`Draft ${messageId} updated to cache`);
    } else {
      AppEnv.logWarning(`Draft ${messageId} not in cache`);
    }
    this.cache[threadId].messages[messageId] = draft;
    if (trigger) {
      this.trigger({ drafts: [draft], type: 'persist' });
    }
    if (AppEnv.isMainWindow()) {
      Actions.broadcastDraftCache({ messages: [draft], threadId: draft.threadId, type: 'persist' });
    }
    return draft;
  };
  removeDraftCacheByThreadId = (threadId, trigger = true) => {
    if (!threadId) {
      AppEnv.logWarning(`ThreadId is empty, removing draft cache by threadId ignored`);
      return;
    }
    delete this.cache[threadId];
    AppEnv.logDebug(`ThreadId ${threadId} removed from draft cache`);
    if (trigger) {
      this.trigger();
    }
    if (AppEnv.isMainWindow()) {
      Actions.broadcastDraftCache({ messages: [], threadId, type: 'unpersist' });
    }
  };
  removeDraftCacheByMessageId = (messageId, trigger = true) => {
    if (!messageId) {
      AppEnv.logWarning(`MessageId not available, cannot remove cache from draft cache`);
      return;
    }
    const threadIds = Object.keys(this.cache);
    for (let i = 0; i < threadIds.length; i++) {
      const threadId = threadIds[i];
      const messages = Object.values(this.cache[threadId].messages);
      for (let k = 0; k < messages.length; k++) {
        const draft = messages[k];
        if (draft && draft.id === messageId) {
          AppEnv.logWarning(`MessageId ${messageId} found, removed cache from draft cache`);
          const draft = this.cache[threadId].messages[messageId];
          delete this.cache[threadId].messages[messageId];
          this._ifThreadCacheEmptyRemove(threadId, false);
          if (trigger) {
            this.trigger({ drafts: [draft], type: 'unpersist' });
          }
          if (AppEnv.isMainWindow()) {
            Actions.broadcastDraftCache({
              messages: [draft],
              threadId: draft.threadId,
              type: 'unpersist',
            });
          }
          return draft;
        }
      }
    }
    AppEnv.logWarning(`MessageId ${messageId} not found, nothing removed cache from draft cache`);
  };
  clearDraftFromCache = draft => {
    if (!draft) {
      AppEnv.logWarning(`Draft is null, ignoring cache clearing`);
      return;
    }
    const threadId = draft.threadId;
    const messageId = draft.id;
    if (!threadId || !messageId) {
      AppEnv.logWarning(
        `ThreadId ${threadId} or MessageId ${messageId} is null, cannot clear draft from draft cache`
      );
      return;
    }
    if (this.cache[threadId] && this.cache[threadId].messages[messageId]) {
      AppEnv.logWarning(
        `ThreadId ${threadId} MessageId ${messageId} found, clear cache from draft cache`
      );
      delete this.cache[threadId].messages[messageId];
      this._ifThreadCacheEmptyRemove(threadId, false);
    }
  };
  removeDraftFromCache = (draft, trigger = true) => {
    if (!draft) {
      AppEnv.logWarning(`Draft is null, ignoring cache remove`);
      return;
    }
    const threadId = draft.threadId;
    const messageId = draft.id;
    if (!threadId || !messageId) {
      AppEnv.logWarning(
        `ThreadId ${threadId} or MessageId ${messageId} is null, cannot remove draft from draft cache`
      );
      return;
    }
    if (this.cache[threadId] && this.cache[threadId].messages[messageId]) {
      AppEnv.logWarning(
        `ThreadId ${threadId} MessageId ${messageId} found, removed cache from draft cache`
      );
      const removed = this.cache[threadId].messages[messageId];
      delete this.cache[threadId].messages[messageId];
      this._ifThreadCacheEmptyRemove(threadId, false);
      if (trigger) {
        this.trigger({ drafts: [removed], type: 'unpersist' });
      }
      if (AppEnv.isMainWindow()) {
        Actions.broadcastDraftCache({
          messages: [removed],
          threadId: removed.threadId,
          type: 'unpersist',
        });
      }
      return removed;
    }
    AppEnv.logWarning(
      `ThreadId ${threadId} MessageId ${messageId} not found, nothing removed cache from draft cache`
    );
  };
  _ifThreadCacheEmptyRemove = (threadId, trigger = true) => {
    if (!threadId) {
      AppEnv.logWarning(`ThreadId null, ignoring thread cache check`);
      return;
    }
    if (!this.cache[threadId]) {
      AppEnv.logWarning(`ThreadId ${threadId} not in cache, ignoring thread cache check`);
      return;
    }
    if (Object.keys(this.cache[threadId].messages).length === 0) {
      AppEnv.logWarning(
        `ThreadId ${threadId} cache have no more messages, removing, trigger ${trigger}`
      );
      delete this.cache[threadId];
      if (trigger) {
        this.trigger();
      }
    } else {
      AppEnv.logWarning(`ThreadId ${threadId} cache have messages, ignoring`);
    }
  };
  _taskQueue = tasks => {
    const persists = [];
    const unpersists = [];
    tasks.forEach(task => {
      if (task instanceof DestroyDraftTask) {
        const messageIds = task.messageIds;
        messageIds.forEach(id => {
          AppEnv.logDebug(`Removing ${id} from cache because DestroyDraftTask`);
          const removed = this.removeDraftCacheByMessageId(id, false);
          if (removed) {
            AppEnv.logDebug(`Removed ${id} from cache DestroyDraftTask`);
            unpersists.push(removed);
          }
        });
      } else if (task instanceof RestoreDraftTask) {
        const id = task.deleteMessageId;
        AppEnv.logDebug(`Removing ${id} from cache because RestoreDraftTask`);
        const removed = this.removeDraftCacheByMessageId(id, false);
        if (removed) {
          AppEnv.logDebug(`Removed ${id} from cache RestoreDraftTask`);
          unpersists.push(removed);
        }
      } else if (task instanceof SyncbackDraftTask || task instanceof SendDraftTask) {
        const draft = task.draft;
        AppEnv.logDebug(`Updating ${draft.id} in cache`);
        const updated = this.updateDraftCache(draft, false);
        if (updated) {
          AppEnv.logDebug(`Updated ${draft.id} in cache`);
          persists.push(updated);
        }
      }
    });
    if (persists.length > 0) {
      AppEnv.logDebug(`Triggering cache store, persist`);
      this.trigger({ drafts: persists, type: 'persist' });
    }
    if (unpersists.length > 0) {
      AppEnv.logDebug(`Triggering cache store, unpersist`);
      this.trigger({ drafts: unpersists, type: 'unpersist' });
    }
  };
}

export default new DraftCacheStore();
