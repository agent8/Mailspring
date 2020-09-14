const _ = require('underscore');
const classNames = require('classnames');
const {
  React,
  PropTypes,
  Actions,
  ChangeLabelsTask,
  CategoryStore,
  FocusedPerspectiveStore,
  AccountStore,
  Utils,
} = require('mailspring-exports');

const ShowImportantKey = 'core.workspace.showImportant';

class MailImportantIcon extends React.Component {
  static displayName = 'MailImportantIcon';
  static propTypes = {
    thread: PropTypes.object,
    showIfAvailableForAnyAccount: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = this.getState();
  }

  getState = (props = this.props) => {
    let category = null;
    let visible = false;

    if (props.showIfAvailableForAnyAccount) {
      const perspective = FocusedPerspectiveStore.current();
      for (let accountId of perspective.accountIds) {
        const account = AccountStore.accountForId(accountId);
        const accountImportant = CategoryStore.getCategoryByRole(account, 'important');
        if (accountImportant && !account.isOnmail()) {
          visible = true;
        }
        if (accountId === props.thread.accountId) {
          category = accountImportant;
        }
        if (visible && category) {
          break;
        }
      }
    } else {
      category = CategoryStore.getCategoryByRole(props.thread.accountId, 'important');
      const account = AccountStore.accountForId(props.thread.accountId);
      visible = category != null && account && !account.isOnmail();
    }

    const isImportant = category && _.findWhere(props.thread.labels, { id: category.id }) != null;

    return { visible, category, isImportant };
  };

  componentDidMount() {
    this.unsubscribe = FocusedPerspectiveStore.listen(() => {
      this.setState(this.getState());
    });
    this.subscription = AppEnv.config.onDidChange(ShowImportantKey, () => {
      this.setState(this.getState());
    });
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.setState(this.getState(nextProps));
  }

  componentWillUnmount() {
    if (typeof this.unsubscribe === 'function') {
      this.unsubscribe();
    }
    if (this.subscription) {
      this.subscription.dispose();
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !_.isEqual(nextState, this.state);
  }

  render() {
    let title;
    if (!this.state.visible) {
      return <span> </span>;
    }
    const importClassName = Utils.iconClassName('important.svg');
    const classNameObj = {
      'mail-important-icon': true,
      enabled: this.state.category != null,
      active: this.state.isImportant,
    };
    classNameObj[importClassName] = true;
    const classes = classNames(classNameObj);

    if (!this.state.category) {
      title = 'No important folder / label';
    } else if (this.state.isImportant) {
      title = 'Mark as unimportant';
    } else {
      title = 'Mark as important';
    }

    return <div className={classes} title={title} onClick={this._onToggleImportant} />;
  }

  _onToggleImportant = event => {
    const { category } = this.state;

    if (category) {
      const isImportant = _.findWhere(this.props.thread.labels, { id: category.id }) != null;

      if (!isImportant) {
        Actions.queueTask(
          new ChangeLabelsTask({
            labelsToAdd: [category],
            labelsToRemove: [],
            threads: [this.props.thread],
            source: 'Important Icon',
          })
        );
      } else {
        Actions.queueTask(
          new ChangeLabelsTask({
            labelsToAdd: [],
            labelsToRemove: [category],
            threads: [this.props.thread],
            source: 'Important Icon',
          })
        );
      }
    }

    // Don't trigger the thread row click
    event.stopPropagation();
  };
}

module.exports = MailImportantIcon;
