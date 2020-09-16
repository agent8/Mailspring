import { AccountStore, Account, IdentityStore, Constant, RESTful } from 'mailspring-exports';
import { ipcRenderer } from 'electron';
import MailspringStore from 'mailspring-store';
import OnboardingActions from './onboarding-actions';

const { OAuthList } = Constant;
const NEED_INVITE_COUNT = 3;
const INVITE_COUNT_KEY = 'invite.count';
const { EdisonAccountRest } = RESTful;
// const ONBOARDING_TRACKING_URL = 'https://cp.stag.easilydo.cc/api/multiple/desktop/onboarding';
const ONBOARDING_TRACKING_URL = 'https://cp.edison.tech/api/multiple/desktop/onboarding';

class OnboardingStore extends MailspringStore {
  constructor() {
    super();

    this.listenTo(OnboardingActions.moveToPreviousPage, this._onMoveToPreviousPage);
    this.listenTo(OnboardingActions.moveToPage, this._onMoveToPage);
    this.listenTo(OnboardingActions.setAccount, this._onSetAccount);
    this.listenTo(OnboardingActions.chooseAccountProvider, this._onChooseAccountProvider);
    this.listenTo(OnboardingActions.finishAndAddAccount, this._onFinishAndAddAccount);
    this.listenTo(OnboardingActions.identityJSONReceived, this._onIdentityJSONReceived);

    const { existingAccountJSON, addingAccount } = AppEnv.getWindowProps();

    const hasAccounts = AccountStore.accounts().length > 0;
    // we don't have edison account for now.
    // const identity = IdentityStore.identity();
    const identity = AppEnv.config.get('identity');

    this._account = new Account({
      name: identity ? `${identity.firstName || ''} ${identity.lastName || ''}` : '',
      emailAddress: identity ? identity.emailAddress : '',
      settings: {},
    });

    // beta invite flow
    // const shareCounts = AppEnv.config.get('invite.count') || 0;
    // const agree = AppEnv.config.get('agree');
    // if (!agree && shareCounts < NEED_INVITE_COUNT) {
    //   if (hasAccounts) {
    //     this._pageStack = ['sorry'];
    //   }
    //   else {
    //     this._pageStack = ['login'];
    //   }
    // }
    // else
    if (existingAccountJSON) {
      // Used when re-adding an account after re-connecting, take the user back
      // to the best page with the most details
      this._account = new Account(existingAccountJSON);
      if (OAuthList.includes(this._account.provider)) {
        this._pageStack = ['account-choose', `account-settings-${this._account.provider}`];
      } else if (this._account.provider === 'imap') {
        this._pageStack = ['account-choose', 'account-settings', 'account-settings-imap'];
      } else if (this._account.provider === 'exchange') {
        this._pageStack = ['account-choose', 'account-settings', 'account-settings-exchange'];
      } else {
        this._pageStack = ['account-choose', 'account-settings'];
      }
    } else if (addingAccount) {
      // Adding a new, unknown account
      this._pageStack = ['account-choose'];
    } else if (hasAccounts) {
      // Should only happen when the user has "signed out" of their Nylas ID,
      // but already has accounts synced. Or is upgrading from a very old build.
      // We used to show "Welcome Back", but now just jump to sign in.
      this._pageStack = ['authenticate'];
    } else if (identity) {
      // Should only happen if config was edited to remove all accounts,
      // but don't want to re-login to Nylas account. Very useful when
      // switching environments.
      this._pageStack = ['account-choose'];
    } else {
      // Standard new user onboarding flow.
      this._pageStack = ['tutorial'];
    }
  }

  _onOnboardingComplete = () => {
    // When account JSON is received, we want to notify external services
    // that it succeeded. Unfortunately in this case we're likely to
    // close the window before those requests can be made. We add a short
    // delay here to ensure that any pending requests have a chance to
    // clear before the window closes.
    setTimeout(() => {
      ipcRenderer.send('account-setup-successful');
    }, 10);
  };

  _onChooseAccountProvider = provider => {
    let nextPage = 'account-settings';
    if (OAuthList.includes(provider)) {
      nextPage += `-${provider}`;
    }

    // Don't carry over any type-specific account information
    this._onSetAccount(
      new Account({
        emailAddress: '',
        name: this._account.name,
        settings: {},
        provider,
      })
    );

    this._onMoveToPage(nextPage);
  };

  _onSetAccount = acct => {
    if (!(acct instanceof Account)) {
      throw new Error('OnboardingActions.setAccount expects an Account instance.');
    }
    this._account = acct;
    this.trigger();
  };

  _onMoveToPreviousPage = () => {
    const p = this._pageStack.pop();
    // if (p === 'account-choose') {
    //   this._onMoveToPage('tutorial');
    // }
    this.trigger();
  };

  _onMoveToPage = page => {
    this._pageStack.push(page);
    this.trigger();
  };

  _onIdentityJSONReceived = async json => {
    const isFirstAccount = AccountStore.accounts().length === 0;
    try {
      await IdentityStore.saveIdentity(json);
    } catch (err) {
      console.error('Error: IdentityStore.saveIdentity failed.', err);
    }

    setTimeout(() => {
      if (isFirstAccount) {
        const next = this._account.clone();
        next.name = `${json.firstName || ''} ${json.lastName || ''}`;
        next.emailAddress = json.emailAddress;
        this._onSetAccount(next);
        OnboardingActions.moveToPage('account-choose');
      } else if (!AppEnv.config.get('agree')) {
        OnboardingActions.moveToPage('gdpr-terms');
      } else {
        this._onOnboardingComplete();
      }
    }, 10);
  };

  _onFinishAndAddAccount = async account => {
    // const isFirstAccount = AccountStore.accounts().length === 0;
    const { settings } = account;
    if (settings && ['onmail-eng'].includes(settings.provider_key)) {
      account.provider = 'onmail-eng';
    }
    if (settings && ['onmail'].includes(settings.provider_key)) {
      account.provider = 'onmail';
    }
    const { provider, emailAddress } = account;
    const domain = emailAddress ? emailAddress.split('@')[1] : '';
    // if (AppEnv.config.get(INVITE_COUNT_KEY) === undefined) {
    //   AppEnv.trackingEvent('Invite-AddAccount-Success', { provider, domain });
    // } else {
    AppEnv.trackingEvent('AddAccount-Success', { provider, domain });
    // }
    try {
      await fetch(
        `https://web-marketing.edison.tech/markBetaUserInstall?type=mac&apiKey=bdH0VGExAEIhPq0z5vwdyVuHVzWx0hcR&email=${emailAddress}`,
        {
          method: 'GET',
        }
      );
    } catch (err) {
      console.log('add tracing failed', err);
    }
    // add tracking for installed users
    try {
      await fetch(ONBOARDING_TRACKING_URL, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ba68b70f0ea8596eadbaea4f116356c2',
        },
        body: JSON.stringify({
          email: emailAddress,
          version: AppEnv.getVersion(),
          mas: process.mas ? 1 : 0,
          extra: 'desktop',
          provider,
        }),
      });
    } catch (err) {
      console.log('onboarding add account tracking failed', err);
    }

    try {
      await AccountStore.addAccount(account);
    } catch (e) {
      AppEnv.reportError(e);
      AppEnv.showErrorDialog({
        title: 'Unable to Add Account',
        message:
          'Sorry, something went wrong when this account was added to EdisonMail. ' +
          `If you do not see the account, try linking it again. ${e.toString()}`,
      });
    }

    AppEnv.displayWindow();

    const { addingAccount } = AppEnv.getWindowProps();
    const isOnboarding = !addingAccount;
    if (isOnboarding) {
      // beta invite flow
      // const shareCounts = AppEnv.config.get('invite.count') || 0;
      // const agree = AppEnv.config.get('agree');
      // if (!agree && shareCounts < NEED_INVITE_COUNT) {
      //   AppEnv.config.set('invite.email', account.emailAddress);
      //   this._onMoveToPage('sorry');
      //   return;
      // }
      // const oldAccountsNum = AccountStore.accountIds().length;
      // if (oldAccountsNum === 1) {
      //   const syncAccount = AccountStore.syncAccount();
      //   if (!syncAccount) {
      //     // the first account auto to register edison account
      //     EdisonAccountRest.register(account.id);
      //   }
      // }
      this._onMoveToPage('account-add-another');
    } else {
      // let them see the "success" screen for a moment
      // before the window is closed.
      setTimeout(() => {
        this._onOnboardingComplete();
      }, 10);
    }
  };

  page() {
    return this._pageStack[this._pageStack.length - 1];
  }

  pageDepth() {
    return this._pageStack.length;
  }

  account() {
    return this._account;
  }
}

export default new OnboardingStore();
