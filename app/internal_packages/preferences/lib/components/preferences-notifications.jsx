import React from 'react';
import { MuteNotificationStore } from 'mailspring-exports';
import { RetinaImg } from 'mailspring-component-kit';
import ContactList from './contact-list';

class MutedNotifacations extends React.Component {
  static displayName = 'PreferencesMutedNotifacations';

  constructor() {
    super();
    this.state = {
      mutes: [],
      showAddContact: false,
    };
  }

  componentDidMount() {
    this.unsubscribe = MuteNotificationStore.listen(this._onMutedChanged);
    MuteNotificationStore.syncMuteNotifacations();
    const mutes = this._getStateFromStores();
    this.setState({ mutes: mutes });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  _getStateFromStores() {
    const mutes = MuteNotificationStore.getMuteNotifacations();
    return mutes;
  }

  _onMutedChanged = () => {
    const mutes = this._getStateFromStores();
    this.setState({ mutes });
  };

  _onMuteContact = email => {
    this.setState({ showAddContact: false });
    if (email) {
      MuteNotificationStore.muteNotifacationEmails([email]);
    }
  };

  _unmuteSelect = select => {
    const emails = typeof select === 'string' ? [select] : select;
    MuteNotificationStore.unMuteNotifacationEmails(emails);
  };

  render() {
    const { mutes, showAddContact } = this.state;
    return (
      <div className="container-mute">
        <div className="config-group">
          <h6>MUTED NOTIFICATIONS</h6>
          <div className="mute-note">
            Contacts you have muted will appear here. You will not receive notifications for mail
            from these senders.
          </div>
          <div
            className="btn-primary buttons-add"
            onClick={() => this.setState({ showAddContact: true })}
          >
            <RetinaImg
              name={`add.svg`}
              style={{ width: 19, height: 19 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
            />
            Mute Sender
          </div>
        </div>
        <ContactList
          contacts={mutes}
          showAddContact={showAddContact}
          onAddContact={this._onMuteContact}
          checkmarkNote={'muted senders'}
          handleName={'Unmute'}
          handleSelect={this._unmuteSelect}
        />
      </div>
    );
  }
}

export default MutedNotifacations;
