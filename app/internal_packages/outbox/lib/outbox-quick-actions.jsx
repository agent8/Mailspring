import React from 'react';
import { PropTypes, Message } from 'mailspring-exports';
import {
  OutboxEditQuickAction,
  OutboxResendQuickAction,
  OutboxTrashQuickAction,
} from './outbox-list-quick-actions';
const failingElapsedTimeout = AppEnv.config.get('core.outbox.failingUnlockInMs');
const KEY = 'core.quickActions.enabled';

export default class OutboxQuickActions extends React.Component {
  static propTypes = {
    layout: PropTypes.string,
    draft: PropTypes.object,
  };
  static displayName = 'OutboxQuickActions';
  constructor(props) {
    super(props);
    this.state = {
      quickActionsEnabled: AppEnv.config.get(KEY),
    };
    this._mounted = false;
  }
  componentDidMount() {
    this._mounted = true;
    this.disposable = AppEnv.config.onDidChange(KEY, () => {
      if (this._mounted) {
        this.setState({
          quickActionsEnabled: AppEnv.config.get(KEY),
        });
      }
    });
  }
  componentWillUnmount() {
    this.disposable.dispose();
  }
  renderActions(actions) {
    if (actions.length) {
      return <div className="thread-injected-quick-actions">{actions}</div>;
    }
  }
  renderWideLayout(actions) {
    return <div className="inner">{this.renderActions(actions)}</div>;
  }
  renderNarrowLayout(actions) {
    return (
      <div className="list-column-HoverActions">
        <div className="inner quick-actions">{this.renderActions(actions)}</div>
      </div>
    );
  }
  render() {
    const { draft } = this.props;
    if (!this.state.quickActionsEnabled) {
      return null;
    }
    const actions = [];
    if (Message.compareMessageState(draft.syncState, Message.messageSyncState.failed)) {
      actions.unshift(<OutboxTrashQuickAction draft={draft} key="outbox-trash-quick-action" />);
      actions.unshift(<OutboxEditQuickAction draft={draft} key="outbox-edit-quick-action" />);
      actions.unshift(<OutboxResendQuickAction draft={draft} key="outbox-resend-quick-action" />);
    } else if (Message.compareMessageState(draft.syncState, Message.messageSyncState.failing)) {
      const timeLapsed = draft.lastUpdateTimestamp
        ? Date.now() - draft.lastUpdateTimestamp.getTime()
        : 0;
      if (timeLapsed > failingElapsedTimeout) {
        actions.unshift(<OutboxTrashQuickAction draft={draft} key="outbox-trash-quick-action" />);
      }
    }
    if ((this.props.layout || '').toLocaleLowerCase() === 'narrow') {
      return this.renderNarrowLayout(actions);
    } else {
      return this.renderWideLayout(actions);
    }
  }
}
