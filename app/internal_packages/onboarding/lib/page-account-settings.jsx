import { Account, React, PropTypes, RegExpUtils, Actions } from 'mailspring-exports';

import OnboardingActions from './onboarding-actions';
import CreatePageForForm from './decorators/create-page-for-form';
import {
  expandAccountWithCommonSettings,
  validateEmailAddressForProvider,
} from './onboarding-helpers';
import FormField from './form-field';
import AccountProviders from './account-providers';
import { ipcRenderer } from 'electron';

class AccountBasicSettingsForm extends React.Component {
  static displayName = 'AccountBasicSettingsForm';

  static propTypes = {
    account: PropTypes.object,
    errorFieldNames: PropTypes.array,
    submitting: PropTypes.bool,
    onConnect: PropTypes.func,
    onFieldChange: PropTypes.func,
    onFieldKeyPress: PropTypes.func,
    forceDomain: PropTypes.string,
    providerConfig: PropTypes.object,
  };

  static submitLabel = account => {
    return account.provider === 'imap' ? 'Continue' : 'Connect Account';
  };

  static titleLabel = providerConfig => {
    return (
      providerConfig.title ||
      `Add your ${providerConfig.displayNameShort || providerConfig.displayName} account`
    );
  };

  static subtitleLabel = providerConfig => {
    // return (
    //   providerConfig.note ||
    //   `Enter your email account credentials to get started. Edison Mail\nstores your email password securely and it is never sent to our servers.`
    // );
    return providerConfig.note;
  };

  static validateAccount = account => {
    const providerConfig = AccountProviders.find(({ provider }) => provider === account.provider);
    const errorFieldNames = [];
    let errorMessage = null;

    if (!account.emailAddress || !account.settings.imap_password) {
      return { errorMessage, errorFieldNames, populated: false };
    }

    if (!RegExpUtils.emailRegex().test(account.emailAddress)) {
      errorFieldNames.push('email');
      errorMessage = 'Please provide a valid email address.';
    }
    if (providerConfig && providerConfig.provider === 'icloud') {
      const emailValidate = validateEmailAddressForProvider(account.emailAddress, providerConfig);
      if (!emailValidate.ret) {
        errorFieldNames.push('email');
        errorMessage = emailValidate.message;
      }
    }
    if (!account.settings.imap_password) {
      errorFieldNames.push('password');
      errorMessage = 'Please provide a password for your account.';
    }
    // if (account.provider === 'exchange' && !account.settings.exchangeServer) {
    //   errorFieldNames.push('exchangeServer');
    //   errorMessage = 'Please provide your exchange server.';
    // }

    return { errorMessage, errorFieldNames, populated: true };
  };

  componentDidMount() {
    this._storeUnlisten = [];
    const { provider } = this.props.account;
    if (provider === 'icloud') {
      this._storeUnlisten.push(
        Actions.transfterICloudToken.listen(token => {
          this.props.onFieldChange({
            target: {
              id: 'settings.imap_password',
              value: token,
            },
          });
          setTimeout(this.submit, 100);
          AppEnv.trackingEvent('iCloud-Generate-App-Password-Success');
        }, this)
      );
    }
  }

  componentWillUnmount() {
    if (this._storeUnlisten) {
      for (let un of this._storeUnlisten) {
        un();
      }
    }
  }

  submit = async () => {
    // create a new account with expanded settings and just the three fields
    const {
      name,
      emailAddress,
      provider,
      settings: { imap_password, exchangeServer },
    } = this.props.account;
    let account = new Account({
      name: '', // imap sender name default empty
      emailAddress,
      provider,
      settings: { imap_password, exchangeServer },
    });
    account = await expandAccountWithCommonSettings(
      account,
      this.props.providerConfig ? this.props.providerConfig.defaultDomain : null
    );
    OnboardingActions.setAccount(account);

    if ((account.settings.imap_host && account.settings.smtp_host) || provider === 'exchange') {
      if (provider === 'exchange') {
        account.settings.ews_host = exchangeServer;
        account.settings.ews_password = imap_password;
        account.settings.ews_username = emailAddress;
      }
      // expanding the account settings succeeded - try to authenticate
      this.props.onConnect(account);
    } else {
      // fill imap and smtp server
      const domain = account.emailAddress
        .split('@')
        .pop()
        .toLowerCase();
      account.settings.imap_username = account.emailAddress;
      account.settings.imap_host = `imap.${domain}`;
      account.settings.smtp_host = `smtp.${domain}`;
      // try to connect default imap server, if failed, move to 'account-settings-imap' page
      this.props.onConnect(account);

      // we need the user to provide IMAP/SMTP credentials manually
      // OnboardingActions.moveToPage('account-settings-imap');
    }
  };

  _openICloudAppTokenWindow() {
    ipcRenderer.send('command', 'application:icloud-app-token');
    AppEnv.trackingEvent('iCloud-Generate-App-Password');
  }

  render() {
    const { provider } = this.props.account;
    return (
      <form className="settings">
        <FormField field="emailAddress" title="Email" {...this.props} />
        <FormField
          field="settings.imap_password"
          title={provider === 'icloud' ? 'App-Specific Password' : 'Password'}
          type="password"
          {...this.props}
        />
        {/* {provider === 'exchange' ? (
          <FormField field="settings.exchangeServer" title="Exchange Server" {...this.props} />
        ) : null} */}
        {provider === 'icloud' ? (
          <div className="icloud-generate-token" onClick={this._openICloudAppTokenWindow}>
            Generate an app-specific password
          </div>
        ) : null}
      </form>
    );
  }
}

export default CreatePageForForm(AccountBasicSettingsForm);
