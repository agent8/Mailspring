/* eslint global-require: 0 */

import _ from 'underscore';
import MailspringStore from 'mailspring-store';
import { FocusedPerspectiveStore } from 'mailspring-exports';
import { MessageStore, ConversationStore, ContactStore, ConversationModel, ContactModel, AppStore } from 'chat-exports';
import KeyManager from '../../key-manager';
import Actions from '../actions';
import Account from '../models/account';
import Utils from '../models/utils';
import DatabaseStore from './database-store';
import { removeMyApps } from '../../../internal_packages/edison-beijing-chat/utils/appmgt';
import delay from '../../../internal_packages/edison-beijing-chat/utils/delay';
import { registerLoginEmailAccountForChat } from '../../../internal_packages/edison-beijing-chat/utils/register-login-chat';
import crypto from 'crypto';
const ipcRenderer = require('electron').ipcRenderer;

const configAccountsKey = 'accounts';
const configVersionKey = 'accountsVersion';
import Indicator from '../models/indicator';
import SiftRemoveAccountsTask from '../tasks/sift-remove-accounts-task';
import SiftUpdateAccountTask from '../tasks/sift-update-account-task';

/*
Public: The AccountStore listens to changes to the available accounts in
the database and exposes the currently active Account via {::current}

Section: Stores
*/
class AccountStore extends MailspringStore {
  constructor(props) {
    super(props);
    this._loadAccounts();
    this.listenTo(Actions.removeAccount, this._onRemoveAccount);
    this.listenTo(Actions.updateAccount, this._onUpdateAccount);
    this.listenTo(Actions.reorderAccount, this._onReorderAccount);
    this.listenTo(DatabaseStore, this._onDataChange);
    if (AppEnv.isMainWindow()) {
      this.listenTo(Actions.siftUpdateAccount, this._onSiftUpdateAccount);
      ipcRenderer.on('after-add-account', async (event, account) => {
        AppEnv.config.set('chatNeedAddIntialConversations', true)
        // refresh thread list
        FocusedPerspectiveStore.trigger();
        // add chat account
        if (AppEnv.config.get(`core.workspace.enableChat`)) {
          AppEnv.config.set('chatNeedAddIntialConversations', true)
          let chatConversationsInitialized = AppEnv.config.get('chatConversationsInitialized') || ''
          chatConversationsInitialized = chatConversationsInitialized.replace(account.emailAddress, '')
          AppEnv.config.set('chatConversationsInitialized', chatConversationsInitialized)
          // wait nativesync to pull emails
          await delay(30000);
          await registerLoginEmailAccountForChat(account);
          await AppStore.refreshAppsEmailContacts();
          await ConversationStore.createInitialPrivateConversationsFromAllContactsOfEmail(account.emailAddress);
          await MessageStore.saveMessagesAndRefresh([]);
        }
      });
    }

    AppEnv.config.onDidChange(configVersionKey, async change => {
      // If we already have this version of the accounts config, it means we
      // are the ones who saved the change, and we don't need to reload.
      if (this._version / 1 === change.newValue / 1) {
        return;
      }

      const oldAccountIds = this._accounts.map(a => a.id);
      this._loadAccounts();
      const accountIds = this._accounts.map(a => a.id);
      const newAccountIds = _.difference(accountIds, oldAccountIds);

      if (AppEnv.isMainWindow() && newAccountIds.length > 0) {
        const newId = newAccountIds[0];
        Actions.focusDefaultMailboxPerspectiveForAccounts([newId], {
          sidebarAccountIds: accountIds,
        });
        const FolderSyncProgressStore = require('./folder-sync-progress-store').default;
        await FolderSyncProgressStore.whenCategoryListSynced(newId);
        Actions.focusDefaultMailboxPerspectiveForAccounts([newId], {
          sidebarAccountIds: accountIds,
        });
        // TODO:
        // This Action is a hack, get rid of it in sidebar refactor
        // Wait until the FocusedPerspectiveStore triggers and the sidebar is
        // updated to uncollapse the inbox for the new account
        Actions.setCollapsedSidebarItem('Inbox', false);
      }
    });
  }

  isMyEmail(emailOrEmails = []) {
    const myEmails = this.emailAddresses();
    let emails = emailOrEmails;
    if (typeof emails === 'string') {
      emails = [emailOrEmails];
    }
    if (emails) {
      for (const email of emails) {
        if (myEmails.find(myEmail => Utils.emailIsEquivalent(myEmail, email))) {
          return true;
        }
      }
    }
    return false;
  }
  _onDataChange = change => {
    if (change.objectClass === Indicator.name) {
      change.objects.forEach(obj => {
        if (obj) {
          const account = this.accountForId(obj.accountId);
          if (account && obj.key === 'ErrorAuthentication' && account.syncState !== Account.SYNC_STATE_AUTH_FAILED) {
            Actions.updateAccount(account.id, { syncState: Account.SYNC_STATE_AUTH_FAILED })
          } else if (account && obj.key === Account.INSUFFICIENT_PERMISSION && account.syncState !== Account.INSUFFICIENT_PERMISSION) {
            AppEnv.reportWarning(new Error(`Account.INSUFFICIENT_PERMISSION`), { errorData: account });
            // Comment out until native fix issue with false negative with gmail permission issue.
            // Actions.updateAccount(account.id, { syncState: Account.INSUFFICIENT_PERMISSION })
          }
        }
      });
    }
  };
  _updateWakeWorkerTimer = (accountId, interval) => {
    if (!AppEnv.isMainWindow()) {
      return;
    }
    if (!this._wakeWorkerTimer) {
      this._wakeWorkerTimer = {};
    }
    if (this._wakeWorkerTimer[accountId]) {
      clearInterval(this._wakeWorkerTimer[accountId].timer);
    }
    this._wakeWorkerTimer[accountId] = { timer: null };
    this._wakeWorkerTimer[accountId].timer = setInterval(() => {
      AppEnv.sendSyncMailNow(accountId);
    }, interval);
  };
  _removeWakeWorkerTimer = accountId => {
    if (!this._wakeWorkerTimer) {
      this._wakeWorkerTimer = {};
    }
    if (this._wakeWorkerTimer[accountId]) {
      clearInterval(this._wakeWorkerTimer[accountId]);
    }
    delete this._wakeWorkerTimer[accountId];
  };
  _removeDeleteAccountTimers = () => {
    if (!AppEnv.isMainWindow()) {
      return;
    }
    if (!this._wakeWorkerTimer) {
      return;
    }
    const accountIds = this._accounts.map(act => act.id);
    const timerIds = Object.keys(this._wakeWorkerTimer);
    timerIds.forEach(id => {
      if (!accountIds.includes(id)) {
        clearInterval(this._wakeWorkerTimer[id].timer);
        delete this._wakeWorkerTimer[id];
      }
    })
  };

  _loadAccounts = () => {
    try {
      this._caches = {};
      this._version = AppEnv.config.get(configVersionKey) || 0;
      this._accounts = [];
      for (const json of AppEnv.config.get(configAccountsKey) || []) {
        if (!json.pid && json.id) {
          json.pid = json.id;
        }
        this._accounts.push(new Account().fromJSON(json));
        let fetchEmailInterval = 60000;
        if (json.mailsync && json.mailsync.fetchEmailInterval) {
          try {
            fetchEmailInterval = parseInt(json.mailsync.fetchEmailInterval, 10) * 60000;
          } catch (e) {
            AppEnv.reportError(e);
          }
        }
        this._updateWakeWorkerTimer(json.id, fetchEmailInterval);
      }
      this._removeDeleteAccountTimers();
      // Run a few checks on account consistency. We want to display useful error
      // messages and these can result in very strange exceptions downstream otherwise.
      this._enforceAccountsValidity();
    } catch (error) {
      AppEnv.reportError(error);
    }

    this._trigger(arguments);
  };

  _enforceAccountsValidity = () => {
    const seenIds = {};
    const seenEmails = {};
    let message = null;

    this._accounts = this._accounts.filter(account => {
      if (!account.emailAddress) {
        message =
          'Assertion failure: One of the accounts in config.json did not have an emailAddress, and was removed. You should re-link the account.';
        return false;
      }
      if (seenIds[account.id]) {
        message =
          'Assertion failure: Two of the accounts in config.json had the same ID and one was removed. Please give each account a separate ID.';
        return false;
      }
      if (seenEmails[account.emailAddress]) {
        message =
          'Assertion failure: Two of the accounts in config.json had the same email address and one was removed.';
        return false;
      }

      seenIds[account.id] = true;
      seenEmails[account.emailAddress] = true;
      return true;
    });

    if (message && AppEnv.isMainWindow()) {
      AppEnv.showErrorDialog(
        `EdisonMail was unable to load your account preferences.\n\n${message}`
      );
    }
  };

  _trigger() {
    for (const account of this._accounts) {
      if (!account || !account.id) {
        const err = new Error('An invalid account was added to `this._accounts`');
        AppEnv.reportError(err);
        this._accounts = _.compact(this._accounts);
      }
    }
    this.trigger(arguments);
  }

  _save = (reason) => {
    this._version += 1;
    const configAccounts = this._accounts.map(a => a.toJSON());
    configAccounts.forEach(a => {
      delete a.sync_error;

      // this should not be necessary since this info is stripped when
      // the account is added, but we want to be on the safe side.
      delete a.settings.imap_password;
      delete a.settings.smtp_password;
      delete a.settings.refresh_token;
    });
    AppEnv.config.set(configAccountsKey, configAccounts);
    AppEnv.config.set(configVersionKey, this._version);
    this._trigger(reason);
  };

  /**
   * Actions.updateAccount is called directly from the local-sync worker.
   * This will update the account with its updated sync state
   */
  _onUpdateAccount = (id, updated) => {
    const idx = this._accounts.findIndex(a => a.id === id);
    let account = this._accounts[idx];
    if (!account) return;
    account = Object.assign(account, updated);
    this._caches = {};
    this._accounts[idx] = account;
    this._save();
    this._parseErrorAccount();
  };
  _forceRelaunchClients(accts) {
    accts.forEach(acct => {
      AppEnv.mailsyncBridge.forceRelaunchClient(acct);
    })
  }
  _reconnectAccount = async account => {
    AppEnv.mailsyncBridge.tmpKillClient(account);
    ipcRenderer.send('command', 'application:add-account', {
      existingAccountJSON: await KeyManager.insertAccountSecrets(account),
    });
  };
  _parseErrorAccount() {
    const erroredAccounts = this._accounts.filter(a => a.hasSyncStateError());
    const okAccounts = this._accounts.filter(a => !a.hasSyncStateError());
    if (erroredAccounts.length !== 0 && okAccounts.length !== 0) {
      const okAccountMessages = [];
      okAccounts.forEach(acct => {
        if (acct) {
          okAccountMessages.push({ id: `account-error-${acct.emailAddress}`, accountIds: [acct.id] });
        }
      });
      Actions.removeAppMessages(okAccountMessages);
    }
    if (erroredAccounts.length === 0) {
      const message = { id: `account-error`, level: 0 };
      Actions.removeAppMessage(message);
      return;
    } else if (erroredAccounts.length > 1) {
      const message = {
        id: `account-error`,
        accountIds: erroredAccounts.map(account => account.id),
        level: 0,
        description: 'Several of your accounts are having issues',
        actions: [
          {
            text: 'Check Again',
            onClick: () => this._forceRelaunchClients(erroredAccounts)
          },
          {
            text: 'Manage',
            onClick: () => {
              Actions.switchPreferencesTab('Accounts');
              Actions.openPreferences();
            }
          }
        ],
        allowClose: true
      };
      Actions.pushAppMessage(message);
    } else {
      const erroredAccount = erroredAccounts[0];
      const message = { allowClose: true, level: 0, id: `account-error-${erroredAccount.emailAddress}`, accountIds: [erroredAccount.id] };
      switch (erroredAccount.syncState) {
        case Account.SYNC_STATE_AUTH_FAILED:
          message.description = `Cannot authenticate with ${erroredAccount.emailAddress}`;
          message.actions = [
            {
              text: 'Okay',
              onClick: () => Actions.removeAppMessage(message)
            },
            {
              text: 'Reconnect',
              onClick: () => this._reconnectAccount(erroredAccount)
            },
          ];
          break;
        case Account.INSUFFICIENT_PERMISSION:
          message.description = `${erroredAccount.emailAddress} lack permission to perform action`;
          message.actions = [
            {
              text: 'Check Again',
              onClick: () => this._forceRelaunchClients([erroredAccount])
            },
            {
              text: 'Reauthenticate',
              onClick: () => this._reconnectAccount(erroredAccount)
            },
          ];
          break;
        default: {
          message.description = `We encountered an error while syncing ${erroredAccount.emailAddress}`;
          message.actions = [
            {
              text: 'Try Again',
              onClick: () => this._forceRelaunchClients([erroredAccount]),
            },
          ];
        }
      }
      Actions.pushAppMessage(message);
    }
  }

  /**
   * When an account is removed from Mailspring, the AccountStore
   * triggers. The local-sync/src/local-sync-worker/index.js listens to
   * the AccountStore and runs `ensureK2Consistency`. This will actually
   * delete the Account on the local sync side.
   */
  _onRemoveAccount = async id => {
    const account = this._accounts.find(a => a.id === id);
    if (!account) return;
    if (AppEnv.config.get(`core.workspace.enableChat`)) {
      let chatAccounts = AppEnv.config.get('chatAccounts') || {};
      let chatAccount = chatAccounts[account.emailAddress];
      if (chatAccount) {
        delete chatAccounts[account.emailAddress];
        AppEnv.config.set('chatAccounts', chatAccounts);
        let jid = chatAccount.userId + '@im.edison.tech';
        await ConversationModel.destroy({
          where: {
            curJid: jid
          }
        });
        ConversationStore.refreshConversations();
        // all valid contacts will be add back in AppStore.refreshAppsEmailContacts()
        await ContactModel.destroy({
          where: { curJid: jid },
          truncate: true,
          force: true
        });
        ContactStore.contacts = []
        await ContactStore.refreshContacts();
        xmpp.removeXmpp(jid);
        removeMyApps(chatAccount.userId);
        // await AppStore.refreshAppsEmailContacts();
        AppEnv.config.set(`${chatAccount.userId}_message_ts`, null)
      }
    }

    this._caches = {};

    const remainingAccounts = this._accounts.filter(a => a !== account);
    // This action is called before saving because we need to unfocus the
    // perspective of the account that is being removed before removing the
    // account, otherwise when we trigger with the new set of accounts, the
    // current perspective will still reference a stale accountId which will
    // cause things to break
    Actions.focusDefaultMailboxPerspectiveForAccounts(remainingAccounts);
    _.defer(() => {
      Actions.setCollapsedSidebarItem('Inbox', true);
    });

    this._accounts = remainingAccounts;
    this._save('removeAccount');
    Actions.queueTask(new SiftRemoveAccountsTask({ accounts: [account] }));

    if (remainingAccounts.length === 0) {
      // Clear everything and logout
      Actions.forceKillAllClients();
      // ipcRenderer.send('command', 'application:reset-database', {});
    } else {
      // Clear the cached data for the account and reset secrets once that has completed
      AppEnv.mailsyncBridge.resetCacheForAccount(account, { silent: true }).then(() => {
        KeyManager.deleteAccountSecrets(account);
      });
    }
  };

  _onReorderAccount = (id, newIdx) => {
    const existingIdx = this._accounts.findIndex(a => a.id === id);
    if (existingIdx === -1) return;
    const account = this._accounts[existingIdx];
    this._caches = {};
    this._accounts.splice(existingIdx, 1);
    this._accounts.splice(newIdx, 0, account);
    this._save();
  };

  _onSiftUpdateAccount = (fullAccount) => {
    Actions.queueTask(new SiftUpdateAccountTask({ account: fullAccount }));
  };

  addAccount = async account => {
    if (!account.emailAddress || !account.provider || !(account instanceof Account)) {
      throw new Error(`Returned account data is invalid: ${JSON.stringify(account)}`);
    }

    // send the account JSON and cloud token to the KeyManager,
    // which gives us back a version with no secrets.
    const cleanAccount = await KeyManager.extractAccountSecrets(account);

    this._loadAccounts();

    const existingIdx = this._accounts.findIndex(
      a => a.id === cleanAccount.id || a.emailAddress === cleanAccount.emailAddress
    );

    if (existingIdx === -1) {
      this._accounts.push(cleanAccount);
    } else {
      const existing = this._accounts[existingIdx];
      existing.syncState = Account.SYNC_STATE_OK;
      existing.name = cleanAccount.name;
      existing.emailAddress = cleanAccount.emailAddress;
      existing.settings = cleanAccount.settings;
    }

    this._save('add account');
    ipcRenderer.send('after-add-account', account);
  };

  _cachedGetter(key, fn) {
    this._caches[key] = this._caches[key] || fn();
    return this._caches[key];
  }

  // Public: Returns an {Array} of {Account} objects
  accounts = () => {
    return this._accounts;
  };

  accountIds = () => {
    return this._accounts.map(a => a.id);
  };
  stripAccountData = account => {
    const sensitveData = [
      'emailAddress',
      'label',
      'name',
      'access_token',
      'ews_password',
      'ews_username',
      'imap_username',
      'smtp_username',
      'imap_password',
      'smtp_password',
    ];
    const ret = {};
    const hash = str => {
      return crypto
        .createHash('sha256')
        .update(str)
        .digest('hex')
    };
    for (let key in account) {
      if (key !== 'aliases' && key !== 'settings' && !sensitveData.includes(key)) {
        ret[key] = account[key];
      } else if (key === 'aliases') {
        ret.aliases = [];
        account.aliases.forEach(alias => {
          ret.aliases.push(hash(alias));
        });
      } else if (key === 'settings') {
        ret.settings = {};
        for (let settingKey in account.settings) {
          if (sensitveData.includes(settingKey)) {
            ret.settings[settingKey] = hash(account.settings[settingKey]);
          } else {
            ret.settings[settingKey] = account.settings[settingKey];
          }
        }
      } else {
        ret[key] = hash(account[key]);
      }
    }
    return ret;
  };
  accountsForErrorLog = () => {
    return this.accounts().map(account => {
      return this.stripAccountData(account);
    })
  };

  accountsForItems = items => {
    const accounts = {};
    items.forEach(({ accountId }) => {
      accounts[accountId] = accounts[accountId] || this.accountForId(accountId);
    });
    return _.compact(Object.values(accounts));
  };

  accountForItems = items => {
    const accounts = this.accountsForItems(items);
    if (accounts.length > 1) {
      return null;
    }
    return accounts[0];
  };

  // Public: Returns the {Account} for the given email address, or null.
  accountForEmail = email => {
    for (const account of this.accounts()) {
      if (Utils.emailIsEquivalent(email, account.emailAddress)) {
        return account;
      }
    }
    for (const alias of this.aliases()) {
      if (Utils.emailIsEquivalent(email, alias.email)) {
        return this.accountForId(alias.accountId);
      }
    }
    return null;
  };

  // Public: Returns the {Account} for the given account id, or null.
  accountForId(id) {
    return this._cachedGetter(`accountForId:${id}`, () => this._accounts.find(a => a.id === id));
  }

  emailAddresses() {
    let addresses = (this.accounts() ? this.accounts() : []).map(a => a.emailAddress);
    addresses = addresses.concat((this.aliases() ? this.aliases() : []).map(a => a.email));
    return _.unique(addresses);
  }

  aliases() {
    return this._cachedGetter('aliases', () => {
      const aliases = [];
      for (const acc of this._accounts) {
        aliases.push(acc.me());
        for (const alias of acc.aliases) {
          const aliasContact = acc.meUsingAlias(alias);
          if (aliasContact) {
            aliasContact.isAlias = true;
            aliases.push(aliasContact);
          }
        }
      }
      return aliases;
    });
  }

  aliasesFor(accountsOrIds) {
    const ids = accountsOrIds.map(accOrId => {
      return accOrId instanceof Account ? accOrId.id : accOrId;
    });
    return this.aliases().filter(contact => ids.includes(contact.accountId));
  }

  // Public: Returns the currently active {Account}.
  current() {
    throw new Error('AccountStore.current() has been deprecated.');
  }
}

export default new AccountStore();