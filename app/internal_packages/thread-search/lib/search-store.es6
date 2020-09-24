import MailspringStore from 'mailspring-store';
import {
  Actions,
  AccountStore,
  FocusedPerspectiveStore,
  WorkspaceStore,
  SearchQueryParser,
  SearchQueryAST,
} from 'mailspring-exports';
import _ from 'underscore';
import SearchMailboxPerspective from './search-mailbox-perspective';

// Stores should closely match the needs of a particular part of the front end.
// For example, we might create a "MessageStore" that observes this store
// for changes in selectedThread, "DatabaseStore" for changes to the underlying database,
// and vends up the array used for that view.

class SearchStore extends MailspringStore {
  constructor() {
    super();

    this._searchQuery = FocusedPerspectiveStore.current().searchQuery || '';
    this._isSearching = false;

    this.listenTo(WorkspaceStore, this._onWorkspaceChange);
    this.listenTo(FocusedPerspectiveStore, this._onPerspectiveChanged);
    this.listenTo(Actions.searchQuerySubmitted, this._onQuerySubmitted);
    this.listenTo(Actions.searchQueryChanged, this._onQueryChanged);
    this.listenTo(Actions.searchCompleted, this._onSearchCompleted);
  }

  query() {
    return this._searchQuery;
  }
  _isMatchedExpression = query => {
    if (!query) {
      return false;
    }
    return (
      query instanceof SearchQueryAST.GenericQueryExpression ||
      query instanceof SearchQueryAST.SubjectQueryExpression ||
      query instanceof SearchQueryAST.FromQueryExpression
    );
  };
  getSearchText() {
    let searchValue = '';
    const query = this._preSearchQuery;
    let parsedQuery = {};
    try {
      parsedQuery = query ? SearchQueryParser.parse(query) : {};
      if (parsedQuery instanceof SearchQueryAST.AndQueryExpression) {
        for (const k in parsedQuery) {
          if (this._isMatchedExpression(parsedQuery[k])) {
            searchValue = parsedQuery[k].text.token.s;
            break;
          }
        }
      } else if (this._isMatchedExpression(parsedQuery)) {
        searchValue = parsedQuery.text.token.s;
      }
    } catch (err) {
      console.info(
        'Failed to parse local search query, falling back to generic query',
        query,
        'error',
        err
      );
      searchValue = query;
    }
    return searchValue;
  }

  queryPopulated() {
    return this._searchQuery && this._searchQuery.trim().length > 0;
  }

  isSearching() {
    return this._isSearching;
  }

  _onSearchCompleted = () => {
    this._onRemoveCancelSearchingTimeout();
    this._isSearching = false;
    this.trigger();
  };
  _onAddCancelSearchingTimeout = () => {
    this._onRemoveCancelSearchingTimeout();
    this._completedTimeout = setTimeout(() => {
      this._isSearching = false;
      this.trigger();
    }, 5000);
  };
  _onRemoveCancelSearchingTimeout = () => {
    if (this._completedTimeout) {
      clearTimeout(this._completedTimeout);
      this._completedTimeout = null;
    }
  };
  _onWorkspaceChange = () => {
    const sheetId = WorkspaceStore.topSheet().id;
    if (sheetId === 'ChatView') {
      this._searchQuery = '';
      this.trigger();
    }
  };

  _onPerspectiveChanged = () => {
    this._searchQuery = FocusedPerspectiveStore.current().searchQuery || '';
    this.trigger();
  };

  _onQueryChanged = query => {
    if (query !== this._searchQuery) {
      this._searchQuery = query;
      this.trigger();
      this._processAndSubmitQuery();
      this._throttleOnQuerySubmitted(query, true);
    }
  };

  _processAndSubmitQuery = _.throttle(flag => {
    if (!flag) {
      return;
    }
    const current = FocusedPerspectiveStore.currentSidebar();

    if (this.queryPopulated()) {
      this._isSearching = true;
      if (!(current instanceof SearchMailboxPerspective)) {
        this._perspectiveBeforeSearch = current;
      }
      const next = new SearchMailboxPerspective(current, this._searchQuery);
      Actions.focusMailboxPerspective(next, true);
      this._onAddCancelSearchingTimeout();
    } else if (current instanceof SearchMailboxPerspective) {
      this._isSearching = false;
      if (this._perspectiveBeforeSearch) {
        Actions.focusMailboxPerspective(this._perspectiveBeforeSearch);
        this._perspectiveBeforeSearch = null;
      } else {
        Actions.focusDefaultMailboxPerspectiveForAccounts(AccountStore.accounts());
      }
    }
    this.trigger();
  }, 700);

  _throttleOnQuerySubmitted = _.debounce((query, forceQuery) => {
    this._onQuerySubmitted(query, forceQuery);
  }, 700);

  _onQuerySubmitted = (query, forceQuery) => {
    if (query !== this._searchQuery || forceQuery) {
      this._searchQuery = query;
      this._preSearchQuery = query;
      this.trigger();
      this._processAndSubmitQuery(forceQuery);
    }
  };
}

export default new SearchStore();
