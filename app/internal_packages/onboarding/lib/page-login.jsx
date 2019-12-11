import React from 'react';
import { RetinaImg } from 'mailspring-component-kit';
import OnboardingActions from './onboarding-actions';

export default class LoginPage extends React.Component {
  static displayName = 'LoginPage';

  componentDidMount() {
    const win = AppEnv.getCurrentWindow();
    win.setResizable(true);
    win.maximize();
    // facebook tracking: invite enter page
    AppEnv.trackingEvent('Invite-InitApp');
  }

  _onContinue = () => {
    // facebook tracking: invite login
    AppEnv.trackingEvent('Invite-Login');
    document.querySelector('.page.welcome>div').style.display = 'none';
    OnboardingActions.moveToPage('account-choose');
    setTimeout(() => {
      const win = AppEnv.getCurrentWindow();
      // win.unmaximize();
      win.setSize(685, 700);
      const left = Math.floor((screen.width - 685) / 2);
      const top = Math.floor((screen.height - 700) / 2 - 30);
      win.setPosition(left, top);
      win.setResizable(false);
    }, 10)
  };

  render() {
    return (
      <div className="page welcome">
        <RetinaImg
          className="icons"
          url="edisonmail://onboarding/assets/logo-light.png"
          mode={RetinaImg.Mode.ContentPreserve}
        />
        <div>
          <h1 className="hero-text">Start Using Edison Mail for Mac</h1>
          <p className="hero-subtext">Connect your account to continue using the app</p>
          <button className="btn login-button" onClick={this._onContinue}>
            Connect your account to unlock
        </button>
        </div>
      </div>
    );
  }
}
