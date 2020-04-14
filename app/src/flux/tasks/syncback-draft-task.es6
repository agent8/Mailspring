import Task from './task';
import Attributes from '../attributes';
import Message from '../models/message';
import Account from '../models/account';

export default class SyncbackDraftTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    messageId: Attributes.String({
      modelKey: 'messageId',
    }),
    saveOnRemote: Attributes.Boolean({
      modelKey: 'saveOnRemote',
    }),
    draft: Attributes.Object({
      modelKey: 'draft',
      itemClass: Message,
    }),
  });

  constructor({ draft, ...rest } = {}) {
    super(rest);
    this.draft = draft;
    this.accountId = (draft || {}).accountId;
    this.messageId = (draft || {}).id;
  }

  onError({ key, debuginfo, retryable }) {
    if (retryable) {
      console.warn(`retrying task because ${debuginfo}`);
      return;
    }
    if (key === 'no-drafts-folder') {
      const previousError = AppEnv.filterTaskErrorCounter({
        accountId: this.accountId,
        identityKey: 'type',
        value: 'SyncBackDraft',
      });
      if (previousError.length === 0) {
        AppEnv.showErrorDialog({
          title: 'Drafts folder not found',
          message:
            "Edison Mail can't find your Drafts folder. To create and send mail, visit Preferences > Folders and" +
            ' choose a Drafts folder.',
        });
        AppEnv.pushTaskErrorCounter({ data: { type: 'SyncBackDraft' }, accountId: this.accountId });
      }
    } else {
      if (key === 'ErrorAccountNotConnected') {
        let accounts = AppEnv.config.get('accounts');
        if (Array.isArray(accounts)) {
          let errorAccount = { emailAddress: '' };
          let newAccounts = accounts.map(account => {
            if (account.id === this.accountId) {
              account.syncState = Account.SYNC_STATE_AUTH_FAILED;
              errorAccount.emailAddress = account.emailAddress;
              return account;
            } else {
              return account;
            }
          });
          AppEnv.config.set('accounts', newAccounts);
          // AppEnv.showErrorDialog(`Cannot authenticate with ${errorAccount.emailAddress}`, { detail: debuginfo });
        }
      } else if (AppEnv.inDevMode()) {
        AppEnv.showErrorDialog('Draft processing failed', { detail: debuginfo });
      }
    }
  }
}
