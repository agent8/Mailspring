import React from 'react';
import { LottieImg } from 'mailspring-component-kit';
import OnboardingActions from './onboarding-actions';
import { ipcRenderer } from 'electron';

const CONFIG_KEY = 'invite.count';
export default class SorryPage extends React.Component {
  static displayName = 'SorryPage';

  constructor(props) {
    super(props);
    this.state = {
      shareCounts: AppEnv.config.get(CONFIG_KEY) || 0,
      body: AppEnv.config.get('invite.body'),
      loading: false
    }
    this.email = AppEnv.config.get('invite.email');
  }

  _readyToGo = () => {
    const mainWin = AppEnv.getMainWindow();
    if (mainWin) {
      setTimeout(() => mainWin.destroy(), 3000);
    }
    OnboardingActions.moveToPage('gdpr-terms');
  }

  componentDidMount = async () => {
    require('electron').ipcRenderer.send('open-main-window-make-onboarding-on-top');
    this.disposable = AppEnv.config.onDidChange(CONFIG_KEY, async () => {
      const shareCounts = AppEnv.config.get(CONFIG_KEY) || 0;
      // AppEnv.getCurrentWindow().setAlwaysOnTop(true);
      if (shareCounts >= 5) {
        this.setState({
          loading: true
        });
        await AppEnv.checkUnlock(this.email, true);
        this._readyToGo();
        return;
      } else {
        this.setState({
          shareCounts
        });
      }
    });

    if (this.email) {
      this.setState({
        loading: true
      })
      const newState = {
        loading: false
      }
      const checkUnlock = await AppEnv.checkUnlock(this.email);
      if (checkUnlock.status === 'OK') {
        AppEnv.config.set(CONFIG_KEY, 5);
        return;
      } else {
        const count = 5 - (checkUnlock.count || 0);
        AppEnv.config.set(CONFIG_KEY, count);
        newState.shareCounts = count;
      }
      const body = await AppEnv.getUserInviteEmailBody(this.email);
      if (body) {
        newState.body = body
      }
      this.setState(newState)
    }
  }

  componentWillUnmount() {
    this.disposable.dispose();
  }

  _onContinue = () => {
    // AppEnv.getCurrentWindow().setAlwaysOnTop(false);
    const { body } = this.state;
    if (body && !body.error) {
      AppEnv.getCurrentWindow().setAlwaysOnTop(false);
      ipcRenderer.send('command', 'application:send-share', `<br/><p>${body.text}</p><a href='${body.link + "&from=MacApp"}'>${body.link + "&from=MacApp"}</a>`);
    }
  };

  render() {
    const { loading, body, shareCounts } = this.state;
    return (
      <div className="page sorry">
        {
          loading ? (
            <LottieImg
              name={'loading-spinner-blue'}
              height={24} width={24}
              style={{ width: 24, height: 24, marginTop: 240 }} />
          ) : (
              <div className="steps-container">
                <h1 className="hero-text">Sorry</h1>
                <p>
                  <span className="email">{this.email}</span>address has not yet been accepted<br />
                  into the private beta. We are trying our best to<br />
                  accept new users as fast as possible.
                </p>
                <br />
                <br />
                <p>
                  Refer {5 - shareCounts} {5 - shareCounts > 1 ? 'friends' : 'friend'} to get access now.<br /><br />
                  {
                    body && !body.error ? (
                      <a href={body.link + "&from=MacApp"}>{body.link + "&from=MacApp"}</a>
                    ) : null
                  }
                </p>
                <button key="next" className="btn btn-large btn-invite" onClick={this._onContinue}>Invite Friends</button>

              </div>
            )
        }
      </div>
    );
  }
}
