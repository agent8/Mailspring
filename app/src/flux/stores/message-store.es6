import MailspringStore from 'mailspring-store';
import Actions from '../actions';
import Message from '../models/message';
import Thread from '../models/thread';
import Matcher from '../attributes/matcher';
import Category from '../models/category';
import DatabaseStore from './database-store';
import DraftCacheStore from './draft-cache-store';
import ThreadStore from './thread-store';
import AttachmentStore from './attachment-store';
import WorkspaceStore from './workspace-store';
import TaskFactory from '../tasks/task-factory';
import FocusedPerspectiveStore from './focused-perspective-store';
import FocusedContentStore from './focused-content-store';
import * as ExtensionRegistry from '../../registries/extension-registry';
import { ipcRenderer } from 'electron';
import fs from 'fs';

const FolderNamesHiddenByDefault = ['spam', 'trash'];
const AutoDownloadSizeThreshHold = 2 * 1024 * 1024;
class MessageStore extends MailspringStore {
  constructor() {
    super();
    this._setStoreDefaults();
    this._registerListeners();
  }

  findAll() {
    return DatabaseStore.findAll(Message)
      .where({ deleted: false })
      .where([
        Message.attributes.syncState.in([
          Message.messageSyncState.normal,
          Message.messageSyncState.saving,
          Message.messageSyncState.sending,
          Message.messageSyncState.updatingHasUID,
          Message.messageSyncState.updatingNoUID,
          Message.messageSyncState.failing,
          Message.messageSyncState.failed,
        ]),
      ]);
  }

  findAllInDescendingOrder() {
    return this.findAll().order(Message.attributes.date.descending());
  }

  findAllWithBodyInDescendingOrder() {
    return this.findAllInDescendingOrder().linkDB(Message.attributes.body);
  }

  findAllByThreadId({ threadId }) {
    return this.findAll().where({ threadId: threadId });
  }

  findAllByThreadIdWithBody({ threadId }) {
    return this.findAllByThreadId({ threadId }).linkDB(Message.attributes.body);
  }

  findAllByThreadIdWithBodyInDescendingOrder({ threadId }) {
    return this.findAllByThreadIdWithBody({ threadId }).order(Message.attributes.date.descending());
  }

  findByThreadId({ threadId }) {
    return DatabaseStore.findBy(Message, { threadId, deleted: false }).where([
      Message.attributes.syncState.in([
        Message.messageSyncState.normal,
        Message.messageSyncState.saving,
        Message.messageSyncState.sending,
        Message.messageSyncState.updatingHasUID,
        Message.messageSyncState.updatingNoUID,
        Message.messageSyncState.failing,
        Message.messageSyncState.failed,
      ]),
    ]);
  }

  findByThreadIdAndAccountId({ threadId, accountId }) {
    return this.findByThreadId({ threadId }).where({ accountId: accountId });
  }

  findByThreadIdAndAccountIdInDesecndingOrder({ threadId, accountId }) {
    return this.findByThreadIdAndAccountId({ threadId, accountId }).order(
      Message.attributes.date.descending()
    );
  }

  findByThreadIdInDescendingOrder({ threadId }) {
    return this.findByThreadId({ threadId }).order(Message.attributes.date.descending());
  }

  findByMessageId({ messageId }) {
    return DatabaseStore.find(Message, messageId).where([
      Message.attributes.syncState.in([
        Message.messageSyncState.normal,
        Message.messageSyncState.saving,
        Message.messageSyncState.sending,
        Message.messageSyncState.updatingHasUID,
        Message.messageSyncState.updatingNoUID,
        Message.messageSyncState.failing,
        Message.messageSyncState.failed,
      ]),
    ]);
  }

  findByMessageIdWithBody({ messageId }) {
    return this.findByMessageId({ messageId }).linkDB(Message.attributes.body);
  }

  //########## PUBLIC #####################################################

  items() {
    if (this._showingHiddenItems) return this._items;
    const currentPerspective = FocusedPerspectiveStore.current();
    const viewing = currentPerspective.categoriesSharedRole();
    const viewingHiddenCategory = FolderNamesHiddenByDefault.includes(viewing);
    const enableFocusedInbox = AppEnv.config.get('core.workspace.enableFocusedInbox');

    return this._items.filter(item => {
      const inHidden =
        item.labels.some(label => FolderNamesHiddenByDefault.includes(label.role)) ||
        item.isHidden();
      if (viewing === 'inbox' && enableFocusedInbox && !currentPerspective.isOther) {
        // inbox primary or other
        const inboxHiddenCategorys = Category.inboxOtherCategorys(true);
        const isInHiddenCategory = inboxHiddenCategorys.includes(item.inboxCategory);
        return !inHidden && !isInHiddenCategory;
      }
      return viewingHiddenCategory ? inHidden || item.draft : !inHidden;
    });
  }

  getAllItems() {
    return this._items;
  }

  threadId() {
    return this._thread ? this._thread.id : undefined;
  }

  thread() {
    return this._thread;
  }

  lastThreadChangeTimestamp() {
    return this._lastThreadChangeTimestamp;
  }

  itemsExpandedState() {
    // ensure that we're always serving up immutable objects.
    // this.state == nextState is always true if we modify objects in place.
    return Object.assign({}, this._itemsExpanded);
  }

  hasCollapsedItems() {
    return Object.keys(this._itemsExpanded).length < this._items.length;
  }

  numberOfHiddenItems() {
    return this._items.length - this.items().length;
  }

  itemIds() {
    return this._items.map(i => i.id);
  }

  itemsLoading() {
    return this._itemsLoading;
  }

  isPopedOut = () => {
    // We only care for popout in main window
    return AppEnv.isMainWindow() && this._popedOut;
  };

  /*
  Message Store Extensions
  */

  // Public: Returns the extensions registered with the MessageStore.
  extensions() {
    return ExtensionRegistry.MessageView.extensions();
  }

  _onExtensionsChanged(role) {
    const MessageBodyProcessor = require('./message-body-processor').default;
    MessageBodyProcessor.resetCache();
  }

  //########## PRIVATE ####################################################

  _setStoreDefaults() {
    if (AppEnv.isThreadWindow()) {
      // ipcRenderer.removeListener('close-window', this._onPopoutClosed);
      ipcRenderer.removeListener('thread-arp', this._onReceivedThreadARP);
      AppEnv.removeUnloadCallback(this._onWindowClose);
      // ipcRenderer.on('close-window', this._onPopoutClosed);
      ipcRenderer.on('thread-arp', this._onReceivedThreadARP);
      AppEnv.onBeforeUnload(this._onWindowClose);
      // console.log('set listeners in thread window');
    }
    // console.log('set store default');
    this._items = [];
    this._itemsExpanded = {};
    this._itemsLoading = false;
    this._showingHiddenItems = false;
    this._thread = null;
    this._popedOut = false;
    this._lastThreadChangeTimestamp = 0;
    this._missingAttachmentIds = [];
    this._attachmentRequestsCache = [];
  }

  _registerListeners() {
    // console.log('register listerners');
    AppEnv.onBeforeUnload(this._onWindowClose);
    if (AppEnv.isMainWindow()) {
      this._currentWindowLevel = 1;
      ipcRenderer.on('thread-close-window', this._onPopoutClosed);
      ipcRenderer.on('thread-arp-reply', this._onThreadARPReply);
      ipcRenderer.on('popout-thread', (e, thread) => this._onPopoutThread(thread));
    } else if (AppEnv.isThreadWindow()) {
      this._currentWindowLevel = 2;
      ipcRenderer.on('thread-arp', this._onReceivedThreadARP);
    } else if (AppEnv.isComposerWindow()) {
      this._currentWindowLevel = 3;
    }
    this.listenTo(ExtensionRegistry.MessageView, this._onExtensionsChanged);
    this.listenTo(DatabaseStore, this._onDataChanged);
    this.listenTo(DraftCacheStore, this._onDraftCacheChange);
    this.listenTo(FocusedContentStore, this._onFocusChanged);
    this.listenTo(FocusedPerspectiveStore, this._onPerspectiveChanged);
    this.listenTo(Actions.toggleMessageIdExpanded, this._onToggleMessageIdExpanded);
    this.listenTo(Actions.toggleAllMessagesExpanded, this._onToggleAllMessagesExpanded);
    this.listenTo(Actions.toggleHiddenMessages, this._onToggleHiddenMessages);
    this.listenTo(Actions.popoutThread, this._onPopoutThread);
    this.listenTo(Actions.setCurrentWindowTitle, this.setWindowTitle);
    this.listenTo(AttachmentStore, this._onAttachmentCacheChange);
    // this.listenTo(Actions.focusThreadMainWindow, this._onFocusThreadMainWindow);
    this.listenTo(Actions.pushToFetchAttachmentsQueue, this._onRequestAttachmentQueue);
  }
  _onRequestAttachmentQueue = (
    data = { accountId: '', missingItems: [], needProgress: false, source: '' }
  ) => {
    if (!data) {
      console.log('MessageStore:_onRequestAttachmentQueue: data is null');
      return;
    }
    if ((data.source || '').toLocaleLowerCase() === 'click') {
      console.log('MessageStore:_onRequestAttachmentQueue:source is click, ignoring cache');
      Actions.fetchAttachments(data);
      return;
    }
    if (!Array.isArray(data.missingItems)) {
      console.log('MessageStore:_onRequestAttachmentQueue:missingItems is not array');
      return;
    }
    const filteredIds = [];
    const oldAttachmentRequestCache = this._attachmentRequestsCache.slice();
    data.missingItems.forEach(id => {
      if (!oldAttachmentRequestCache.includes(id)) {
        filteredIds.push(id);
        this._attachmentRequestsCache.push(id);
      }
    });
    if (filteredIds.length > 0) {
      Actions.fetchAttachments(Object.assign({}, data, { missingItems: filteredIds }));
    }
  };

  _onThreadARPReply = (event, options) => {
    // console.log('received arp reply', options);
    if (
      options.threadId &&
      options.windowLevel &&
      options.windowLevel > this._getCurrentWindowLevel() &&
      this._thread &&
      options.threadId === this._thread.id
    ) {
      this._setPopout(true);
    }
  };
  _onReceivedThreadARP = (event, options) => {
    // console.log('received arp request', options);
    if (
      options.threadId &&
      this._thread &&
      options.windowLevel &&
      options.windowLevel < this._getCurrentWindowLevel() &&
      options.threadId === this._thread.id
    ) {
      options.windowLevel = this._getCurrentWindowLevel();
      ipcRenderer.send('arp-reply', options);
    }
  };
  _getCurrentWindowLevel = () => {
    if (AppEnv.isMainWindow()) {
      return 1;
    } else if (AppEnv.isThreadWindow()) {
      return 2;
    } else if (AppEnv.isComposerWindow()) {
      return 3;
    }
  };
  _onWindowClose = () => {
    // console.log(`on thread window close, thread id: ${this._thread ? this._thread.id : 'null'}, windowLevel: ${this._getCurrentWindowLevel()}`);
    if (this._thread) {
      ipcRenderer.send('close-window', {
        threadId: this._thread.id,
        accountId: this._thread.accountId,
        additionalChannelParam: 'thread',
        windowLevel: this._getCurrentWindowLevel(),
      });
      ipcRenderer.send('close-window', {
        threadId: this._thread.id,
        additionalChannelParam: 'draft',
        windowLevel: this._getCurrentWindowLevel(),
      });
    }
    return true;
  };

  _onPopoutClosed = (event, options) => {
    // console.log(`window ${this._getCurrentWindowLevel()} message store popout closed with thread id ${options.threadId}, from windowLevel: ${options.windowLevel}`);
    if (options.windowLevel && options.windowLevel > this._getCurrentWindowLevel()) {
      if (options.threadId && this._thread && options.threadId === this._thread.id) {
        this._setPopout(false);
      }
    }
  };

  _onPerspectiveChanged() {
    this._onWindowClose();
    return this.trigger();
  }

  _closeWindowIfNoMessage() {
    if (AppEnv.isThreadWindow()) {
      const items = this.items();
      if ((Array.isArray(items) && items.length === 0) || !this._thread) {
        AppEnv.logDebug('Closing window because no message in thread and in ThreadWindow');
        AppEnv.close();
      }
    }
  }

  _onDraftCacheChange = ({ drafts = [], type = 'persist' } = {}) => {
    if (drafts.length > 0) {
      let changed = false;
      if (type === 'persist') {
        drafts.forEach(item => {
          const isInThread = this.threadId() && item.threadId === this.threadId();
          if (!isInThread) {
            AppEnv.logDebug(
              `MessageStore: Draft ${item.id} not in thread ${
                item.threadId
              }, current thread ${this.threadId()}`
            );
            return;
          }
          const itemIndex = this._items.findIndex(msg => msg.id === item.id);
          if (itemIndex === -1) {
            AppEnv.logDebug(
              `MessageStore: Draft ${item.id} added in cache, updating items deleted ${item.deleted}`
            );
            changed = true;
            this._items = [].concat(this._items, [item]).filter(m => !m.isHidden());
          } else if (item.syncState !== this._items[itemIndex].syncState) {
            changed = true;
            AppEnv.logDebug(`MessageStore: Draft ${item.id} cache change, updating sync state`);
            this._items[itemIndex].syncState = item.syncState;
          }
        });
      } else if (type === 'unpersist') {
        drafts.forEach(item => {
          const itemIndex = this._items.findIndex(msg => msg.id === item.id);
          if (itemIndex !== -1) {
            changed = true;
            AppEnv.logDebug(
              `MessageStore:Draft cache item ${item.id} removed, updating message store`
            );
            this._items.splice(itemIndex, 1);
          }
        });
      }
      if (changed) {
        this._items = this._sortItemsForDisplay(this._items);
        this._expandItemsToDefault();
        this._closeWindowIfNoMessage();
        this.trigger();
      }
    }
  };

  _onDataChanged(change) {
    if (!this._thread) return;
    if (change.objectClass === Message.name) {
      const inDisplayedThread = change.objects.some(obj => obj.threadId === this._thread.id);
      if (!inDisplayedThread && change.type === 'persist') return;
      const messages = change.objects.filter(msg => msg.threadId === this._thread.id);
      const drafts = messages.filter(msg => msg.draft && !msg.calendarReply && !msg.ignoreSift);
      if (drafts.length > 0) {
        if (change.type === 'persist') {
          drafts.forEach(item => {
            const itemIndex = this._items.findIndex(msg => msg.id === item.id);
            if (itemIndex === -1) {
              AppEnv.logDebug(
                `MessageStore: Draft ${item.id} added in db, updating items deleted ${item.deleted}`
              );
              this._items = [].concat(this._items, [item]).filter(m => !m.isHidden());
            } else {
              AppEnv.logDebug(`MessageStore: Draft ${item.id} db change, updating sync state`);
              this._items[itemIndex].syncState = item.syncState;
            }
          });
          this._items = this._sortItemsForDisplay(this._items);
        } else if (change.type === 'unpersist') {
          drafts.forEach(item => {
            const itemIndex = this._items.findIndex(msg => msg.id === item.id);
            if (itemIndex !== -1) {
              this._items.splice(itemIndex, 1);
            }
          });
        }
        this._expandItemsToDefault();
        this.trigger();
      }
      if (messages.length !== drafts.length) {
        const newMessages = messages.some(
          msg => !msg.draft && !msg.ignoreSift && !this._items.find(m => m.id === msg.id)
        );
        if (newMessages) {
          AppEnv.logDebug(`New message found for ${this.threadId()}`);
          this._resetAutoMarkAsRead();
        }
        this._fetchFromCache({ skipAutoMarkAsRead: true });
      }
      this._closeWindowIfNoMessage();
      return;
    }

    if (change.objectClass === Thread.name) {
      const updatedThread = change.objects.find(t => t.id === this._thread.id);
      if (updatedThread) {
        const query = ThreadStore.findBy({ threadId: this._thread.id });
        const perspective = FocusedPerspectiveStore.current();
        if (perspective && perspective.isFocusedOtherPerspective) {
          const categoryIds = [];
          perspective.categories().forEach(cat => {
            if (cat && cat.id) {
              categoryIds.push(cat.id);
            }
          });
          if (categoryIds.length > 0) {
            query.where(
              new Matcher.JoinAnd([Thread.attributes.categories.containsAny(categoryIds)])
            );
          }
        }
        query.then(thread => {
          this._updateThread(thread);
          this._fetchFromCache({ skipAutoMarkAsRead: true });
        });
      }
      this._closeWindowIfNoMessage();
    }
  }

  _updateThread = thread => {
    if (thread) {
      this._thread = thread;
      this._lastThreadChangeTimestamp = Date.now();
      // console.log('sending out thread arp');
      ipcRenderer.send('arp', {
        threadId: thread.id,
        arpType: 'thread',
        windowLevel: this._getCurrentWindowLevel(),
      });
    } else {
      //We use threadId='null' to indicates that no thread selected, triggering draft upload check
      ipcRenderer.send('arp', {
        threadId: 'null',
        arpType: 'thread',
        windowLevel: this._getCurrentWindowLevel(),
      });
    }
  };

  _resetAutoMarkAsRead = () => {
    this._lastMarkedAsReadThreadId = null;
    if (this._markAsReadTimer) {
      clearTimeout(this._markAsReadTimer);
      this._markAsReadTimer = null;
    }
  };

  _shouldAutoMarkAsRead = () => {
    const markAsReadDelay = AppEnv.config.get('core.reading.markAsReadDelay');
    if (markAsReadDelay < 0) {
      return false;
    }
    return this._thread && this._lastMarkedAsReadThreadId !== this._thread.id;
  };

  _onFocusChanged(change) {
    if (change.impactsCollection('sift')) {
      this._resetAutoMarkAsRead();
      this._expandItemsToDefault();
      this.trigger();
    }
    if (!change.impactsCollection('thread')) return;
    //DC-400 Because the way list mode is
    if (WorkspaceStore.layoutMode() === 'list') {
      this._onApplyFocusChange();
      return;
    }

    // This implements a debounce that fires on the leading and trailing edge.
    //
    // If we haven't changed focus in the last 100ms, do it immediately. This means
    // there is no delay when moving to the next thread, deselecting a thread, etc.
    //
    // If we have changed focus in the last 100ms, wait for focus changes to
    // stop arriving for 100msec before applying. This means that flying
    // through threads doesn't cause is to make a zillion queries for messages.
    //

    if (!this._onFocusChangedTimer) {
      this._onApplyFocusChange();
    } else {
      clearTimeout(this._onFocusChangedTimer);
    }

    this._onFocusChangedTimer = setTimeout(() => {
      this._onFocusChangedTimer = null;
      this._onApplyFocusChange();
    }, 100);
  }
  _shouldSetFocusContentToNullOnInboxCategoryChange = newFocusedThread => {
    if (!AppEnv.isMainWindow()) {
      return false;
    }
    if (!newFocusedThread) {
      return false;
    }
    const enabledFocusedInbox = AppEnv.config.get('core.workspace.enableFocusedInbox');
    if (!enabledFocusedInbox) {
      return false;
    }
    const currentPerspective = FocusedPerspectiveStore.current();
    if (!currentPerspective || !currentPerspective.isFocusedOtherPerspective) {
      return false;
    }
    const currentThread = this.thread();
    if (!currentThread || currentThread.id !== newFocusedThread.id) {
      return false;
    }
    if (typeof currentThread.isSameInboxCategory !== 'function') {
      AppEnv.reportError(new Error('currentThread does not have isSameInboxCategory method'), {
        errorData: currentThread,
      });
      return false;
    }
    return !currentThread.isSameInboxCategory(newFocusedThread.inboxCategory);
  };

  _onApplyFocusChange() {
    const focused = FocusedContentStore.focused('thread');
    if (WorkspaceStore.layoutMode() === 'list' && AppEnv.isMainWindow()) {
      const currentSheet = WorkspaceStore.topSheet();
      if (!focused && this.thread() && currentSheet && currentSheet.id === 'Thread') {
        AppEnv.logDebug('current thread is gone, and no replacement');
        Actions.popSheet({ reason: 'Message-Store, current Thread is no longer available' });
      }
    }
    // if (this._shouldSetFocusContentToNullOnInboxCategoryChange(focused)) {
    //   AppEnv.logDebug(`Setting focus content to null because inbox category changed`);
    //   Actions.setFocus({ collection: 'thread', item: null, reason: 'Inbox Category Changed' });
    //   return;
    // }

    // if we already match the desired state, no need to trigger
    if (this.threadId() === (focused || {}).id) return;
    this._resetAutoMarkAsRead();
    this._setStoreDefaults();
    this._updateThread(focused);
    // this._thread = focused;
    // this._items = [];
    this._itemsLoading = true;
    // this._showingHiddenItems = false;
    // this._itemsExpanded = {};
    this.trigger();

    this._setWindowTitle();

    this._fetchFromCache({ skipAutoMarkAsRead: false });
    if (AppEnv.isThreadWindow()) {
      DraftCacheStore.getDraftsFromMain();
    }
  }

  setWindowTitle(title) {
    if (AppEnv.isComposerWindow()) {
      if (title && title.length > 0) {
        title = `Draft to: ${title.trim()}`;
      } else {
        title = 'New Draft';
      }
    } else {
      title = title.trim();
    }
    if (title && title.length > 37) {
      title = `${title.slice(0, 37).trim()}...`;
    }
    AppEnv.setWindowTitle(title);
  }

  _setWindowTitle() {
    let title = '';
    if (AppEnv.isComposerWindow()) {
      title = 'New Message';
    } else if (AppEnv.isThreadWindow()) {
      title = 'Thread' + (this._thread ? ' · ' + this._thread.subject : '');
    } else {
      title = 'EdisonMail' + (this._thread ? ' · ' + this._thread.subject : '');
    }
    if (title.length > 37) {
      title = `${title.slice(0, 37).trim()}...`;
    }
    AppEnv.setWindowTitle(title);
  }
  markAsRead = source => {
    this._markAsRead(source);
  };

  _markAsRead(source = 'MessageStore:Thread Selected') {
    // Mark the thread as read if necessary. Make sure it's still the
    // current thread after the timeout.
    //
    // Override canBeUndone to return false so that we don't see undo
    // prompts (since this is a passive action vs. a user-triggered
    // action.)
    if (!this._shouldAutoMarkAsRead()) {
      return;
    }
    if (!this._thread) return;
    // if (this._lastMarkedAsReadThreadId === this._thread.id) return;
    this._lastMarkedAsReadThreadId = this._thread.id;

    if (this._thread.unread) {
      const markAsReadDelay = AppEnv.config.get('core.reading.markAsReadDelay');
      const markAsReadId = this._thread.id;
      if (markAsReadDelay < 0) return;
      if (!this._markAsReadTimer) {
        this._markAsReadTimer = setTimeout(() => {
          this._markAsReadTimer = null;
          if (markAsReadId !== this.threadId() || !this._thread.unread) return;
          Actions.queueTask(
            TaskFactory.taskForInvertingUnread({
              threads: [this._thread],
              source,
              canBeUndone: false,
              unread: false,
            })
          );
        }, markAsReadDelay);
      }
    }
  }

  _onToggleAllMessagesExpanded() {
    if (this.hasCollapsedItems()) {
      this._items.forEach(i => this._expandItem(i));
    } else {
      // Do not collapse the latest message, i.e. the last one
      this._items.slice(0, -1).forEach(i => this._collapseItem(i));
    }
    this.trigger();
  }

  _onToggleHiddenMessages() {
    this._showingHiddenItems = !this._showingHiddenItems;
    this._expandItemsToDefault();
    this._fetchExpandedAttachments(this._items);
    this.trigger();
  }

  _onToggleMessageIdExpanded(id) {
    const item = this._items.find(i => i.id === id);
    if (!item) return;

    if (this._itemsExpanded[id]) {
      this._collapseItem(item);
    } else {
      this._expandItem(item);
    }

    this.trigger();
  }

  _expandItem(item) {
    this._itemsExpanded[item.id] = 'explicit';
    this._fetchExpandedAttachments([item]);
    this._fetchMissingBodies([item]);
  }

  _collapseItem(item) {
    delete this._itemsExpanded[item.id];
  }

  _onAttachmentCacheChange = ({ attachmentChange = [] } = {}) => {
    let dataChange = false;
    for (let k = 0; k < attachmentChange.length; k++) {
      const change = attachmentChange[k];
      for (let i = 0; i < this._items.length; i++) {
        if (this._items[i].id === change.messageId) {
          dataChange = true;
          break;
        }
      }
    }
    if (dataChange) {
      console.warn(`attachment cache updated`);
      this._fetchFromCache({ skipAutoMarkAsRead: true });
      return;
    }
  };

  _fetchFromCache(options = { skipAutoMarkAsRead: true }) {
    if (options == null) options = {};
    if (!this._thread) return;

    const loadedThreadId = this._thread.id;
    const query = this.findAllByThreadIdWithBody({ threadId: loadedThreadId });
    return query.then(items => {
      // Check to make sure that our thread is still the thread we were
      // loading items for. Necessary because this takes a while.
      if (loadedThreadId !== this.threadId()) return;

      this._items = items
        .concat(...DraftCacheStore.findDraftsByThreadId(loadedThreadId))
        .filter(m => !m.isHidden())
        .filter(this.filterOutDuplicateDraft);
      this._items = this._sortItemsForDisplay(this._items);

      this._expandItemsToDefault();
      this._fetchMissingBodies(this._items);
      this._fetchMissingAttachments(this._items, () => {
        // Download the attachments on expanded messages.
        this._fetchExpandedAttachments(this._items);
      });
      // Normally, we would trigger often and let the view's
      // shouldComponentUpdate decide whether to re-render, but if we
      // know we're not ready, don't even bother.  Trigger once at start
      // and once when ready. Many third-party stores will observe
      // MessageStore and they'll be stupid and re-render constantly.
      this._itemsLoading = false;
      if (!options.skipAutoMarkAsRead) {
        this._markAsRead('fetchFromCache');
      }
      this.trigger(this);
    });
  }

  _fetchMissingBodies(items) {
    const missing = items.filter(i => {
      return !i.body || (typeof i.body === 'string' && i.body.length === 0);
    });
    if (missing.length > 0) {
      return Actions.fetchBodies({ messages: missing, source: 'message' });
    }
  }

  fetchMissingAttachmentsByFileIds({ accountId, fileIds = [] } = {}) {
    const missingList = fileIds.filter(id => {
      return this._missingAttachmentIds.includes(id);
    });
    if (missingList && missingList.length && accountId) {
      this._onRequestAttachmentQueue({
        accountId: accountId,
        missingItems: missingList,
        needProgress: true,
        source: 'Click',
      });
    }
  }

  fetchMissingAttachmentsByMessage({ messageId } = {}) {
    const missingInline = [];
    const missingNormal = [];
    const noLongerMissing = [];
    let change = this._missingAttachmentIds.length === 0;
    const message = this._items.find(item => item.id === messageId);
    if (!message) {
      return;
    }

    message.files.forEach((f, fileIndex) => {
      const tmpPath = AttachmentStore.pathForFile(f);
      const tempExists = fs.existsSync(tmpPath);
      if (!tempExists) {
        if (f.isInline) {
          missingInline.push(f.id);
        } else {
          missingNormal.push(f.id);
        }
        if (!this.isAttachmentMissing(f.id)) {
          this._missingAttachmentIds.push(f.id);
          change = true;
        }
        const partExists = fs.existsSync(`${tmpPath}.part`);
        if (message.files[fileIndex].isDownloading !== partExists) {
          change = true;
          message.files[fileIndex].isDownloading = partExists;
        }
      } else {
        if (this.isAttachmentMissing(f.id)) {
          noLongerMissing.push(f.id);
          change = true;
        }
      }
    });

    if (missingNormal.length > 0) {
      this._onRequestAttachmentQueue({
        accountId: message.accountId,
        missingItems: missingNormal,
        needProgress: true,
        source: 'Click',
      });
    }
    if (missingInline.length > 0) {
      this._onRequestAttachmentQueue({
        accountId: message.accountId,
        missingItems: missingInline,
        needProgress: false,
        source: 'Click',
      });
    }
    if (change) {
      this._missingAttachmentIds = this._missingAttachmentIds.filter(id => {
        return !noLongerMissing.includes(id);
      });
      AppEnv.logDebug(`MessageStore: updating missingAttachmentIds ${this.threadId()}`);
      this.trigger();
    }
  }

  _fetchMissingAttachments(messages, callback) {
    const missingAidMap = new Map();
    const noLongerMissing = [];
    let change = this._missingAttachmentIds.length === 0;
    let totalFiles = 0;
    messages.forEach(message => {
      totalFiles += message.files.length;
    });
    let processed = 0;
    const processMissingData = missingIds => {
      // missingIds.forEach((value, aid) => {
      //   if (value && value.length && aid) {
      //     Actions.fetchAttachments({
      //       accountId: aid,
      //       missingItems: value,
      //       needProgress: false,
      //       source: 'message store auto fetch attachment',
      //     });
      //   }
      // });
      if (callback) {
        callback();
      }
      if (change) {
        this._missingAttachmentIds = this._missingAttachmentIds.filter(id => {
          return !noLongerMissing.includes(id);
        });
        AppEnv.logDebug('updating missingAttachmentIds');
        this.trigger();
      }
    };
    messages.forEach((message, messageIndex) => {
      message.files.forEach((f, fileIndex) => {
        const tmpPath = AttachmentStore.pathForFile(f);
        fs.access(tmpPath, fs.constants.R_OK, err => {
          const tempExists = !err;
          if (!tempExists) {
            if (
              f.isInline ||
              (this._itemsExpanded[message.id] && f.size < AutoDownloadSizeThreshHold && f.size > 0)
            ) {
              const aId = message.accountId;
              const oldAIdMap = missingAidMap.get(aId) || [];
              missingAidMap.set(aId, [...oldAIdMap, f.id]);
            }
            if (!this.isAttachmentMissing(f.id)) {
              this._missingAttachmentIds.push(f.id);
              change = true;
            }
            fs.access(`${tmpPath}.part`, err => {
              const partExists = !err;
              processed++;
              if (message.files[fileIndex].isDownloading !== partExists) {
                change = true;
                messages[messageIndex].files[fileIndex].isDownloading = partExists;
              }
              if (processed === totalFiles) {
                processMissingData(missingAidMap);
              }
            });
          } else {
            processed++;
            if (this.isAttachmentMissing(f.id)) {
              noLongerMissing.push(f.id);
              change = true;
            }
            if (processed === totalFiles) {
              processMissingData(missingAidMap);
            }
          }
        });
      });
    });
  }

  getMissingFileIds() {
    return this._missingAttachmentIds.slice();
  }

  isMessageMissingAttachment(message) {
    if (!message) {
      console.error('Missing message for isMessageMissingAttachment');
      return false;
    }
    const msgId = message.id;
    if (!msgId) {
      console.error('Missing message.id for isMessageMissingAttachment');
      return false;
    }
    if (!Array.isArray(message.files)) {
      // console.error(`Missing message ${msgId} files`);
      return false;
    }
    // console.log('getting message missing attachment result');
    return message.files.some(f => {
      return this.isAttachmentMissing(f.id);
    });
  }

  isAttachmentMissing(fileId) {
    return this._missingAttachmentIds.includes(fileId);
  }

  _isMissingBody(item) {
    return item.body === null || (typeof item.body === 'string' && item.body.length === 0);
  }

  _fetchExpandedAttachments(items) {
    const inLineFileIds = [];
    const normalFileIds = [];
    for (let item of items) {
      if (!this._itemsExpanded[item.id]) continue;
      item.files.forEach(file => {
        if (this.isAttachmentMissing(file.id)) {
          if (file.isInline) {
            inLineFileIds.push(file.id);
          } else {
            normalFileIds.push(file.id);
          }
        }
      });
    }
    if (items.length > 0 && items[0]) {
      if (inLineFileIds.length > 0) {
        this._onRequestAttachmentQueue({
          accountId: items[0].accountId,
          missingItems: inLineFileIds,
          needProgress: false,
          source: 'Expand message attachments',
        });
      }
      if (normalFileIds.length > 0) {
        this._onRequestAttachmentQueue({
          accountId: items[0].accountId,
          missingItems: normalFileIds,
          needProgress: true,
          source: 'Expand message attachments',
        });
      }
    }
  }

  // Expand all unread messages, drafts that have body, and the last message
  _expandItemsToDefault() {
    const perspective = FocusedPerspectiveStore.current();
    if (perspective.sift) {
      const selectedSift = FocusedContentStore.focused('sift');
      if (selectedSift) {
        const keys = Object.keys(this._itemsExpanded);
        for (let key of keys) {
          if (this._itemsExpanded[key] === 'default' && key !== selectedSift.id) {
            delete this._itemsExpanded[key];
            break;
          }
        }
        this._itemsExpanded[selectedSift.id] = 'default';
      }
    }
    const visibleItems = this.items();
    let lastDraftIdx = -1;

    visibleItems.forEach((item, idx) => {
      if (item.draft && item.body) {
        lastDraftIdx = idx;
      }
    });

    for (let idx = 0; idx < visibleItems.length; idx++) {
      const item = visibleItems[idx];
      if (item.unread || idx === lastDraftIdx || idx === visibleItems.length - 1) {
        if (!perspective.sift || idx === lastDraftIdx) {
          this._itemsExpanded[item.id] = 'default';
        }
      }
    }
  }

  // _isDraftDuplicateHeaderMessageId(item) {
  //   if (!item.draft) {
  //     return false;
  //   }
  //   let count = 0;
  //   for (let i of this._items) {
  //     if (i.headerMessageId === item.headerMessageId) {
  //       count++;
  //     }
  //     if (count > 1) {
  //       return true;
  //     }
  //   }
  //   return false;
  // }
  //
  filterOutDuplicateDraft(value, index, array) {
    return (
      array.findIndex(el => {
        return el.id === value.id;
      }) === index || !value.draft
    );
  }

  _sortItemsForDisplay(items) {
    // Re-sort items in the list so that drafts appear after the message that
    // they are in reply to, when possible. First, identify all the drafts
    // with a replyToHeaderMessageId and remove them
    let index, item;
    const itemsInReplyTo = [];
    for (index = items.length - 1; index >= 0; index--) {
      item = items[index];
      if (item.draft && item.replyToMessageId) {
        itemsInReplyTo.push(item);
        items.splice(index, 1);
      }
    }

    // For each item with the reply header, re-inset it into the list after
    // the message which it was in reply to. If we can't find it, put it at the end.
    for (item of itemsInReplyTo) {
      for (index = 0; index < items.length; index++) {
        const other = items[index];
        if (item.replyToMessageId === other.id) {
          items.splice(index + 1, 0, item);
          item = null;
          break;
        }
      }
      if (item) {
        items.push(item);
      }
    }

    return items;
  }

  _setPopout(val) {
    if (val !== this._popedOut) {
      this._popedOut = val;
      this.trigger();
    }
  }

  _onPopoutThread = thread => {
    this._setPopout(true);
    const sidebarPerspective = FocusedPerspectiveStore.currentSidebar();
    const currentPerspective = FocusedPerspectiveStore.current();
    let currentPerspectiveJson = '';
    if (!sidebarPerspective.isEqual(currentPerspective)) {
      currentPerspectiveJson = currentPerspective.toJSON();
    }
    return AppEnv.newWindow({
      title: thread.subject,
      hidden: false,
      additionalChannelParam: 'thread',
      windowKey: `thread-${thread.id}`,
      windowType: 'thread-popout',
      threadId: thread.id,
      accountId: thread.accountId,
      windowLevel: this._currentWindowLevel,
      windowProps: {
        threadId: thread.id,
        sidebarPerspectiveJson: sidebarPerspective.toJSON(),
        currentPerspectiveJson: currentPerspectiveJson,
      },
    });
  };

  // _onFocusThreadMainWindow(thread) {
  //   if (AppEnv.isMainWindow()) {
  //     Actions.setFocus({ collection: 'thread', item: thread });
  //     this._setPopout(false);
  //     return AppEnv.focus();
  //   } else {
  //     this._onWindowClose();
  //   }
  // }
}

const store = new MessageStore();
store.FolderNamesHiddenByDefault = FolderNamesHiddenByDefault;
export default store;
