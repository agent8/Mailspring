import MailspringStore from 'mailspring-store';
import SendDraftTask from '../tasks/send-draft-task';
import SyncbackDraftTask from '../tasks/syncback-draft-task';
import TaskQueue from './task-queue';
import DatabaseStore from './database-store';
import Message from '../models/message';
import FocusedPerspectiveStore from './focused-perspective-store';
import {
  Rx,
  Actions,
  MutableQueryResultSet,
  MutableQuerySubscription,
  ObservableListDataSource,
  FocusedContentStore,
  AccountStore,
} from 'mailspring-exports';

const resendIndicatorTimeoutMS = 3000;
class OutboxStore extends MailspringStore {
  static findAll() {
    return DatabaseStore.findAll(Message, { draft: true, hasCalendar: false, deleted: false }).where([
      Message.attributes.syncState.in([Message.messageSyncState.failed, Message.messageSyncState.failing]),
    ]);
  }

  static findAllInDescendingOrder() {
    return OutboxStore.findAll().order([
      Message.attributes.syncState.descending(),
      Message.attributes.date.descending(),
    ]);
  }

  static findAllWithBodyInDescendingOrder() {
    return OutboxStore.findAllInDescendingOrder().linkDB(Message.attributes.body);
  }

  constructor() {
    super();
    this._tasks = [];
    this._dataSource = null;
    this._dataSourceUnlisten = null;
    this._totalInOutbox = 0;
    this._totalFailedDrafts = 0;
    this._selectedDraft = null;
    this._resendingDrafts = {};
    this._resendDraftCheckTimer = null;
    if (AppEnv.isMainWindow()) {
      this.listenTo(TaskQueue, this._populate);
      this.listenTo(FocusedPerspectiveStore, this._onPerspectiveChanged);
      this.listenTo(FocusedContentStore, this._onFocusedContentChanged);
      this.listenTo(DatabaseStore, this._onDataChanged);
      this.listenTo(Actions.gotoOutbox, this._gotoOutbox);
      this.listenTo(Actions.cancelOutboxDrafts, this._onCancelOutboxDraft);
      this.listenTo(Actions.editOutboxDraft, this._onEditOutboxDraft);
      this.listenTo(Actions.resendDrafts, this._appendToResendDraft);
      this._createListDataSource();
    }
  }

  selectedDraft() {
    return this._selectedDraft;
  }

  count() {
    return {
      failed: this._totalFailedDrafts,
      total: this._totalInOutbox,
    };
  }

  dataSource = () => {
    return this._dataSource;
  };

  selectionObservable = () => {
    return Rx.Observable.fromListSelection(this);
  };

  draftNeedsToDisplaySending = draft => {
    if (this._resendingDrafts[draft.headerMessageId]) {
      return true;
    }
    return Message.compareMessageState(draft.syncState, Message.messageSyncState.failing);
  };
  _clearResendIndicators = () => {
    this._resendDraftCheckTimer = null;
    const headerMessageIds = Object.keys(this._resendingDrafts);
    if (headerMessageIds.length > 0) {
      let shouldTrigger = false;
      headerMessageIds.forEach(headerMessageId => {
        const now = Date.now();
        if (now - this._resendingDrafts[headerMessageId] >= resendIndicatorTimeoutMS) {
          delete this._resendingDrafts[headerMessageId];
          shouldTrigger = true;
        }
      });
      this._triggerTimerCheck();
      if (shouldTrigger) {
        this.trigger();
      }
    }
  };
  _triggerTimerCheck = () => {
    const headerMessageIds = Object.keys(this._resendingDrafts);
    if (headerMessageIds.length > 0) {
      if (!this._resendDraftCheckTimer) {
        this._resendDraftCheckTimer = setTimeout(
          this._clearResendIndicators,
          resendIndicatorTimeoutMS
        );
      }
    }
  };
  _appendToResendDraft = ({ messages = [], source = '' } = {}) =>{
    let shouldTrigger = false;
    messages.forEach(message => {
      if (!this._resendingDrafts[message.headerMessageId]) {
        this._resendingDrafts[message.headerMessageId] = Date.now();
        shouldTrigger = true;
      }
    });
    this._triggerTimerCheck();
    if (shouldTrigger){
      this.trigger();
    }
  };
  _onEditOutboxDraft = (headerMessageId) =>{
    if(this._selectedDraft && headerMessageId === this._selectedDraft.headerMessageId){
      this._selectedDraft = null;
      this.trigger();
    }
  };
  _onCancelOutboxDraft = ({messages = []}) => {
    if(!this._selectedDraft){
      return;
    }
    for(let i = 0; i< messages.length; i++){
      if(messages[i].id === this._selectedDraft.id){
        this._selectedDraft = null;
        this.trigger();
        break;
      }
    }
  };

  _gotoOutbox() {
    if (this.count().total > 0) {
      FocusedPerspectiveStore.gotoOutbox();
    }
  }

  _onDataChanged(change) {
    const currentPerspective = FocusedPerspectiveStore.current();
    if (currentPerspective.outbox) {
      if (change.objectClass === Message.name) {
        let needUpdate = false;
        change.objects.forEach(obj => {
          if (obj.draft && [Message.messageSyncState.failing, Message.messageSyncState.failed].includes(obj.syncState)) {
            if (this._selectedDraft && this._selectedDraft.id === obj.id) {
              if (change.type === 'persist') {
                this._selectedDraft = obj;
              } else {
                this._selectedDraft = null;
              }
              needUpdate = true;
            }
          }
        });
        if (needUpdate) {
          this.trigger();
        }
      }
    }
  }
  _onFocusedContentChanged = () => {
    const focused = FocusedContentStore.focused('outbox');
    console.log(`\n---\n${focused}`);
    if (!focused) {
      if (this._selectedDraft) {
        this._selectedDraft = null;
        this.trigger();
      }
    } else if (
      focused.draft &&
      [Message.messageSyncState.failed, Message.messageSyncState.failing].includes(focused.syncState.toString())
    ) {
      if (!this._selectedDraft) {
        this._selectedDraft = focused;
        this.trigger();
      } else if (focused.id !== this._selectedDraft.id) {
        this._selectedDraft = focused;
        this.trigger();
      } else if (
        focused.id === this._selectedDraft.id &&
        focused.syncState !== this._selectedDraft.syncState
      ) {
        this._selectedDraft = focused;
        this.trigger();
      }
    }
  };

  _onPerspectiveChanged = () => {
    const current = FocusedPerspectiveStore.current();
    if (!current.outbox) {
      if (this.selectedDraft()) {
        Actions.setFocus({ collection: 'outbox', item: null });
      }
      this._selectedDraft = null;
      // if (typeof this._dataSourceUnlisten === 'function') {
      //   this._dataSourceUnlisten();
      // }
      // if (this._dataSource) {
      //   this.dataSource().selection.clear();
      //   this._dataSource.cleanup();
      //   this._dataSource = null;
      // }
      this.trigger();
    }
  };

  _createListDataSource = () => {
    if (typeof this._dataSourceUnlisten === 'function') {
      this._dataSourceUnlisten();
    }
    if (this._dataSource) {
      this._dataSource.cleanup();
      this._dataSource = null;
    }
    const query = OutboxStore.findAllWithBodyInDescendingOrder().page(0, 1);
    const subscription = new MutableQuerySubscription(query, { emitResultSet: true });
    let $resultSet = Rx.Observable.fromNamedQuerySubscription('outbox-list', subscription);
    $resultSet = Rx.Observable.combineLatest(
      [$resultSet],
      (resultSet, outbox) => {
        // Generate a new result set that includes additional information on
        // the draft objects. This is similar to what we do in the thread-list,
        // where we set thread.__messages to the message array.
        const resultSetWithTasks = new MutableQueryResultSet(resultSet);
        return resultSetWithTasks.immutableClone();
      },
    );

    this._dataSource = new ObservableListDataSource($resultSet, subscription.replaceRange);
    this._dataSourceUnlisten = this._dataSource.listen(this._onDataSourceChanged, this);
    this._dataSource.setRetainedRange({ start: 0, end: 50 });
    this.trigger(this);
  };
  _onDataSourceChanged = ({ previous, next } = {}) => {
    if (next) {
      const total = next.count();
      const failed = this._numberOfFailedDrafts(next.models());
      if (total !== this._totalInOutbox || failed !== this._totalFailedDrafts) {
        this._totalInOutbox = total;
        this._totalFailedDrafts = failed;
        if(total === 0){
          AppEnv.logDebug('Outbox no longer have data');
          const currentPerspective = FocusedPerspectiveStore.current();
          if (currentPerspective && currentPerspective.outbox) {
            Actions.focusDefaultMailboxPerspectiveForAccounts(AccountStore.accounts());
          }
        }
        this.trigger();
      }
    }
    if (previous && next) {
      const focused = FocusedContentStore.focused('outbox');
      const keyboard = FocusedContentStore.keyboardCursor('outbox');
      const nextQ = next.query();
      const matchers = nextQ && nextQ.matchers();

      const notInSet = function(model) {
        if (matchers) {
          return model.matches(matchers) === false && next.offsetOfId(model.id) === -1;
        } else {
          return next.offsetOfId(model.id) === -1;
        }
      };

      if (focused && notInSet(focused)) {
        Actions.setFocus({ collection: 'outbox', item: null });
      }

      if (keyboard && notInSet(keyboard)) {
        Actions.setCursorPosition({
          collection: 'outbox',
          item: null,
        });
      }
    }
  };
  _numberOfFailedDrafts = drafts => {
    let ret = 0;
    if (Array.isArray(drafts)) {
      drafts.forEach(item => {
        ret += Message.compareMessageState(item.syncState, Message.messageSyncState.failed);
      });
    }
    return ret;
  };

  _populate() {
    const nextTasks = TaskQueue.queue().filter(
      task => task instanceof SendDraftTask || task instanceof SyncbackDraftTask,
    );
    if (this._tasks.length === 0 && nextTasks.length === 0) {
      return;
    }
    this._tasks = nextTasks;
    this.trigger();
  }
}

const store = new OutboxStore();
export default store;