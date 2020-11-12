import _ from 'underscore';
import {
  Actions,
  Thread,
  DatabaseStore,
  CategoryStore,
  SearchQueryParser,
  ComponentRegistry,
  MutableQuerySubscription,
  IMAPSearchQueryBackend,
  IMAPSearchTask,
  Constant,
} from 'mailspring-exports';

const utf7 = require('utf7').imap;

class SearchQuerySubscription extends MutableQuerySubscription {
  constructor(searchQuery, accountIds) {
    super(null, { emitResultSet: true });
    this._searchQuery = searchQuery;
    this._accountIds = accountIds;

    this._connections = [];
    this._extDisposables = [];

    _.defer(() => this.performSearch());
  }

  replaceRange = () => {
    // TODO
  };

  performSearch() {
    this.performLocalSearch();
    this.performExtensionSearch();
  }

  performLocalSearch() {
    let dbQuery = DatabaseStore.findAll(Thread);
    if (this._accountIds.length === 1) {
      dbQuery = dbQuery.where({ accountId: this._accountIds[0] });
    }
    let parsedQuery = null;
    try {
      parsedQuery = SearchQueryParser.parse(this._searchQuery);
      // const firstInQueryExpression = parsedQuery.getFirstInQueryExpression();
      // if (!firstInQueryExpression) {
      //   const defaultFolder = new Set();
      //   this._accountIds.forEach(accountId => {
      //     if (CategoryStore.getAllMailCategory(accountId)) {
      //       defaultFolder.add('in:"All Mail"');
      //     } else if (CategoryStore.getCategoryByRole(accountId, 'inbox')) {
      //       defaultFolder.add('in:"Inbox"');
      //     }
      //   });
      //   const defaultFolderStr = [...defaultFolder].join(` or `);
      //   parsedQuery = SearchQueryParser.parse(`${defaultFolderStr} ${this._searchQuery}`);
      // }
      dbQuery = dbQuery.structuredSearch(parsedQuery);
    } catch (e) {
      console.info('Failed to parse local search query, falling back to generic query', e);
      dbQuery = dbQuery.search(this._searchQuery);
    }
    dbQuery = dbQuery
      .background()
      .setQueryType(Constant.QUERY_TYPE.SEARCH_PERSPECTIVE)
      .where({ state: 0 })
      .order(Thread.attributes.lastMessageTimestamp.descending())
      .limit(500);
    this._performRemoteSearch({
      accountIds: this._accountIds,
      parsedQuery,
      searchQuery: this._searchQuery,
    });
    if (AppEnv.isHinata()) {
      dbQuery.setShowQueryResults(true);
    }
    this.replaceQuery(dbQuery);
  }

  _performRemoteSearch = ({ accountIds, parsedQuery = null, searchQuery = '' } = {}) => {
    let queryJSON = {};
    let genericText = '';
    let firstInQueryRole = null;
    if (parsedQuery) {
      const firstInQueryExpression = parsedQuery.getFirstInQueryExpression();
      firstInQueryRole =
        firstInQueryExpression &&
        firstInQueryExpression.text &&
        firstInQueryExpression.text.token &&
        firstInQueryExpression.text.token.s
          ? firstInQueryExpression.text.token.s
          : '';
      queryJSON = parsedQuery;
      genericText = IMAPSearchQueryBackend.folderNamesForQuery(parsedQuery);
    } else {
      genericText = searchQuery;
    }
    const tasks = [];
    accountIds.forEach(accountId => {
      const categories = CategoryStore.categories(accountId);
      let firstPath = null;
      if (firstInQueryRole) {
        firstPath = categories.find(categorie => {
          if (categorie.role === firstInQueryRole) {
            return true;
          }
          const names = categorie.name.split(categorie.delimiter) || [];
          return names.some(nameItem => nameItem.toUpperCase() === firstInQueryRole.toUpperCase());
        });
      }
      if (!firstPath) {
        firstPath = this._getDefaultCategoryByAccountId(accountId);
      }

      if (firstPath) {
        tasks.push(
          new IMAPSearchTask({
            accountId,
            fullTextSearch: genericText,
            paths: [firstPath],
            query: queryJSON,
          })
        );
      }
    });
    Actions.remoteSearch(tasks);
  };

  _getDefaultCategoryByAccountId(aid) {
    // if account has `all mail`, use `all mail` as default folder, e.g. gmail
    const allMailCategory = CategoryStore.getAllMailCategory(aid);
    if (allMailCategory && allMailCategory.id) {
      return allMailCategory;
    }
    // if account dont has `all mail`, use `inbox` as default folder, e.g. hotmail
    const inboxCategory = CategoryStore.getCategoryByRole(aid, 'inbox');
    if (inboxCategory && inboxCategory.id) {
      return inboxCategory;
    }
  }

  _createResultAndTrigger() {
    super._createResultAndTrigger();
  }

  _addThreadIdsToSearch(ids = []) {
    const currentResults = this._set && this._set.ids().length > 0;
    let searchIds = ids;
    if (currentResults) {
      const currentResultIds = this._set.ids();
      searchIds = _.uniq(currentResultIds.concat(ids));
    }
    const dbQuery = DatabaseStore.findAll(Thread)
      .where({ id: searchIds, state: 0 })
      .order(Thread.attributes.lastMessageTimestamp.descending());
    this.replaceQuery(dbQuery);
  }

  performRemoteSearch() {
    // TODO: Perform IMAP search here.
    //
    // This is temporarily disabled because we support Gmail's
    // advanced syntax locally (eg: in: inbox, is:unread), and
    // search message bodies, so local search is pretty much
    // good enough for v1. Come back and implement this soon!
    //
  }

  performExtensionSearch() {
    const searchExtensions = ComponentRegistry.findComponentsMatching({
      role: 'SearchBarResults',
    });

    this._extDisposables = searchExtensions.map(ext => {
      return ext.observeThreadIdsForQuery(this._searchQuery).subscribe((ids = []) => {
        const allIds = _.compact(_.flatten(ids));
        if (allIds.length === 0) return;
        this._addThreadIdsToSearch(allIds);
      });
    });
  }

  onLastCallbackRemoved() {
    this._connections.forEach(conn => conn.end());
    this._extDisposables.forEach(disposable => disposable.dispose());
  }
}

export default SearchQuerySubscription;
