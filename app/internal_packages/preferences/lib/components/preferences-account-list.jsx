import React, { Component } from 'react';
import { RetinaImg, Flexbox, EditableList } from 'mailspring-component-kit';
import { Actions, DraftStore, AccountStore } from 'mailspring-exports';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import { remote } from 'electron';
import fs from 'fs';
import path from 'path';
const { Menu, MenuItem } = remote;

class PreferencesAccountList extends Component {
  static propTypes = {
    accounts: PropTypes.array,
    selected: PropTypes.object,
    onAddAccount: PropTypes.func.isRequired,
    onReorderAccount: PropTypes.func,
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

  _showPopupMenu(account) {
    let menu = new Menu();
    let menuItem;
    menuItem = new MenuItem({
      label: 'Change profile image',
      click: () => {
        AppEnv.showOpenDialog(
          {
            title: 'Choose an image',
            buttonLabel: 'Choose',
            properties: ['openFile'],
            filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] }],
          },
          paths => {
            if (paths && paths.length > 0) {
              let fromPath = paths[0];
              const destPath = path.join(
                AppEnv.getConfigDirPath(),
                'logo_cache',
                `${account.emailAddress}_${Date.now()}${path.extname(fromPath)}`
              );
              try {
                fs.copyFileSync(fromPath, destPath);
                account.picture = destPath;
              } catch (err) {
                console.error(err);
                account.picture = fromPath;
              }
              Actions.updateAccount(account.id, account);
            }
          }
        );
      },
    });
    menu.append(menuItem);
    Actions.closeContextMenu();
    menu.popup();
  }

  _renderAccount = account => {
    const label = account.label;
    // const accountSub = `${account.name || 'No name provided'} <${account.emailAddress}>`;
    const accountSub = `${account.emailAddress}`;
    const syncError = account.hasSyncStateError();

    return (
      <div
        onContextMenu={() => this._showPopupMenu(account)}
        className={classnames({ account: true, 'sync-error': syncError })}
        key={account.id}
      >
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
            <div className="account-name" title={label}>
              {label}
            </div>
            <div className="account-subtext" title={accountSub}>
              {accountSub}
            </div>
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
        getConfirmMessage={account => {
          const syncAccount = AccountStore.syncAccount();
          if (syncAccount && syncAccount.id === account.id) {
            return {
              message: 'Warning',
              detail:
                'You use this account to sync preferences across all your devices. If you remove it, your saved preferences will be lost, and can not be recovered. Are you sure you want to delete your account?',
            };
          }
          const drafts = DraftStore.findDraftsByAccountId(account.id);
          let detail = `Do you want to delete this account ${account.emailAddress}?`;
          if (drafts.length > 0) {
            detail = `There ${drafts.length > 1 ? 'are' : 'is'} ${drafts.length} draft${
              drafts.length > 1 ? 's' : ''
            } for this account that is currently open. Do you want to delete account ${
              account.emailAddress
            }?`;
          }
          return { message: 'Are you sure?', detail };
        }}
        items={this.props.accounts}
        itemContent={this._renderAccount}
        selected={this.props.selected}
        onCreateItem={this.props.onAddAccount}
        onSelectItem={this.props.onSelectAccount}
        onDeleteItem={this.props.onRemoveAccount}
        footer={footer}
      />
    );
  }
}

export default PreferencesAccountList;
