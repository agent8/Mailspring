import React from 'react';
import PropTypes from 'prop-types';

import { buildOutlookAccountFromAuthResponse, buildOutlookAuthURL } from './onboarding-helpers';

import OAuthSignInPage from './oauth-signin-page';
import OnboardingActions from './onboarding-actions';
import AccountProviders from './account-providers';

export default class AccountSettingsPageOutlook extends React.Component {
  static displayName = 'AccountSettingsPageOutlook';

  static propTypes = {
    account: PropTypes.object,
  };

  constructor() {
    super();
    const { existingAccountJSON } = AppEnv.getWindowProps();
    let emailAddress;
    if (existingAccountJSON && existingAccountJSON.provider === 'outlook') {
      emailAddress = existingAccountJSON.emailAddress;
    }
    this._outlookAuthUrl = buildOutlookAuthURL(emailAddress);
  }

  onSuccess = account => {
    // outlook & hotmail is use same oauth.
    // After login, they need to be separated so that show their avatars .
    account.provider = this.props.account.provider;
    OnboardingActions.finishAndAddAccount(account);
  };

  render() {
    const providerConfig = AccountProviders.find(a => a.provider === this.props.account.provider);
    const { headerIcon } = providerConfig;
    const goBack = () => OnboardingActions.moveToPreviousPage();

    return (
      <OAuthSignInPage
        serviceName="Outlook"
        providerAuthPageUrl={this._outlookAuthUrl}
        buildAccountFromAuthResponse={code => buildOutlookAccountFromAuthResponse(code)}
        iconName={headerIcon}
        onSuccess={this.onSuccess}
        onTryAgain={goBack}
      />
    );
  }
}
