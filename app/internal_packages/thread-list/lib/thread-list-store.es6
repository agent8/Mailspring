import {
  Rx,
  Actions,
  WorkspaceStore,
  FocusedContentStore,
  FocusedPerspectiveStore,
} from 'mailspring-exports';
import { ListTabular } from 'mailspring-component-kit';
import ThreadListDataSource from './thread-list-data-source';
import { ipcRenderer } from 'electron';
import MailspringStore from 'mailspring-store';

class ThreadListStore extends MailspringStore {
  constructor() {
    super();
    this.listenTo(FocusedPerspectiveStore, this._onPerspectiveChanged);
    ipcRenderer.on('refresh-start-of-day', this._onRefreshStartOfDay);
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
      this._dataSourceUnlisten = this._dataSource.listen(this._onDataChanged, this);
    } else {
      this._dataSource = new ListTabular.DataSource.Empty();
    }

    this.trigger(this);
    Actions.setFocus({ collection: 'thread', item: null, reason: 'onCreateThreadListDataSource' });
  };

  selectionObservable = () => {
    return Rx.Observable.fromListSelection(this);
  };

  // Inbound Events

  _onPerspectiveChanged = () => {
    if (AppEnv.isMainWindow()) {
      this.createListDataSource();
    } else {
      AppEnv.logDebug('not main window ignoring perspective change');
    }
  };

  _onDataChanged = ({ previous, next } = {}) => {
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
        AppEnv.logDebug('Next query returns empty results');
        Actions.setFocus({
          collection: 'thread',
          item: null,
          reason: 'Next query returns empty results',
        });
        Actions.setCursorPosition({ collection: 'thread', item: null });
        return;
      }
      const viewModeAutofocuses =
        WorkspaceStore.layoutMode() === 'split' || WorkspaceStore.topSheet().root === true;

      const nextQ = next.query();
      const matchers = nextQ && nextQ.matchers();

      const focusedIndex = focused ? previous.offsetOfId(focused.id) : -1;
      const keyboardIndex = keyboard ? previous.offsetOfId(keyboard.id) : -1;

      const nextItemFromIndex = i => {
        let nextIndex;
        if (
          i > 0 &&
          ((next.modelAtOffset(i - 1) && next.modelAtOffset(i - 1).unread) || i >= next.count())
        ) {
          nextIndex = i - 1;
        } else {
          nextIndex = i;
        }

        // May return null if no thread is loaded at the next index
        return next.modelAtOffset(nextIndex);
      };

      const notInSet = function(model) {
        if (matchers) {
          return model.matches(matchers) === false && next.offsetOfId(model.id) === -1;
        } else {
          return next.offsetOfId(model.id) === -1;
        }
      };

      if (viewModeAutofocuses && focused && notInSet(focused)) {
        const perspective = FocusedPerspectiveStore.current();
        if (perspective && perspective.unread) {
          Actions.setFocus({ collection: 'thread', item: null });
        } else {
          Actions.setFocus({ collection: 'thread', item: nextItemFromIndex(focusedIndex) });
        }
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
