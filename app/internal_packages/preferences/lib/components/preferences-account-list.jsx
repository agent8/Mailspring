import React, { Component } from 'react';
import { RetinaImg, Flexbox, EditableList } from 'mailspring-component-kit';
import classnames from 'classnames';
import PropTypes from 'prop-types';

class PreferencesAccountList extends Component {
  static propTypes = {
    accounts: PropTypes.array,
    selected: PropTypes.object,
    onAddAccount: PropTypes.func.isRequired,
    onReorderAccount: PropTypes.func.isRequired,
    onSelectAccount: PropTypes.func.isRequired,
    onRemoveAccount: PropTypes.func.isRequired,
  };

  _renderAccountStateIcon(account) {
    if (account.syncState !== 'running') {
      return (
        <div className="sync-error-icon">
          <RetinaImg
            className="sync-error-icon"
            name="ic-settings-account-error.png"
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </div>
      );
    }
    return null;
  }

  _renderAccount = account => {
    const label = account.label;
    // const accountSub = `${account.name || 'No name provided'} <${account.emailAddress}>`;
    const accountSub = `${account.emailAddress}`;
    const syncError = account.hasSyncStateError();

    return (
      <div className={classnames({ account: true, 'sync-error': syncError })} key={account.id}>
        <Flexbox direction="row" style={{ alignItems: 'middle' }}>
          <div className="account-picture">
            <RetinaImg
              url={account.picture}
              name={`account-logo-${account.provider}.png`}
              fallback="account-logo-other.png"
              mode={RetinaImg.Mode.ContentPreserve}
            />
          </div>
          <div className="account-item">
            <div className="account-name">{label}</div>
            <div className="account-subtext">{accountSub}</div>
          </div>
        </Flexbox>
      </div>
    );
  };

  render() {
    if (!this.props.accounts) {
      return <div className="account-list" />;
    }

    const footer = (
      <div className="btn-primary buttons-add" onClick={this.props.onAddAccount}>
        <RetinaImg
          name={`add.svg`}
          style={{ width: 19, height: 19, fontSize: 19 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
        Add Account
      </div>
    );
    return (
      <EditableList
        className="account-list"
        showDelIcon
        showFooter
        getConfirmMessage={account => ({
          message: 'Are you sure?',
          detail: `Delete this account ${account.emailAddress}`,
        })}
        items={this.props.accounts}
        itemContent={this._renderAccount}
        selected={this.props.selected}
        onReorderItem={this.props.onReorderAccount}
        onCreateItem={this.props.onAddAccount}
        onSelectItem={this.props.onSelectAccount}
        onDeleteItem={this.props.onRemoveAccount}
        footer={footer}
      />
    );
  }
}

export default PreferencesAccountList;
