import React from 'react';
import { PropTypes } from 'mailspring-exports';
import {
  SiftStarQuickAction,
  SiftTrashQuickAction,
  SiftUnreadQuickAction,
} from './sift-list-quick-actions';

const KEY = 'core.quickActions.enabled';

export default class SiftQuickActions extends React.Component {
  static propTypes = {
    layout: PropTypes.string,
    message: PropTypes.object,
  };
  static displayName = 'SiftQuickActions';
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
    const { message } = this.props;
    if (!this.state.quickActionsEnabled) {
      return null;
    }
    const actions = [
      <SiftTrashQuickAction message={message} key="sift-trash-quick-action" />,
      <SiftStarQuickAction message={message} key="sift-star-quick-action" />,
      <SiftUnreadQuickAction message={message} key="sift-unread-quick-action" />,
    ];
    if ((this.props.layout || '').toLocaleLowerCase() === 'narrow') {
      return this.renderNarrowLayout(actions);
    } else {
      return this.renderWideLayout(actions);
    }
  }
}
