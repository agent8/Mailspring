import React from 'react';
import { PropTypes } from 'mailspring-exports';
import {
  ThreadUnreadQuickAction,
  ThreadStarQuickAction,
  ThreadArchiveQuickAction,
  ThreadTrashQuickAction,
  ThreadSpamQuickAction,
  ThreadMoveQuickAction,
} from './thread-list-quick-actions';
import { FocusedPerspectiveStore } from 'mailspring-exports';

const KEY = 'core.quickActions';

export default class QuickActions extends React.Component {
  static propTypes = { thread: PropTypes.object };
  constructor(props) {
    super(props);
    this.state = {
      quickActions: AppEnv.config.get(KEY),
    };
  }
  componentDidMount() {
    this.disposable = AppEnv.config.onDidChange(KEY, () =>
      this.setState({
        quickActions: AppEnv.config.get(KEY),
      })
    );
  }
  componentWillUnmount() {
    this.disposable.dispose();
  }
  getActionButton(index, thread) {
    const { quickActions } = this.state;
    const action = quickActions[`quickAction${index}`];
    switch (action) {
      case 'read':
        return <ThreadUnreadQuickAction key={index} thread={thread} />;
      case 'flag':
        return <ThreadStarQuickAction key={index} thread={thread} />;
      case 'trash':
        return <ThreadTrashQuickAction key={index} thread={thread} />;
      case 'spam':
        return <ThreadSpamQuickAction key={index} thread={thread} />;
      case 'archive':
        return <ThreadArchiveQuickAction key={index} thread={thread} />;
      case 'folder':
        return (
          <ThreadMoveQuickAction
            key={index}
            items={[thread]}
            currentPerspective={FocusedPerspectiveStore.current()}
          />
        );
    }
    return null;
  }
  render() {
    const { quickActions } = this.state;
    const { thread } = this.props;
    const hasQuickActions = quickActions.enabled;
    const actions = [];

    if (hasQuickActions) {
      for (let i = 1; i <= 4; i++) {
        const action = this.getActionButton(i, thread);
        if (action) {
          actions.push(action);
        }
      }
    }
    if (actions.length) {
      return <div className="thread-injected-quick-actions">{actions}</div>;
    }
    return null;
  }
}
