import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ConversationList from './ConversationList';
import ConversationsTopBar from './ConversationsTopBar';
import ProgressBar from '../common/ProgressBar';
import FailAlert from '../common/FailAlert';
import { ProgressBarStore, FailMessageStore } from 'chat-exports';

export default class ConversationsPanel extends PureComponent {
  static propTypes = {
    referenceTime: PropTypes.number,
  };

  static defaultProps = {
    referenceTime: new Date().getTime(),
  };

  state = { progress: {} };

  componentDidMount() {
    this.unsubscribers = [];
    this.unsubscribers.push(ProgressBarStore.listen(this.onProgressChange));
    this.unsubscribers.push(FailMessageStore.listen(this.onFailMessageChange));
  }

  componentWillUnmount() {
    return this.unsubscribers.map(unsubscribe => unsubscribe());
  }

  onProgressChange = () => {
    let { progress, props } = ProgressBarStore;
    progress = Object.assign({}, progress);
    const state = Object.assign({}, this.state, { progress }, props);
    this.setState(state);
  };

  onFailMessageChange = () => {
    let { msg, visible } = FailMessageStore;
    this.setState({ msg, alertVisible: visible });
  };

  render() {
    const { referenceTime } = this.props;

    const conversationsProps = {
      referenceTime,
    };
    const { progress, onCancel, onRetry, msg, alertVisible } = this.state;

    return (
      <div className="panel">
        <ConversationsTopBar />
        <ConversationList {...conversationsProps} />
        <ProgressBar progress={progress} onCancel={onCancel} onRetry={onRetry} />
        <FailAlert msg={msg} visible={alertVisible} />
      </div>
    );
  }
}
