import React from 'react';
import { MuteNotificationStore } from 'mailspring-exports';
import { RetinaImg, EditableList, Flexbox } from 'mailspring-component-kit';
import classnames from 'classnames';
import ContactList from './contact-list';
import { AccountStore, Actions } from 'mailspring-exports';
import PreferencesAccountList from './preferences-account-list';

export class PreferencesMutedNotifacations extends React.Component {
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

export class PreferencesAccountNotifacations extends React.Component {
  static displayName = 'PreferencesAccountNotifacations';

  static displayName = 'PreferencesAccounts';

  constructor() {
    super();
    this.state = this.getStateFromStores();
  }

  componentDidMount() {
    this.unsubscribe = AccountStore.listen(this._onAccountsChanged);
  }

  componentWillUnmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  getStateFromStores({ selected } = {}) {
    const accounts = AccountStore.accounts();
    let selectedAccount;
    if (selected) {
      selectedAccount = accounts.find(a => a.id === selected.id);
    }
    // If selected was null or no longer exists in the AccountStore,
    // just use the first account.
    if (!selectedAccount) {
      selectedAccount = accounts[0];
    }
    return {
      accounts,
      selected: selectedAccount,
    };
  }

  _onAccountsChanged = () => {
    this.setState(this.getStateFromStores(this.state));
  };

  _onSelectAccount = account => {
    this.setState({ selected: account });
  };

  _renderAccount = account => {
    const label = account.label;
    // const accountSub = `${account.name || 'No name provided'} <${account.emailAddress}>`;
    const accountSub = `<${account.emailAddress}>`;
    const syncError = account.hasSyncStateError();

    return (
      <div className={classnames({ account: true, 'sync-error': syncError })} key={account.id}>
        <Flexbox direction="row" style={{ alignItems: 'middle' }}>
          <div style={{ textAlign: 'center' }}>
            <RetinaImg
              style={{ width: 40, height: 40 }}
              name={`account-logo-${account.provider}.png`}
              fallback="account-logo-other.png"
              mode={RetinaImg.Mode.ContentPreserve}
            />
          </div>
          <div className="account-item">
            <div className="account-name">{label}</div>
            <div className="account-subtext">
              {accountSub} ({account.displayProvider()})
            </div>
          </div>
        </Flexbox>
      </div>
    );
  };

  render() {
    const { accounts, selected } = this.state;
    return (
      <div className="account-notifacations">
        <EditableList
          className="account-list"
          items={accounts}
          itemContent={this._renderAccount}
          selected={selected}
          onSelectItem={this._onSelectAccount}
        />
        <div className="account-notifacations-config">
          <div className="config-group">
            <h6>{(selected.emailAddress || '').toUpperCase()}</h6>
            <div className="account-notifacations-note">
              Notifications will be sent for all emails for this account.
            </div>
            <div className="checkmark">
              <div className="inner"></div>
              None/Mute
            </div>
            <div className="checkmark">
              <div className="inner"></div>
              All mail
            </div>
            <div className="checkmark">
              <div className="inner"></div>
              Marked as Important
            </div>
            <div className="config-sound">
              <label>
                <input type="checkbox" checked={true} />
                New mail notification sound
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
