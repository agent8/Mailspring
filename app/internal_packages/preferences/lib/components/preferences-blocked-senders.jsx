import React from 'react';
import { BlockedSendersStore } from 'mailspring-exports';
import ContactList from './contact-list';

class BlockedSenders extends React.Component {
  static displayName = 'PreferencesBlockedSenders';

  constructor() {
    super();
    this.state = {
      blockeds: [],
    };
  }

  componentDidMount() {
    this.unsubscribe = BlockedSendersStore.listen(this._onBlockedChanged);
    BlockedSendersStore.syncBlockedSenders();
    const blockeds = this._getStateFromStores();
    this.setState({ blockeds: blockeds });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  _getStateFromStores() {
    const blockeds = BlockedSendersStore.getBlockedSenders();
    return blockeds;
  }

  _onBlockedChanged = () => {
    const blockeds = this._getStateFromStores();
    this.setState({ blockeds });
  };

  _unBlockSelect = select => {
    const emails = typeof select === 'string' ? [select] : select;
    BlockedSendersStore.unBlockEmails(emails);
  };

  render() {
    const { blockeds } = this.state;

    return (
      <div className="container-blocked">
        <div className="config-group">
          <h6>BLOCKED SENDERS</h6>
          <div className="blocked-note">
            Contacts you have blocked in your email will appear here. To unblock them, remove their
            name from this list.
          </div>
        </div>
        <ContactList
          contacts={blockeds}
          checkmarkNote={'blocked senders'}
          handleName={'Unblock'}
          handleSelect={this._unBlockSelect}
        />
      </div>
    );
  }
}

export default BlockedSenders;
