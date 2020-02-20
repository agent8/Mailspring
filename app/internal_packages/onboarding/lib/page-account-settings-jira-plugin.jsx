import React from 'react';
import PropTypes from 'prop-types';

import { buildJiraAccountFromAuthResponse, buildJiraAuthURL } from './onboarding-helpers';

import OAuthSignInPage from './oauth-signin-page';
import OnboardingActions from './onboarding-actions';
import AccountProviders from './account-providers';

export default class AccountSettingsPageJira extends React.Component {
  static displayName = 'AccountSettingsPageJira';

  static propTypes = {
    account: PropTypes.object,
  };

  constructor() {
    super();
    this._gmailAuthUrl = buildJiraAuthURL();
  }

  onSuccess(account) {
    OnboardingActions.finishAndAddAccount(account);
  }

  render() {
    const providerConfig = AccountProviders.find(a => a.provider === this.props.account.provider);
    const { headerIcon } = providerConfig || {};
    const goBack = () => OnboardingActions.moveToPreviousPage();

    return (
      <OAuthSignInPage
        serviceName="Jira"
        providerAuthPageUrl={this._gmailAuthUrl}
        buildAccountFromAuthResponse={buildJiraAccountFromAuthResponse}
        iconName={headerIcon}
        onSuccess={this.onSuccess}
        onTryAgain={goBack}
      />
    );
  }
}
