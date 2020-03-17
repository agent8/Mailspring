import React from 'react';
import { AccountStore } from 'mailspring-exports';
import { LottieImg } from 'mailspring-component-kit';
import OnboardingActions from './onboarding-actions';
import { ipcRenderer } from 'electron';

const CONFIG_KEY = 'invite.count';
const NEED_INVITE_COUNT = 3;
export default class SorryPage extends React.Component {
  static displayName = 'SorryPage';

  constructor(props) {
    super(props);
    this.state = {
      shareCounts: AppEnv.config.get(CONFIG_KEY) || 0,
      body: AppEnv.config.get('invite.body'),
      loading: false,
      fetchingBody: false
    };
    this.email = AppEnv.config.get('invite.email');
    if (!this.email) {
      const accounts = AccountStore.accounts();
      if (accounts && accounts.length) {
        this.email = accounts[0].emailAddress;
      }
    }
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
    // if mac store version, don't need invite
    if (process.mas) {
      console.log('*****this is a mas build, go to next page');
      AppEnv.config.set(CONFIG_KEY, NEED_INVITE_COUNT);
      OnboardingActions.moveToPage('gdpr-terms');
      return;
    }
    this.disposable = AppEnv.config.onDidChange(CONFIG_KEY, async () => {
      const shareCounts = AppEnv.config.get(CONFIG_KEY) || 0;
      // AppEnv.getCurrentWindow().setAlwaysOnTop(true);
      // beta invite flow
      if (shareCounts >= NEED_INVITE_COUNT) {
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
        AppEnv.config.set(CONFIG_KEY, NEED_INVITE_COUNT);
        return;
      } else {
        // facebook tracking: need invite
        AppEnv.trackingEvent('Invite-NeedInvite');

        let count = NEED_INVITE_COUNT - (checkUnlock.count || NEED_INVITE_COUNT);
        if (count < 0) {
          count = 0;
        }
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
    if (this.disposable) {
      this.disposable.dispose();
    }
  }

  _onContinue = async () => {
    // AppEnv.getCurrentWindow().setAlwaysOnTop(false);
    let { body } = this.state;
    // if body not exists or body has error, fetch body again
    this.setState({ fetchingBody: true });
    if (!body || body.error) {
      body = await AppEnv.getUserInviteEmailBody(this.email);
      this.setState({ body });
    }
    this.setState({ fetchingBody: false });
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
    const { loading, body, shareCounts, fetchingBody } = this.state;
    const needInvite = NEED_INVITE_COUNT - shareCounts;
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
                appreciate the patience. Refer {needInvite} {needInvite > 1 ? 'friends' : 'friend'} to get<br />
                access now.
              </p>
              <br />
              <br />
              <button
                key="next"
                disabled={fetchingBody ? true : false}
                className={`btn btn-large btn-invite ${fetchingBody ? 'btn-disabled' : ''}`}
                onClick={this._onContinue}
              >
                Invite {needInvite} {needInvite > 1 ? 'Friends' : 'Friend'}
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
