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
      loading: false,
    };
    this.email = AppEnv.config.get('invite.email');
  }

  _readyToGo = () => {
    const mainWin = AppEnv.getMainWindow();
    if (mainWin) {
      setTimeout(() => mainWin.destroy(), 3000);
    }

    // facebook tracking: invite success
    AppEnv.trackingEvent('Invite-InviteSuccess');

    OnboardingActions.moveToPage('gdpr-terms');
  };

  componentDidMount = async () => {
    require('electron').ipcRenderer.send('open-main-window-make-onboarding-on-top');
    this.disposable = AppEnv.config.onDidChange(CONFIG_KEY, async () => {
      const shareCounts = AppEnv.config.get(CONFIG_KEY) || 0;
      // AppEnv.getCurrentWindow().setAlwaysOnTop(true);
      if (shareCounts >= 5) {
        this.setState({
          loading: true,
        });
        await AppEnv.checkUnlock(this.email, true);
        this._readyToGo();
        return;
      } else {
        this.setState({
          shareCounts,
        });
      }
    });

    if (this.email) {
      this.setState({
        loading: true,
      });
      const newState = {
        loading: false,
      };
      const checkUnlock = await AppEnv.checkUnlock(this.email);
      if (checkUnlock.status === 'OK') {
        AppEnv.config.set(CONFIG_KEY, 5);
        return;
      } else {
        // facebook tracking: need invite
        AppEnv.trackingEvent('Invite-NeedInvite');

        const count = 5 - (checkUnlock.count || 5);
        AppEnv.config.set(CONFIG_KEY, count);
        newState.shareCounts = count;
      }
      const body = await AppEnv.getUserInviteEmailBody(this.email);
      if (body) {
        newState.body = body;
      }
      this.setState(newState);
    }
  };

  componentWillUnmount() {
    this.disposable.dispose();
  }

  _onContinue = async () => {
    // AppEnv.getCurrentWindow().setAlwaysOnTop(false);
    let { body } = this.state;
    // if body not exists or body has error, fetch body again
    if (!body || body.error) {
      body = await AppEnv.getUserInviteEmailBody(this.email);
      this.setState({ body });
    }
    if (body && !body.error) {
      AppEnv.getCurrentWindow().setAlwaysOnTop(false);
      ipcRenderer.send(
        'command',
        'application:send-share',
        body.subject,
        `<p>${body.text}</p><a href='${body.link + '&from=MacApp'}'>${body.link +
        '&from=MacApp'}</a>`
      );
    }
  };

  render() {
    const { loading, body, shareCounts } = this.state;
    return (
      <div className="page sorry">
        {loading ? (
          <LottieImg
            name={'loading-spinner-blue'}
            height={24}
            width={24}
            style={{ width: 24, height: 24, marginTop: 240 }}
          />
        ) : (
            <div className="steps-container">
              <h1 className="hero-text">You’re on the Waitlist!</h1>
              <p>
                We’re releasing invites as quickly as we can, so we<br />
                appreciate the patience. Refer {5 - shareCounts} {5 - shareCounts > 1 ? 'friends' : 'friend'} to get<br />
                access now.
              </p>
              <br />
              <br />
              <button key="next" className="btn btn-large btn-invite" onClick={this._onContinue}>
                Invite {5 - shareCounts} {5 - shareCounts > 1 ? 'Friends' : 'Friend'}
              </button>
              {body && !body.error ? (
                <a className="invite-link" href={body.link + '&from=MacApp'}>{body.link}</a>
              ) : null}
            </div>
          )}
      </div>
    );
  }
}
