import React from 'react';
import { MuteNotifacationsStore } from 'mailspring-exports';
import { RetinaImg } from 'mailspring-component-kit';
import ContactList from './contact-list';

class MutedNotifacations extends React.Component {
  static displayName = 'PreferencesMutedNotifacations';

  constructor() {
    super();
    this.state = {
      mutes: [],
      showAddContext: false,
    };
  }

  componentDidMount() {
    this.unsubscribe = MuteNotifacationsStore.listen(this._onMutedChanged);
    MuteNotifacationsStore.syncMuteNotifacations();
    const mutes = this._getStateFromStores();
    this.setState({ mutes: mutes });
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  _getStateFromStores() {
    const mutes = MuteNotifacationsStore.getMuteNotifacations();
    return mutes;
  }

  _onMutedChanged = () => {
    const mutes = this._getStateFromStores();
    this.setState({ mutes });
  };

  _onMuteContext = email => {
    this.setState({ showAddContext: false });
    MuteNotifacationsStore.muteNotifacationEmails([email]);
  };

  _unmuteSelect = select => {
    const emails = typeof select === 'string' ? [select] : select;
    MuteNotifacationsStore.unMuteNotifacationEmails(emails);
  };

  render() {
    const { mutes, showAddContext } = this.state;
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
            onClick={() => this.setState({ showAddContext: true })}
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
          showAddContext={showAddContext}
          onAddContext={this._onMuteContext}
          checkmarkNote={'muted senders'}
          handleName={'Unmute'}
          handleSelect={this._unmuteSelect}
        />
      </div>
    );
  }
}

export default MutedNotifacations;
