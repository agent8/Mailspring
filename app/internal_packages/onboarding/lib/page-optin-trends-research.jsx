import React from 'react';
import OnboardingActions from './onboarding-actions';
import { AccountStore } from 'mailspring-exports';
import { RetinaImg } from 'mailspring-component-kit';

export default class OptInTrendsResearchPage extends React.Component {
  static displayName = 'OptInTrendsResearchPage';

  constructor(props) {
    super(props);
  }

  componentDidMount() {}

  _onFinish = agree => {
    AppEnv.config.set('core.privacy.dataShare.optOut', agree);
    AppEnv.trackingEvent('Onboarding-OptIn', { agree: !agree });
    OnboardingActions.moveToPage('imporove-data');
  };

  render() {
    return (
      <div className={`page trends-research`}>
        <div className="trends-research-container">
          <img className="logo" src={`edisonmail://onboarding/assets/trends-research.png`} alt="" />
          <h1>Your Privacy is Important.</h1>
          <p className="description">
            Your data makes Edison Mail work and, when permitted, supports our measurement business,
            Edison Trends. We collect information when you sign up and use Edison Mail, like
            commercial messages and purchase receipts. The data is anonymized and its only use is to
            create aggregated research insights. We share this information with third parties and
            prohibit them from using the information for any purpose other than understanding
            e-commerce trends. You can always opt-out of Trends at any time!
          </p>
        </div>
        <div className="footer">
          <button key="no" className="btn btn-large btn-ghost" onClick={() => this._onFinish(true)}>
            No, Thanks
          </button>
          <button
            key="agree"
            className="btn btn-large btn-agree"
            onClick={() => this._onFinish(false)}
          >
            Agree
          </button>
        </div>
      </div>
    );
  }
}
