import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { AccountStore, ContactStore, Actions, SignatureStore } from 'mailspring-exports';
import { Menu, ButtonDropdown, InjectedComponentSet } from 'mailspring-component-kit';
import { applySignature } from '../../composer-signature/lib/signature-utils';

export default class AccountContactField extends React.Component {
  static displayName = 'AccountContactField';

  static propTypes = {
    value: PropTypes.object,
    accounts: PropTypes.array,
    session: PropTypes.object.isRequired,
    draft: PropTypes.object.isRequired,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
  };

  _onChooseContact = async contact => {
    const { draft, session, onChange } = this.props;
    // const { autoaddress } = AccountStore.accountForEmail(contact.email);

    // const existing = [].concat(draft.to, draft.cc, draft.bcc).map(c => c.email);
    // let autocontacts = await ContactStore.parseContactsInString(autoaddress.value);
    // autocontacts = autocontacts.filter(c => !existing.includes(c.email));

    this._dropdownComponent.toggleDropdown();
    const from = [contact];
    const cc = [].concat(draft.cc);
    const bcc = [].concat(draft.bcc);
    onChange({
      from: from,
      cc: cc,
      bcc: bcc,
    });
    // session.ensureCorrectAccount();
    this._changeSignature(contact);
    const changeDraftData = {
      originalHeaderMessageId: draft.headerMessageId,
      originalMessageId: draft.id,
      newParticipants: { from, cc, bcc },
    };
    Actions.changeDraftAccount(changeDraftData);
  };

  _changeSignature = account => {
    const { draft, session } = this.props;
    let sig = SignatureStore.signatureForEmail(account.email);
    let body;
    if (sig) {
      body = applySignature(draft.body, sig);
    } else {
      body = applySignature(draft.body, null);
    }
    session.changes.add({ body });
  };

  _renderDefalutAccount() {
    if (this.props.draft && this.props.draft.accountId) {
      const account = AccountStore.accountForId(this.props.draft.accountId);
      if (account) {
        console.log('account label', account.label);
        return this._renderAccountSpan(account.label);
      }
    }
    return <span />;
  }

  _renderAccountSelector() {
    if (!this.props.value) {
      return this._renderDefalutAccount();
    }

    const label = this.props.value.toString();
    const multipleAccounts = this.props.accounts.length > 1;
    const hasAliases = this.props.accounts[0] && this.props.accounts[0].aliases.length > 0;

    if (multipleAccounts || hasAliases) {
      return (
        <ButtonDropdown
          ref={cm => {
            this._dropdownComponent = cm;
          }}
          bordered={false}
          primaryItem={<span>{label}</span>}
          menu={this._renderAccounts(this.props.accounts)}
          disabled={this.props.disabled}
        />
      );
    }
    return this._renderAccountSpan(label);
  }

  _renderAccountSpan = label => {
    return (
      <span className="from-single-name" style={{ position: 'relative', top: 11, left: '0.5em' }}>
        {label}
      </span>
    );
  };

  _renderMenuItem = contact => {
    const className = classnames({
      contact: true,
      'is-alias': contact.isAlias,
    });
    return <span className={className}>{contact.toString()}</span>;
  };

  _renderAccounts(accounts) {
    const items = AccountStore.aliasesFor(accounts);
    return (
      <Menu
        items={items}
        itemKey={contact => contact.id}
        itemContent={this._renderMenuItem}
        onSelect={this._onChooseContact}
      />
    );
  }

  _renderFromFieldComponents = () => {
    const { draft, session, accounts } = this.props;
    return (
      <InjectedComponentSet
        deferred
        className="dropdown-component"
        matching={{ role: 'Composer:FromFieldComponents' }}
        exposedProps={{
          draft,
          session,
          accounts,
          draftFromEmail: (draft.from[0] || {}).email,
        }}
      />
    );
  };

  render() {
    return (
      <div className="composer-participant-field from-field">
        <div className="composer-field-label">FROM</div>
        {this._renderAccountSelector()}
        {this._renderFromFieldComponents()}
      </div>
    );
  }
}