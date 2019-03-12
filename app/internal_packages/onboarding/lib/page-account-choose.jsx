import React from 'react';
import PropTypes from 'prop-types';
import { RetinaImg } from 'mailspring-component-kit';
import OnboardingActions from './onboarding-actions';
import AccountProviders from './account-providers';

export default class AccountChoosePage extends React.Component {
  static displayName = 'AccountChoosePage';

  static propTypes = {
    account: PropTypes.object,
  };

  _renderProviders() {
    return AccountProviders.map(({ icon, displayName, provider }) => (
      <div
        key={provider}
        className={`provider ${provider}`}
        onClick={() => OnboardingActions.chooseAccountProvider(provider)}
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
        <h3>Add an account to get started</h3>
        <div className="provider-list">{this._renderProviders()}</div>
      </div>
    );
  }
}
