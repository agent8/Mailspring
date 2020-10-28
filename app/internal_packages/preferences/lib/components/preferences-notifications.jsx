import React from 'react';
import {
  MuteNotificationStore,
  Actions,
  EmailAvatar,
  AccountStore,
  Account,
  RegExpUtils,
} from 'mailspring-exports';
import { RetinaImg, EditableList, Flexbox, FullScreenModal } from 'mailspring-component-kit';
import classnames from 'classnames';
import ContactList from './contact-list';
import ContactSearch from './contact-search';

class CoutactSelectShow extends React.Component {
  static displayName = 'CoutactSelectShow';
  constructor() {
    super();
    this.state = {};
  }

  componentDidMount() {
    this._fieldElFocus();
  }

  _fieldElFocus() {
    if (this._input) {
      this._input.focus();
    }
  }

  _inputOnKeyDown = e => {
    if (e.keyCode === 8) {
      this.props.delSelectContact();
    }
  };

  render() {
    const { contact } = this.props;
    return (
      <div className="contact-select-show nylas-input-search" onClick={() => this._fieldElFocus()}>
        <RetinaImg
          isIcon
          name="search.svg"
          className="search-accessory search"
          mode={RetinaImg.Mode.ContentIsMask}
          style={{ height: 20, width: 20 }}
        />
        <div className="cover-contact">
          <div className="contact-item">
            <EmailAvatar
              key="email-avatar"
              account={{ name: contact.name, email: contact.email }}
            />
            {contact.name ? <span className="contact-name">{contact.name}</span> : null}
            <span className="contact-email">{contact.email}</span>
          </div>
          <input
            ref={el => (this._input = el)}
            onKeyDown={this._inputOnKeyDown}
            value=""
            onChange={() => {}}
          />
        </div>
      </div>
    );
  }
}

export class PreferencesMutedNotifacations extends React.Component {
  static displayName = 'PreferencesMutedNotifacations';

  constructor() {
    super();
    this.state = {
      mutes: [],
      showAddContact: false,
      selectContact: null,
      muteInputValue: '',
      inputIsValid: false,
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

  _onSelectContact = contact => {
    if (contact) {
      this.setState({ selectContact: contact });
    }
  };

  _onDelSelectContact = () => {
    this.setState({ selectContact: null });
  };

  _onMuteContact = () => {
    const { selectContact, muteInputValue, inputIsValid } = this.state;
    let muteEmail = '';
    if (selectContact) {
      muteEmail = selectContact.email;
    } else if (muteInputValue && inputIsValid) {
      muteEmail = muteInputValue;
    }

    if (muteEmail) {
      MuteNotificationStore.muteNotifacationEmails([muteEmail]);
      this._onToggleMutePopup();
    }
  };

  _unmuteSelect = select => {
    const emails = typeof select === 'string' ? [select] : select;
    MuteNotificationStore.unMuteNotifacationEmails(emails);
  };

  _onToggleMutePopup = () => {
    this.setState({ showAddContact: !this.state.showAddContact, selectContact: null });
  };

  _onInputChange = value => {
    const isValidDomain = RegExpUtils.domainRegex(true).test(value);
    const isValidEmail = RegExpUtils.emailRegex().test(value);
    this.setState({ muteInputValue: value, inputIsValid: isValidDomain || isValidEmail });
  };

  _renderMuteContactPop = () => {
    const { mutes, selectContact, inputIsValid } = this.state;
    return (
      <div className="add-mute-contact-popup">
        <RetinaImg
          isIcon
          className="close-icon"
          style={{ width: 20, height: 20 }}
          name="close.svg"
          mode={RetinaImg.Mode.ContentIsMask}
          onClick={this._onToggleMutePopup}
        />
        <h1>Who do you want to mute?</h1>
        <p>You won't receive notifications from this sender.</p>
        {selectContact ? (
          <CoutactSelectShow contact={selectContact} delSelectContact={this._onDelSelectContact} />
        ) : (
          <ContactSearch
            filterContacts={mutes}
            onSelectContact={this._onSelectContact}
            onChange={this._onInputChange}
          />
        )}
        <div className="btn-group">
          <button onClick={this._onToggleMutePopup}>Cancel</button>
          <button
            className={classnames({
              confirm: true,
              disable: !selectContact && !inputIsValid,
            })}
            onClick={() => {
              this._onMuteContact();
            }}
          >
            Mute
          </button>
        </div>
      </div>
    );
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
          <div className="btn-primary buttons-add" onClick={this._onToggleMutePopup}>
            <RetinaImg
              name={`add.svg`}
              style={{ width: 19, height: 19, fontSize: 19 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
            />
            Mute Sender
          </div>
        </div>
        <ContactList
          contacts={mutes}
          checkmarkNote={'muted senders'}
          handleName={'Unmute'}
          handleSelect={this._unmuteSelect}
        />
        <FullScreenModal
          visible={showAddContact}
          onCancel={this._onCloseExportDataModal}
          className="add-mute-contact"
        >
          {this._renderMuteContactPop()}
        </FullScreenModal>
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

  _onAccountUpdated = (accountId, updates) => {
    Actions.updateAccount(accountId, updates);
  };

  _onChangeNoticeType = typeId => {
    const { selected } = this.state;
    const { id, notifacation } = selected;
    const updateAccount = {
      ...selected,
      notifacation: {
        ...notifacation,
        noticeType: typeId,
      },
    };
    this._onAccountUpdated(id, updateAccount);
  };
  _onChangeNoticeSound = () => {
    const { selected } = this.state;
    const { id, notifacation } = selected;
    const updateAccount = {
      ...selected,
      notifacation: {
        ...notifacation,
        sound: !notifacation.sound,
      },
    };
    this._onAccountUpdated(id, updateAccount);
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
              style={{ width: 40, height: 40, borderRadius: '50%' }}
              url={account.picture}
              name={`account-logo-${account.provider}.png`}
              fallback="account-logo-other.png"
              mode={RetinaImg.Mode.ContentPreserve}
            />
          </div>
          <div className="account-item">
            <div className="account-name" title={label}>
              {label}
            </div>
            <div className="account-subtext" title={`${accountSub}(${account.displayProvider()})`}>
              {accountSub} ({account.displayProvider()})
            </div>
          </div>
        </Flexbox>
      </div>
    );
  };

  render() {
    const { accounts, selected } = this.state;
    const { noticeType, sound } = selected.notifacation;
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
              {noticeType === 'None'
                ? 'Notifications are disabled for this account.'
                : `Notifications will be sent for ${noticeType.toLocaleLowerCase()} emails for this account.`}
            </div>
            {selected.getNoticeTypeEnum().map(item => {
              return (
                <div className="checkmark" key={item.type}>
                  <label>
                    <input
                      type="radio"
                      checked={noticeType === item.type}
                      onChange={() => {
                        this._onChangeNoticeType(item.type);
                      }}
                    />
                    {item.title}
                  </label>
                </div>
              );
            })}
            <div className="config-sound">
              <label>
                <input type="checkbox" checked={sound} onChange={this._onChangeNoticeSound} />
                New mail notification sound
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
