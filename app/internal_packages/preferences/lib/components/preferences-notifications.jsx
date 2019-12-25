import React from 'react';
import ContactList from './contact-list';

class MutedNotif extends React.Component {
  static displayName = 'PreferencesMutedNotif';

  constructor() {
    super();
    this.state = {
      contacts: [],
    };
  }

  _unmuteSelect = select => {
    const emails = typeof select === 'string' ? [select] : select;
    // to do
    console.log('^^^^^^^^^^^^^^^^');
    console.log(emails);
    console.log('^^^^^^^^^^^^^^^^');
  };

  render() {
    const { contacts } = this.state;
    return (
      <div className="container-mute">
        <div className="config-group">
          <h6>MUTED NOTIFICATIONS</h6>
          <div className="mute-note">
            Contacts you have muted will appear here. You will not receive notifications for mail
            from these senders.
          </div>
        </div>
        <ContactList
          contacts={contacts}
          checkmarkNote={'muted senders'}
          handleName={'Unmute'}
          handleSelect={this._unmuteSelect}
        />
      </div>
    );
  }
}

export default MutedNotif;
