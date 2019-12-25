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

  // componentDidMount() {
  //   this.setState({
  //     contacts: [
  //       {
  //         id: 'fbe7bcaf-160e-42c8-8543-e7d2ea36deba',
  //         accountId: '3a812d81',
  //         email: 'yn_chn@163.com',
  //         name: '',
  //         state: 2,
  //       },
  //       {
  //         id: '7c3f9afb-9070-4453-aaff-7c36e3d338d8',
  //         accountId: '3a812d81',
  //         email: 'notifications@github.com',
  //         name: '',
  //         state: 2,
  //       },
  //     ],
  //   });
  // }

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
