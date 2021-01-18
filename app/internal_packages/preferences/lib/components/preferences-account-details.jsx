/* eslint global-require: 0 */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ipcRenderer, remote } from 'electron';
import {
  DraftStore,
  RegExpUtils,
  KeyManager,
  Account,
  Utils,
  AccountStore,
  TaskFactory,
  Actions,
} from 'mailspring-exports';
import { EditableList, RetinaImg } from 'mailspring-component-kit';
import PreferencesCategory from './preferences-category';
import { UpdateMailSyncSettings } from '../preferences-utils';

class AutoaddressControl extends Component {
  static propTypes = {
    autoaddress: PropTypes.object,
    onChange: PropTypes.func,
    onSaveChanges: PropTypes.func,
  };
  render() {
    const { autoaddress, onChange, onSaveChanges } = this.props;

    return (
      <div>
        <div className="item">
          <label>When composing, automatically</label>
          <div className="button-dropdown">
            <select
              className="auto-cc-bcc"
              value={autoaddress.type}
              onChange={e => onChange(Object.assign({}, autoaddress, { type: e.target.value }))}
              onBlur={onSaveChanges}
            >
              <option value="cc">CC</option>
              <option value="bcc">BCC</option>
            </select>
            <RetinaImg
              name={'arrow-dropdown.svg'}
              isIcon
              style={{
                width: 24,
                height: 24,
                fontSize: 20,
                lineHeight: '24px',
                verticalAlign: 'middle',
              }}
              mode={RetinaImg.Mode.ContentIsMask}
            />
          </div>
          &nbsp;&nbsp;:
        </div>
        <div className="item">
          <input
            type="text"
            value={autoaddress.value}
            onChange={e => onChange(Object.assign({}, autoaddress, { value: e.target.value }))}
            onBlur={onSaveChanges}
            placeholder="Comma-separated email addresses"
          />
        </div>
      </div>
    );
  }
}
class PreferencesAccountDetails extends Component {
  static propTypes = {
    account: PropTypes.object,
    accounts: PropTypes.array,
    onAccountUpdated: PropTypes.func.isRequired,
    onRemoveAccount: PropTypes.func,
    onSelectAccount: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = { account: props.account.clone() };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.setState({ account: nextProps.account.clone() });
  }

  componentWillUnmount() {
    this._saveChanges();
  }

  // Helpers

  /**
   * @private Will transform any user input into alias format.
   * It will ignore any text after an email, if one is entered.
   * If no email is entered, it will use the account's email.
   * It will treat the text before the email as the name for the alias.
   * If no name is entered, it will use the account's name value.
   * @param {string} str - The string the user entered on the alias input
   * @param {object} [account=this.props.account] - The account object
   */
  _makeAlias(str, account = this.props.account) {
    let lastCloseStrIndex = str.lastIndexOf('>');
    let lastBeginStrIndex = str.lastIndexOf('<');
    let emailStr = str;
    if (
      lastCloseStrIndex !== -1 &&
      lastBeginStrIndex !== -1 &&
      lastBeginStrIndex + 1 < lastCloseStrIndex
    ) {
      emailStr = str.slice(lastBeginStrIndex, lastCloseStrIndex);
    }
    const emailRegex = RegExpUtils.emailRegex();
    const match = emailRegex.exec(emailStr);
    if (!match) {
      return `${str || account.name} <${account.emailAddress}>`;
    }
    const email = match[0];
    let name = str.slice(0, Math.max(0, match.index - 1));
    if (emailStr !== str) {
      name = str.slice(0, lastBeginStrIndex);
    }
    if (!name) {
      name = account.name || 'No name provided';
    }
    name = name.trim();
    // TODO Sanitize the name string
    return `${name} <${email.trim()}>`;
  }

  _saveChanges = () => {
    this.props.onAccountUpdated(this.props.account, this.state.account);
  };

  _setState = (updates, callback = () => {}) => {
    const account = Object.assign(this.state.account.clone(), updates);
    this.setState({ account }, callback);
  };

  _setStateAndSave = updates => {
    this._setState(updates, () => {
      this._saveChanges();
    });
  };

  // Handlers
  _onAccountAutoaddressUpdated = autoaddress => {
    this._setState({ autoaddress });
  };
  _onAccountLabelUpdated = event => {
    this._setState({ label: event.target.value });
  };
  _onAccountNameUpdated = event => {
    this._setState({ name: event.target.value });
  };

  _findAlias = alias => {
    if (!Array.isArray(this.state.account.aliases)) {
      return -1;
    }
    if (this.state.account.aliases.length === 0) {
      return -1;
    }
    return this.state.account.aliases.findIndex(str => {
      let lastCloseStrIndex = str.lastIndexOf('>');
      let lastBeginStrIndex = str.lastIndexOf('<');
      if (
        lastCloseStrIndex !== -1 &&
        lastBeginStrIndex !== -1 &&
        lastBeginStrIndex + 1 < lastCloseStrIndex
      ) {
        const email = str.slice(lastBeginStrIndex + 1, lastCloseStrIndex);
        lastCloseStrIndex = alias.lastIndexOf('>');
        lastBeginStrIndex = alias.lastIndexOf('<');
        if (
          lastCloseStrIndex !== -1 &&
          lastBeginStrIndex !== -1 &&
          lastBeginStrIndex + 1 < lastCloseStrIndex
        ) {
          const aliasEmail = alias.slice(lastBeginStrIndex + 1, lastCloseStrIndex);
          return aliasEmail === email;
        }
      }
      return false;
    });
  };

  _onAccountAliasCreated = newAlias => {
    const coercedAlias = this._makeAlias(newAlias);
    if (this._findAlias(coercedAlias) === -1) {
      const aliases = this.state.account.aliases.concat([coercedAlias]);
      this._sendAccountAliasesTask(aliases);
      this._setStateAndSave({ aliases });
    } else {
      AppEnv.showErrorDialog({
        title: 'Cannot create alias',
        message: `Alias: ${coercedAlias} already exist`,
      });
    }
  };

  _onAccountAliasUpdated = (newAlias, alias, idx) => {
    const coercedAlias = this._makeAlias(newAlias);
    const conflictIndex = this._findAlias(coercedAlias);
    if (conflictIndex === -1 || conflictIndex === idx) {
      const aliases = this.state.account.aliases.slice();
      let defaultAlias = this.state.account.defaultAlias;
      if (defaultAlias === alias) {
        defaultAlias = coercedAlias;
      }
      aliases[idx] = coercedAlias;
      this._sendAccountAliasesTask(aliases);
      this._setStateAndSave({ aliases, defaultAlias });
    } else {
      AppEnv.showErrorDialog({
        title: 'Cannot create alias',
        message: `Alias: ${coercedAlias} already exist`,
      });
    }
  };

  _onAccountAliasRemoved = (alias, idx) => {
    const aliases = this.state.account.aliases.slice();
    let defaultAlias = this.state.account.defaultAlias;
    if (defaultAlias === alias) {
      defaultAlias = null;
    }
    aliases.splice(idx, 1);
    this._sendAccountAliasesTask(aliases);
    this._setStateAndSave({ aliases, defaultAlias });
  };
  _sendAccountAliasesTask(aliases) {
    const task = TaskFactory.taskForUpdateAccountAliases(this.state.account.id, aliases);
    if (task) {
      Actions.queueTask(task);
    }
  }

  _onDefaultAliasSelected = event => {
    const defaultAlias = event.target.value === 'None' ? null : event.target.value;
    this._setStateAndSave({ defaultAlias });
  };

  _onReconnect = async () => {
    ipcRenderer.send('command', 'application:add-account', {
      existingAccountJSON: await KeyManager.insertAccountSecrets(this.state.account),
    });
  };

  _onResetCache = () => {
    AppEnv.mailsyncBridge.resetCacheForAccount(this.state.account);
  };

  _onDeleteAccount = () => {
    const { account, onRemoveAccount, onSelectAccount } = this.props;
    const drafts = DraftStore.findDraftsByAccountId(account.id);
    let details = `Do you want to delete this account ${account.emailAddress}?`;
    if (drafts.length > 0) {
      details = `There are ${drafts.length} draft(s) for this account that are currently open.\n Do you want to proceed with deleting account ${account.emailAddress}?\n Deleting account will also close these drafts.`;
    }
    const chosen = remote.dialog.showMessageBoxSync({
      type: 'info',
      message: 'Are you sure?',
      detail: details,
      buttons: ['Delete', 'Cancel'],
      defaultId: 0,
      cancelId: 1,
    });
    if (chosen !== 0) {
      return;
    }
    const openWindowsCount = AppEnv.getOpenWindowsCountByAccountId(account.id);
    if (openWindowsCount > 0) {
      AppEnv.closeWindowsByAccountId(account.id, 'account deleted');
    }
    const index = this.props.accounts.indexOf(account);
    if (account && typeof onRemoveAccount === 'function') {
      // Move the selection 1 up or down after deleting
      const newIndex = index === 0 ? index + 1 : index - 1;
      onRemoveAccount(account);
      if (this.props.accounts[newIndex] && typeof onSelectAccount === 'function') {
        onSelectAccount(this.props.accounts[newIndex]);
      }
    }
  };

  // Renderers

  _renderDefaultAliasSelector(account) {
    const aliases = account.aliases;
    const defaultAlias = account.defaultAlias || 'None';
    if (aliases.length > 0) {
      return (
        <div>
          <label>Default for new messages:</label>
          <div className="item">
            <select value={defaultAlias} onChange={this._onDefaultAliasSelected}>
              <option value="None">{`${account.name} <${account.emailAddress}>`}</option>
              {aliases.map((alias, idx) => (
                <option key={`alias-${idx}`} value={alias}>
                  {alias}
                </option>
              ))}
            </select>
          </div>
        </div>
      );
    }
    return null;
  }

  _renderErrorDetail(message, buttonText, buttonAction) {
    return (
      <div className="account-error-detail">
        <div className="message">{message}</div>
        <a className="action" onClick={buttonAction}>
          {buttonText}
        </a>
      </div>
    );
  }

  _renderSyncErrorDetails() {
    const { account } = this.state;

    switch (account.syncState) {
      case Account.SYNC_STATE_AUTH_FAILED:
        return this._renderErrorDetail(
          `EdisonMail can no longer authenticate with ${account.emailAddress}. The password
            or authentication may have changed.`,
          'Reconnect',
          this._onReconnect
        );
      case Account.SYNC_STATE_ERROR:
        return this._renderErrorDetail(
          `EdisonMail encountered errors syncing this account. Crash reports
          have been sent to the EdisonMail team and we'll work to fix these
          errors in the next release.`,
          'Try Reconnecting',
          this._onReconnect
        );
      default:
        return null;
    }
  }
  _onUpdateMailSyncSettings = ({ value, key }) => {
    try {
      const accountId = this.state.account.id || this.state.account.pid;
      const newSettings = UpdateMailSyncSettings({
        value,
        key,
        accountIds: [accountId],
      });
      return (newSettings || {})[accountId];
    } catch (e) {
      AppEnv.reportError(e);
    }
  };
  _onFetchEmailIntervalUpdate = event => {
    try {
      const fetchInterval = parseInt(event.target.value, 10);
      const newSettings = this._onUpdateMailSyncSettings({
        value: fetchInterval,
        key: 'fetchEmailInterval',
      });
      if (newSettings) {
        this._setState({ mailsync: newSettings });
      }
    } catch (e) {
      AppEnv.reportError(e);
    }
  };
  _onFetchEmailRangeUpdate = event => {
    try {
      const fetchRange = parseInt(event.target.value, 10);
      const newSettings = this._onUpdateMailSyncSettings({
        value: fetchRange,
        key: 'fetchEmailRange',
      });
      if (newSettings) {
        this._setState({ mailsync: newSettings });
      }
    } catch (e) {
      AppEnv.reportError(e);
    }
  };

  _renderMailFetchRange() {
    const defalutMailsyncSettings = this._getDefalutMailsyncSettings();
    let mailsyncSettings = this.state.account.mailsync;
    if (defalutMailsyncSettings && !mailsyncSettings) {
      mailsyncSettings = defalutMailsyncSettings;
    } else if (!mailsyncSettings || !mailsyncSettings.fetchEmailRange) {
      AppEnv.reportError(new Error('fetchEmailRange do not have value'));
      mailsyncSettings = {
        fetchEmailRange: 365,
        fetchEmailInterval: 1,
      };
    }
    return (
      <div className="item">
        <label>Sync mail as far back as:</label>
        <div className="button-dropdown">
          <select
            value={mailsyncSettings.fetchEmailRange.toString()}
            onChange={this._onFetchEmailRangeUpdate}
            onBlur={this._saveChanges}
          >
            <option value="7">Within 7 days</option>
            <option value="30">Within 30 days</option>
            <option value="90">Within 3 month</option>
            <option value="365">Within 1 year</option>
            <option value="-1">All</option>
          </select>
          <RetinaImg
            name={'arrow-dropdown.svg'}
            isIcon
            style={{
              width: 24,
              height: 24,
              fontSize: 20,
              lineHeight: '24px',
              verticalAlign: 'middle',
            }}
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </div>
      </div>
    );
  }

  _renderMailFetchInterval() {
    const defalutMailsyncSettings = this._getDefalutMailsyncSettings();
    let mailsyncSettings = this.state.account.mailsync;
    if (defalutMailsyncSettings && !mailsyncSettings) {
      mailsyncSettings = defalutMailsyncSettings;
    } else if (!mailsyncSettings || !mailsyncSettings.fetchEmailInterval) {
      AppEnv.reportWarning(new Error('fetchEmailInterval do not have value'));
      mailsyncSettings = {
        fetchEmailRange: 365,
        fetchEmailInterval: 1,
      };
    }
    return (
      <div className="item">
        <label>Check for mail every:</label>
        <div className="button-dropdown">
          <select
            value={mailsyncSettings.fetchEmailInterval.toString()}
            onChange={this._onFetchEmailIntervalUpdate}
            onBlur={this._saveChanges}
          >
            <option value="1">Every minute</option>
            <option value="3">Every 3 minutes</option>
            <option value="5">Every 5 minutes</option>
          </select>
          <RetinaImg
            name={'arrow-dropdown.svg'}
            isIcon
            style={{
              width: 24,
              height: 24,
              fontSize: 20,
              lineHeight: '24px',
              verticalAlign: 'middle',
            }}
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </div>
      </div>
    );
  }

  _getDefalutMailsyncSettings = () => {
    const defalutMailsyncSettings = AppEnv.config.get('core.mailsync') || {
      fetchEmailRange: 365,
      fetchEmailInterval: 1,
    };
    return defalutMailsyncSettings;
  };

  _onCopyToSentUpdate = event => {
    try {
      const checked = event.target.checked;
      const newSettings = this._onUpdateMailSyncSettings({
        value: checked ? 1 : 0,
        key: 'copyToSent',
      });
      if (newSettings) {
        this._setState({ mailsync: newSettings }, () => {
          this._saveChanges();
        });
      }
    } catch (e) {
      AppEnv.reportError(e);
    }
  };

  _renderCopyToSent() {
    let mailsyncSettings = this.state.account.mailsync;
    let copyToSent;
    if (!mailsyncSettings || mailsyncSettings.copyToSent === undefined) {
      copyToSent = !Utils.isAutoCopyToSent(this.state.account);
    } else {
      copyToSent = mailsyncSettings.copyToSent;
    }
    return (
      <div className="item">
        <label>
          <input type="checkbox" checked={!!copyToSent} onChange={this._onCopyToSentUpdate} />
          Save copies of messages in the Sent folder
        </label>
      </div>
    );
  }

  render() {
    const { account } = this.state;
    const aliasPlaceholder = this._makeAlias(
      `Your Alias <alias@${account.emailAddress.split('@')[1]}>`
    );
    const isExchange = AccountStore.isExchangeAccount(account);

    return (
      <div className="account-details">
        {this._renderSyncErrorDetails()}
        <div className="config-group">
          <h6>{account && account.displayProvider().toUpperCase()} ACCOUNT</h6>
          <div className="item">
            <label htmlFor={'Account Label'}>Description</label>
            <input
              type="text"
              value={account.label}
              onBlur={this._saveChanges}
              onChange={this._onAccountLabelUpdated}
            />
          </div>
          {isExchange ? null : (
            <div className="item">
              <label htmlFor={'Sender Name'}>Sender Name</label>
              <input
                type="text"
                value={account.name}
                onBlur={this._saveChanges}
                placeholder="e.g. John Smith"
                onChange={this._onAccountNameUpdated}
              />
            </div>
          )}

          <AutoaddressControl
            autoaddress={account.autoaddress}
            onChange={this._onAccountAutoaddressUpdated}
            onSaveChanges={this._saveChanges}
          />
        </div>
        <div className="config-group">
          <h6>ALIASES</h6>
          <div className="notice">
            You may need to configure aliases with your mail provider (Outlook, Gmail) before using
            them.
          </div>
          <div className="aliases-edit">
            <EditableList
              showEditIcon
              showFooter
              needScroll
              items={account.aliases}
              createInputProps={{ placeholder: aliasPlaceholder }}
              onItemCreated={this._onAccountAliasCreated}
              onItemEdited={this._onAccountAliasUpdated}
              onDeleteItem={this._onAccountAliasRemoved}
            />
          </div>
          {this._renderDefaultAliasSelector(account)}
        </div>
        <div className="config-group">
          <h6>FOLDERS</h6>
          <PreferencesCategory account={account} />
        </div>
        <div className="config-group">
          <h6>ADVANCED</h6>
          {this._renderCopyToSent()}
          {this._renderMailFetchRange()}
          {this._renderMailFetchInterval()}
          <div onClick={this._onReconnect} className="btn-primary account-detail-btn">
            {account.provider === 'imap'
              ? 'Update Connection Settings...'
              : 'Re-authenticate Account'}
          </div>
          <div onClick={this._onResetCache} className="btn-primary account-detail-btn">
            Rebuild Cache
          </div>
          <div className="btn-danger account-detail-btn" onClick={this._onDeleteAccount}>
            Remove Account
          </div>
        </div>
      </div>
    );
  }
}

export default PreferencesAccountDetails;
