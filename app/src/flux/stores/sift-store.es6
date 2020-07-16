import MailspringStore from 'mailspring-store';
import DatabaseStore from './database-store';
import Message from '../models/message';
import Thread from '../models/thread';
import Sift from '../models/sift';
import FocusedPerspectiveStore from './focused-perspective-store';
import {
  Rx,
  Actions,
  MutableQueryResultSet,
  ObservableListDataSource,
  FocusedContentStore,
  ThreadStore,
} from 'mailspring-exports';
import ListTabular from '../../components/list-tabular';
import DatabaseChangeRecord from './database-change-record';

class SiftStore extends MailspringStore {
  constructor() {
    super();
    this._tasks = [];
    this._dataSource = null;
    this._dataSourceUnlisten = null;
    this._totalInOutbox = 0;
    this._totalFailedDrafts = 0;
    this._selectedSift = null;
    this._siftCategory = '';
    if (AppEnv.isMainWindow()) {
      this.listenTo(FocusedPerspectiveStore, this._onPerspectiveChanged);
      this.listenTo(FocusedContentStore, this._onFocusedContentChanged);
      this.listenTo(DatabaseStore, this._onDataChanged);
      this._createListDataSource();
    }
  }

  siftCategory() {
    return this._siftCategory;
  }

  selectedSift() {
    return this._selectedSift;
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
  _triggerDatasource = model => {
    Actions.forceDatabaseTrigger(
      new DatabaseChangeRecord({
        type: 'unpersist',
        objectClass: 'Message',
        objects: [model],
      })
    );
  };
  _forceDataSourceTrigger = ({ source = '', index = -1 }) => {
    if (this._dataSource && !this._dataSource.empty()) {
      const mockMessage = this._dataSource.get(index === -1 ? 0 : index);
      if (mockMessage) {
        mockMessage.date = Date.now();
        mockMessage.siftData = [];
        mockMessage.ignoreSift = true;
        this._triggerDatasource(mockMessage);
      } else {
        AppEnv.reportError(
          new Error('mockMessage not found'),
          { errorData: { index, total: this._dataSource.count() } },
          { grabLogs: false }
        );
      }
    }
  };

  _onDataChanged(change) {
    const currentPerspective = FocusedPerspectiveStore.current();
    if (currentPerspective.sift) {
      if (change.objectClass === Message.name) {
        let needUpdate = false;
        change.objects.forEach(obj => {
          if (this._selectedSift && this._selectedSift.id === obj.id) {
            if (change.type === 'persist') {
              this._selectedSift = obj;
            } else {
              this._selectedSift = null;
            }
            needUpdate = true;
          }
        });
        if (needUpdate) {
          this.trigger();
        }
      } else if (change.objectClass === Thread.name) {
        let needUpdate = false;
        let index = -1;
        for (let obj of change.objects) {
          index = this._findThreadInDataSet(obj);
          if (index !== -1) {
            needUpdate = true;
            break;
          }
        }
        if (needUpdate) {
          this._forceDataSourceTrigger({ index, source: 'thread change' });
        }
      } else if (change.objectClass === Sift.name) {
        let needUpdate = false;
        for (let obj of change.objects) {
          if (Sift.categoryStringToIntString(this._siftCategory) === obj.category.toString()) {
            needUpdate = true;
            break;
          }
        }
        if (needUpdate) {
          this._forceDataSourceTrigger({ source: 'sift change' });
        }
      }
    }
  }

  _findThreadInDataSet = thread => {
    if (this._dataSource && !this._dataSource.empty()) {
      const ids = this._dataSource._resultSet._ids;
      for (let i = 0; i < ids.length; i++) {
        if (this._dataSource._resultSet._modelsHash[ids[i]].threadId === thread.id) {
          return i;
        }
      }
    }
    return -1;
  };
  _onFocusedContentChanged = () => {
    const focused = FocusedContentStore.focused('sift');
    if (!focused) {
      if (this._selectedSift) {
        this._selectedSift = null;
        this.trigger();
      }
    } else {
      if (!this._selectedSift) {
        this._selectedSift = focused;
        this.trigger();
      } else if (focused.id !== this._selectedSift.id) {
        this._selectedSift = focused;
        this.trigger();
      }
    }
  };

  _onPerspectiveChanged = () => {
    const current = FocusedPerspectiveStore.current();
    if (!current.sift) {
      if (this.selectedSift()) {
        Actions.setFocus({
          collection: 'sift',
          item: null,
          reason: 'SiftStore:onPerspectiveChange',
        });
      }
      this._selectedSift = null;
      this._siftCategory = '';
      // if (typeof this._dataSourceUnlisten === 'function') {
      //   this._dataSourceUnlisten();
      //   this._dataSourceUnlisten = null;
      // }
      // if (this._dataSource) {
      //   this.dataSource().selection.clear();
      //   this._dataSource.cleanup();
      //   this._dataSource = null;
      //   console.log('unlistened to data change for sift');
      // }
      this.trigger();
    } else {
      Actions.syncSiftFolder({ categories: [current.siftCategory] });
      this._createListDataSource();
    }
  };

  _createListDataSource = () => {
    if (typeof this._dataSourceUnlisten === 'function') {
      this._dataSourceUnlisten();
      this._dataSourceUnlisten = null;
    }
    if (this._dataSource) {
      this._dataSource.cleanup();
      this._dataSource = null;
    }
    const perspective = FocusedPerspectiveStore.current();
    if (!perspective.sift) {
      this._dataSource = new ListTabular.DataSource.Empty();
    } else {
      const subscription = perspective.messages();
      this._siftCategory = perspective.siftCategory;
      let $resultSet = Rx.Observable.fromNamedQuerySubscription('sift-list', subscription);
      $resultSet = Rx.Observable.combineLatest([$resultSet], (resultSet, sift) => {
        const resultSetWithTasks = new MutableQueryResultSet(resultSet);
        return resultSetWithTasks.immutableClone();
      });

      this._dataSource = new ObservableListDataSource($resultSet, subscription.replaceRange);
      this._dataSourceUnlisten = this._dataSource.listen(this._onDataSourceChanged, this);
    }
    this._dataSource.setRetainedRange({ start: 0, end: 50 });
    this.trigger(this);
  };
  _onDataSourceChanged = ({ previous, next } = {}) => {
    if (previous && next) {
      const focused = FocusedContentStore.focused('sift');
      const keyboard = FocusedContentStore.keyboardCursor('sift');
      const notInSet = function(model) {
        // if (matchers) {
        //   return model.matches(matchers) === false && next.offsetOfId(model.id) === -1;
        // } else {
        return next.offsetOfId(model.id) === -1;
        // }
      };
      const focusedIndex = focused ? previous.offsetOfId(focused.id) : -1;
      const keyboardIndex = keyboard ? previous.offsetOfId(keyboard.id) : -1;
      const nextItemFromIndex = i => {
        const nextAction = AppEnv.config.get('core.reading.actionAfterRemove');
        return ObservableListDataSource.nextItemFromIndex(i, next, nextAction);
      };

      if (focused && notInSet(focused)) {
        const sift = nextItemFromIndex(focusedIndex);
        Actions.setFocus({
          collection: 'sift',
          item: sift,
          reason: 'SiftStore:onDataChange',
        });
        if (sift) {
          ThreadStore.findBy({ threadId: sift.threadId }).then(result => {
            Actions.setFocus({
              collection: 'thread',
              item: result,
              reason: 'SiftStore:onDataChange:dbResult',
            });
          });
        } else {
          Actions.setFocus({
            collection: 'thread',
            item: null,
            reason: 'SiftStore:onDataChange:dbResult',
          });
        }
      }

      if (keyboard && notInSet(keyboard)) {
        const sift = nextItemFromIndex(keyboardIndex);
        Actions.setCursorPosition({
          collection: 'sift',
          item: sift,
        });
        if (sift) {
          ThreadStore.findBy({ threadId: sift.threadId }).then(result => {
            Actions.setCursorPosition({
              collection: 'thread',
              item: result,
              reason: 'SiftStore:onDataChange:dbResult',
            });
          });
        } else {
          Actions.setCursorPosition({
            collection: 'thread',
            item: null,
            reason: 'SiftStore:onDataChange:dbResult',
          });
        }
      }
    }
  };

  // _populate() {
  //   const nextTasks = TaskQueue.queue().filter(
  //     task => task instanceof SendDraftTask || task instanceof SyncbackDraftTask,
  //   );
  //   if (this._tasks.length === 0 && nextTasks.length === 0) {
  //     return;
  //   }
  //   this._tasks = nextTasks;
  //   this.trigger();
  // }
}

const store = new SiftStore();
export default store;
