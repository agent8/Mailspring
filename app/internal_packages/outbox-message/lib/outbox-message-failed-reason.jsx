import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Message } from 'mailspring-exports';

export default class OutboxMessageFailedReason extends Component {
  static displayName = 'OutboxMessageFailedReason';
  static propTypes = {
    message: PropTypes.object,
  };
  static defaultProps = {
    message: null,
  };

  constructor(props) {
    super(props);
    this._mounted = false;
  }

  componentDidMount() {
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  render() {
    if (!this.props.message) {
      return null;
    }
    if (!this.props.message.draft) {
      return null;
    }
    if (
      !Message.compareMessageState(this.props.message.syncState, Message.messageSyncState.failed)
    ) {
      return null;
    }
    return (
      <div className="outbox-message-failed-reason">{this.props.message.draftFailedReason}</div>
    );
  }
}
