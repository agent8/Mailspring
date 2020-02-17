const MailspringStore = require('mailspring-store').default;
const {
  Rx,
  Message,
  OutboxStore,
  AccountStore,
  MutableQueryResultSet,
  MutableQuerySubscription,
  ObservableListDataSource,
  FocusedPerspectiveStore,
  DatabaseStore,
  DraftStore,
} = require('mailspring-exports');
const { ListTabular } = require('mailspring-component-kit');

class DraftListStore extends MailspringStore {
  constructor() {
    super();
    this.listenTo(FocusedPerspectiveStore, this._onPerspectiveChanged);
    this._createListDataSource();
  }

  dataSource = () => {
    return this._dataSource;
  };

  selectionObservable = () => {
    return Rx.Observable.fromListSelection(this);
  };

  // Inbound Events

  _onPerspectiveChanged = () => {
    this._createListDataSource();
  };

  // Internal

  _createListDataSource = () => {
    const mailboxPerspective = FocusedPerspectiveStore.current();

    if (this._dataSource) {
      this._dataSource.cleanup();
      this._dataSource = null;
    }

    if (mailboxPerspective.drafts) {
      const query = DraftStore.findAllWithBodyInDescendingOrder().page(0, 1);
      // const query = DatabaseStore.findAll(Message)
      //   .include(Message.attributes.body)
      //   .order(Message.attributes.date.descending())
      //   .where([Message.attributes.syncState.in(['0', '2'])])
      //   .where({ draft: true})
      //   .page(0, 1);

      // Adding a "account_id IN (a,b,c)" clause to our query can result in a full
      // table scan. Don't add the where clause if we know we want results from all.
      if (mailboxPerspective.accountIds.length < AccountStore.accounts().length) {
        query.where({ accountId: mailboxPerspective.accountIds });
      }
      if (mailboxPerspective.accountIds.length === 1) {
        query.where({ accountId: mailboxPerspective.accountIds[0] });
      }

      const subscription = new MutableQuerySubscription(query, { emitResultSet: true });
      let $resultSet = Rx.Observable.fromNamedQuerySubscription('draft-list', subscription);
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
    } else {
      this._dataSource = new ListTabular.DataSource.Empty();
    }

    this.trigger(this);
  };
}

module.exports = new DraftListStore();