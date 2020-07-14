import React from 'react';
import PropTypes from 'prop-types';
import { RetinaImg } from 'mailspring-component-kit';
import OnboardingActions from './onboarding-actions';
import AccountProviders from './account-providers';
const INVITE_COUNT_KEY = 'invite.count';

export default class AccountChoosePage extends React.Component {
  static displayName = 'AccountChoosePage';

  static propTypes = {
    account: PropTypes.object,
  };

  componentDidMount() {
    // facebook tracking: add account
    // first time open app and add account
    // if (AppEnv.config.get(INVITE_COUNT_KEY) === undefined) {
    //   AppEnv.trackingEvent('Invite-AddAccount');
    // } else {
    AppEnv.trackingEvent('AddAccount');
    // }
  }

  chooseAccountProvider(provider) {
    // if (AppEnv.config.get(INVITE_COUNT_KEY) === undefined) {
    //   AppEnv.trackingEvent('Invite-ChooseAccountProvider', { provider });
    // } else {
    AppEnv.trackingEvent('ChooseAccountProvider', { provider });
    // }
    OnboardingActions.chooseAccountProvider(provider);
  }

  _renderProviders() {
    return AccountProviders.filter(({ hide }) => !hide).map(({ icon, displayName, provider }) => (
      <div
        key={provider}
        className={`provider ${provider}`}
        onClick={() => this.chooseAccountProvider(provider)}
      >
        <div className="icon-container">
          <RetinaImg name={icon} mode={RetinaImg.Mode.ContentPreserve} className="icon" />
        </div>
        <span className="provider-name">{displayName}</span>
      </div>
    ));
  }

  render() {
    return (
      <div className="page account-choose">
        <h2>Login to Your Email</h2>
        <p>Add an account to get started</p>
        <div className="provider-list">{this._renderProviders()}</div>
      </div>
    );
  }
}
