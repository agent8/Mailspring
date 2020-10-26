import { Rx, Actions, FocusedContentStore, FocusedPerspectiveStore } from 'mailspring-exports';
import { ListTabular } from 'mailspring-component-kit';
import ThreadListDataSource from './thread-list-data-source';
import { ipcRenderer } from 'electron';
import MailspringStore from 'mailspring-store';

class ThreadListStore extends MailspringStore {
  constructor() {
    super();
    this._limitSearchDate = true;
    this.listenTo(FocusedPerspectiveStore, this._onPerspectiveChanged);
    ipcRenderer.on('refresh-start-of-day', this._onRefreshStartOfDay);
    Actions.expandSearchDate.listen(this._onExpandSearchDate);
    this.createListDataSource();
  }
  _onRefreshStartOfDay = () => {
    const perspective = FocusedPerspectiveStore.current();
    if (AppEnv.isMainWindow() && perspective && perspective.isToday) {
      AppEnv.logDebug('Force Refresh today thread list in 100ms');
      // Set timeout to give native time to update today count
      setTimeout(this.createListDataSource, 100);
    }
  };
  limitSearchDate = () => {
    return this._limitSearchDate;
  };
  _onExpandSearchDate = () => {
    const currentPerspective = FocusedPerspectiveStore.current();
    if (currentPerspective && currentPerspective.isSearchMailbox && this._limitSearchDate) {
      this._limitSearchDate = false;
      if (typeof this._dataSourceUnlisten === 'function') {
        this._dataSourceUnlisten();
      }

      if (this._dataSource) {
        this._dataSource.cleanup();
        this._dataSource = null;
      }

      const threadsSubscription = FocusedPerspectiveStore.current().threads(false);
      console.warn('subscription changed');
      if (threadsSubscription) {
        this._dataSource = new ThreadListDataSource(threadsSubscription);
        this._dataSourceUnlisten = this._dataSource.listen(this._onDataChanged);
      } else {
        this._dataSource = new ListTabular.DataSource.Empty();
      }
      this.trigger(this);
    }
  };

  dataSource = () => {
    return this._dataSource;
  };

  createListDataSource = () => {
    if (typeof this._dataSourceUnlisten === 'function') {
      this._dataSourceUnlisten();
    }

    if (this._dataSource) {
      this._dataSource.cleanup();
      this._dataSource = null;
    }

    const threadsSubscription = FocusedPerspectiveStore.current().threads();
    if (threadsSubscription) {
      this._dataSource = new ThreadListDataSource(threadsSubscription);
      this._dataSourceUnlisten = this._dataSource.listen(this._onDataChanged);
    } else {
      this._dataSource = new ListTabular.DataSource.Empty();
    }

    this.trigger(this);
    Actions.setFocus({
      collection: 'thread',
      item: null,
      reason: 'ThreadListStore:onCreateThreadListDataSource',
    });
  };

  selectionObservable = () => {
    return Rx.Observable.fromListSelection(this);
  };

  // Inbound Events

  _onPerspectiveChanged = () => {
    this._limitSearchDate = true;
    if (AppEnv.isMainWindow()) {
      this.createListDataSource();
    } else {
      AppEnv.logDebug('not main window ignoring perspective change');
    }
  };

  _onDataChanged = ({ previous, next } = {}) => {
    // If in SearchMailBox, and we returned less than 100 results,
    // we want to expand our search scope
    const currentPerspective = FocusedPerspectiveStore.current();
    if (next && currentPerspective && currentPerspective.isSearchMailbox) {
      if (next.empty() || next._ids.length < 100) {
        //defer until next cycle, give UI time to display no results page if no results are found
        setTimeout(() => Actions.expandSearchDate());
      }
    }
    // This code keeps the focus and keyboard cursor in sync with the thread list.
    // When the thread list changes, it looks to see if the focused thread is gone,
    // or no longer matches the query criteria and advances the focus to the next
    // thread.

    // This means that removing a thread from view in any way causes selection
    // to advance to the adjacent thread. Nice and declarative.
    if (previous && next) {
      const focused = FocusedContentStore.focused('thread');
      const keyboard = FocusedContentStore.keyboardCursor('thread');
      // If next query returns empty results, we set all focus to null;
      if (next.empty() || next._ids.length === 0) {
        Actions.setFocus({
          collection: 'thread',
          item: null,
          reason: 'ThreadListStore:Next query returns empty results',
        });
        Actions.setCursorPosition({ collection: 'thread', item: null });
        return;
      }

      // const topSheet = WorkspaceStore.topSheet();
      // const layoutMode = WorkspaceStore.layoutMode();
      // const viewModeAutofocuses =
      //   (topSheet.id === 'Threads' || topSheet.id === 'Sift') && layoutMode === 'list';
      const nextQ = next.query();
      const matchers = nextQ && nextQ.matchers();

      const focusedIndex = focused ? previous.offsetOfId(focused.id) : -1;
      const keyboardIndex = keyboard ? previous.offsetOfId(keyboard.id) : -1;
      const nextItemFromIndex = i => {
        const nextAction = AppEnv.config.get('core.reading.actionAfterRemove');
        return ThreadListDataSource.nextItemFromIndex(i, next, nextAction);
      };

      const notInSet = function(model) {
        if (matchers) {
          return model.matches(matchers) === false && next.offsetOfId(model.id) === -1;
        } else {
          return next.offsetOfId(model.id) === -1;
        }
      };

      if (focused && notInSet(focused)) {
        // Actions.setFocus({ collection: 'thread', item: null });
        Actions.setFocus({
          collection: 'thread',
          item: nextItemFromIndex(focusedIndex),
          reason: 'ThreadlistStore:onDataChange',
        });
      }

      if (keyboard && notInSet(keyboard)) {
        Actions.setCursorPosition({
          collection: 'thread',
          item: nextItemFromIndex(keyboardIndex),
        });
      }
    }
  };
}

module.exports = new ThreadListStore();
