import { clipboard, remote, ipcRenderer } from 'electron';
import OnboardingActions from './onboarding-actions';
import { React, ReactDOM, PropTypes } from 'mailspring-exports';
import { RetinaImg, LottieImg } from 'mailspring-component-kit';
import LoginErrorPage from './page-login-error';
import http from 'http';
import url from 'url';

import FormErrorMessage from './form-error-message';
import { LOCAL_SERVER_PORT } from './onboarding-helpers';
const INVITE_COUNT_KEY = 'invite.count';
const OPEN_BROWSER_PROVIDERS = ['google', 'outlook', 'yahoo', 'office365', 'jira'];

export default class OAuthSignInPage extends React.Component {
  static displayName = 'OAuthSignInPage';

  static propTypes = {
    /**
     * Step 1: Open a webpage in the user's browser letting them login on
     * the native provider's website. We pass along a key and a redirect
     * url to a Nylas-owned server
     */
    providerAuthPageUrl: PropTypes.string,
    buildAccountFromAuthResponse: PropTypes.func,
    onSuccess: PropTypes.func,
    onTryAgain: PropTypes.func,
    iconName: PropTypes.string,
    sessionKey: PropTypes.string,
    serviceName: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this._mounted = false;
    this.randomNum = window.crypto.getRandomValues(new Uint32Array(1))[0];
    this.state = {
      authStage: 'initial',
      showAlternative: false,
      open: false,
      url: null,
      loading: true,
      isYahoo: /yahoo/g.test(props.providerAuthPageUrl),
    };
  }

  _openInWebView(url) {
    this.setState({
      open: true,
      url,
      authStage: 'initial',
    });
  }

  componentDidUpdate() {
    const { authStage } = this.state;
    const back = document.querySelector('.back');
    if (back) {
      if (['buildingAccount', 'accountSuccess'].includes(authStage)) {
        back.style.display = 'none';
      } else {
        back.style.display = 'block';
      }
    }
  }

  needOpenInBrowser(serviceName) {
    serviceName = serviceName.toLowerCase();
    if (OPEN_BROWSER_PROVIDERS.includes(serviceName)) {
      return true;
    }
    if (serviceName === 'jira' && !process.mas) {
      return true;
    }
    // else if (serviceName === 'google') {
    //   return true;
    // }
    return false;
  }

  componentDidMount() {
    ipcRenderer.on('oauth-redirect-url', (e, { url }) => this.processRedirectUrlFromBrowser(url));
    this._setupWebview();
    const serviceName = this.props.serviceName.toLowerCase();

    // Show the "Sign in to ..." prompt for a moment before bouncing
    // to URL. (400msec animation + 200msec to read)
    this._mounted = true;
    this._startTimer = setTimeout(() => {
      if (!this._mounted) return;
      // shell.openExternal(this.props.providerAuthPageUrl);
      if (this.needOpenInBrowser(serviceName)) {
        this.openBrowser();
      } else {
        this._openInWebView(this.props.providerAuthPageUrl);
      }
    }, 600);
    this._warnTimer = setTimeout(() => {
      if (!this._mounted) return;
      this.setState({ showAlternative: true });
    }, 1500);

    // if not running in mas mode, launch a web server
    if (!process.mas && !this.needOpenInBrowser(serviceName)) {
      this._server = http.createServer((request, response) => {
        if (!this._mounted) return;
        const { query } = url.parse(request.url, { querystring: true });
        if (query.code) {
          this._onReceivedCode(query.code);
          // when oauth succeed, display Edison homepage
          response.writeHead(302, { Location: 'http://email.easilydo.com' });
          response.end();
        } else if (query.error === 'access_denied') {
          OnboardingActions.moveToPage('account-choose');
          return;
        } else {
          response.end('Unknown Request');
        }
      });
      this._server.listen(LOCAL_SERVER_PORT, err => {
        if (err) {
          AppEnv.showErrorDialog({
            title: 'Unable to Start Local Server',
            message: `To listen for the Oauth response, Edison Mail needs to start a webserver on port ${LOCAL_SERVER_PORT}. Please go back and try linking your account again. If this error persists, use the IMAP/SMTP option with an App Password.\n\n${err}`,
          });
          return;
        }
      });
    }
  }

  processRedirectUrlFromBrowser = redirectUrl => {
    const { query } = url.parse(redirectUrl, { querystring: true });
    if (query.code) {
      this._onReceivedCode(query.code);
      return;
    }
  };

  componentWillUnmount() {
    this._mounted = false;
    if (this._startTimer) clearTimeout(this._startTimer);
    if (this._warnTimer) clearTimeout(this._warnTimer);
    if (this._server) this._server.close();
  }

  moveToLoginError(err) {
    // OnboardingActions.moveToPage('login-error');
    this.setState(Object.assign({ loading: false }, err));
  }

  _onError(err) {
    this.moveToLoginError({ authStage: 'error', errorMessage: err.message });
    AppEnv.reportError(err, { oAuthURL: this.props.providerAuthPageUrl });
  }

  async _onReceivedCode(code) {
    if (!this._mounted) return;
    AppEnv.focus();
    this.setState({ authStage: 'buildingAccount' });
    let account = null;
    try {
      account = await this.props.buildAccountFromAuthResponse(code);
    } catch (err) {
      // if (AppEnv.config.get(INVITE_COUNT_KEY) === undefined) {
      //   AppEnv.trackingEvent('Invite-AddAccount-Failed', { provider: this.props.serviceName });
      // } else {
      AppEnv.trackingEvent('AddAccount-Failed', { provider: this.props.serviceName });
      // }
      if (!this._mounted) return;
      this._onError(err);
      return;
    }
    if (!this._mounted) return;
    this.setState({ authStage: 'accountSuccess' });
    setTimeout(() => {
      if (!this._mounted) return;
      this.props.onSuccess(account);
    }, 1000);
  }

  _renderHeader() {
    const authStage = this.state.authStage;
    if (authStage === 'initial') {
      return (
        <h2>
          Sign in with {this.props.serviceName} in
          <br />
          your browser.
        </h2>
      );
    }
    if (authStage === 'buildingAccount') {
      return <h2>Connecting to {this.props.serviceName}…</h2>;
    }
    if (authStage === 'accountSuccess') {
      return (
        <div className="auth-success">
          <h2>Successfully connected to {this.props.serviceName}!</h2>
          <h3>Adding your account to Edison Mail…</h3>
        </div>
      );
    }
    return <div />;

    // Error
    // return (
    //   <div>
    //     <h2>Sorry, we had trouble logging you in</h2>
    //     <div className="error-region">
    //       <FormErrorMessage message={this.state.errorMessage} />
    //       <div className="btn" style={{ marginTop: 20 }} onClick={this.props.onTryAgain}>
    //         Try Again
    //       </div>
    //     </div>
    //   </div>
    // );
  }

  _renderAlternative() {
    let classnames = 'input hidden';
    if (this.state.showAlternative) {
      classnames += ' fadein';
    }

    return (
      <div className="alternative-auth">
        <div className={classnames}>
          <div style={{ marginTop: 40 }}>
            Page didn&#39;t open? Paste this URL into your browser:
          </div>
          <input
            type="url"
            className="url-copy-target"
            value={this.props.providerAuthPageUrl}
            readOnly
          />
          <div
            className="copy-to-clipboard"
            onClick={() => clipboard.writeText(this.props.providerAuthPageUrl)}
            onMouseDown={() => this.setState({ pressed: true })}
            onMouseUp={() => this.setState({ pressed: false })}
          >
            <RetinaImg name="icon-copytoclipboard.png" mode={RetinaImg.Mode.ContentIsMask} />
          </div>
        </div>
      </div>
    );
  }

  _onConsoleMessage = e => {
    // console.log('*****webview: ' + e.message);
    if (e.message === 'move-to-account-choose') {
      OnboardingActions.moveToPage('account-choose');
    } else if (e.message === 'oauth page go to blur') {
      this.refs.webview.blur();
    }
  };
  _pasteIntoWebview = () => {
    const contents = this.refs.webview;
    contents.insertText(clipboard.readText());
  };
  _selectAllInWebview = () => {
    const contents = this.refs.webview;
    contents.selectAll();
  };

  _webviewDidFailLoad = event => {
    // if running in mas mode
    if (event.validatedURL && event.validatedURL.indexOf('127.0.0.1') !== -1) {
      if (!this._mounted) return;
      const { query } = url.parse(event.validatedURL, { querystring: true });
      if (query.code) {
        this._onReceivedCode(query.code);
        return;
      } else if (query.error === 'access_denied') {
        OnboardingActions.moveToPage('account-choose');
        return;
      }
    }
    // For some reason, oauth page will cause webview to throw load-did-fail with errorCode
    // Yahoo
    // -3
    // -105:RR_NAME_NOT_RESOLVED Yahoo try to connect opus.analytics.yahoo.com
    // Gmail
    // -21:ERR_NETWORK_CHANGED Gmail oauth try to connect youtube
    // -100:ERR_CONNECTION_CLOSED Gmail oauth try to connect youtube
    // -101:ERR_CONNECTION_RESET Gmail oauth try to connect youtube
    // -102:ERR_CONNECTION_REFUSED Gmail oauth try to connect youtube
    // -324:ERR_EMPTY_RESPONSE Gmail oauth try to connect youtube
    // navigating to permission granting view. Thus we want to capture that and ignore it.
    if (
      event &&
      (event.errorCode === -3 ||
        event.errorCode === -324 ||
        event.validatedURL.includes('youtube.com') ||
        event.validatedURL.includes('analytics.yahoo'))
    ) {
      AppEnv.reportError(new Error('webview failed to load skip this error'), {
        oAuthURL: this.props.providerAuthPageUrl,
        oAuthEvent: event,
      });
      return;
    }
    let errorMessage = `${event.errorCode}:${event.errorDescription}`;
    this.moveToLoginError({
      authStage: 'error',
      errorMessage,
    });
    AppEnv.reportError(new Error('webview failed to load'), {
      oAuthURL: this.props.providerAuthPageUrl,
      oAuthEvent: event,
    });
  };

  _setupWebview = () => {
    const webview = ReactDOM.findDOMNode(this.refs.webview);
    if (!webview) {
      return;
    }
    const listeners = {
      'did-fail-load': this._webviewDidFailLoad,
      'did-finish-load': this._loaded,
      // 'did-get-response-details': this._webviewDidGetResponseDetails,
      'console-message': this._onConsoleMessage,
      'core:paste': this._pasteIntoWebview,
      'core:select-all': this._selectAllInWebview,
    };

    for (const event of Object.keys(listeners)) {
      webview.removeEventListener(event, listeners[event]);
    }
    for (const event of Object.keys(listeners)) {
      webview.addEventListener(event, listeners[event]);
    }

    // if (this.state.isYahoo) {
    //   webview.setAttribute('preload', '../internal_packages/onboarding/lib/oauth-inject-yahoo.js');
    //   webview.getWebContents().executeJavaScript(`
    //   function deleteAllCookies() {
    //       var cookies = document.cookie.split(";");
    //       if (cookies.length > 0) {
    //           for (var i = 0; i < cookies.length; i++) {
    //               var cookie = cookies[i];
    //               var eqPos = cookie.indexOf("=");
    //               var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
    //               name = name.trim();
    //               document.cookie = name + "=;expires=" + new Date(0).toUTCString() + "; path=/; domain=.yahoo.com";
    //           }
    //       }
    //   }
    //   deleteAllCookies();
    // `, false, () => {
    //     webview.reload();
    //   });
    // }
  };

  _loaded = () => {
    if (this.refs.webview.src.indexOf('signin/rejected') !== -1) {
      AppEnv.reportError(
        new Error(`Oauth error: signin/rejected, url is:` + this.refs.webview.src)
      );
    }
    this.setState({
      loading: false,
    });
  };

  openBrowser = () => {
    remote.shell.openExternal(this.props.providerAuthPageUrl);
  };

  render() {
    const { authStage, loading, isYahoo } = this.state;
    const defaultOptions = {
      height: '100%',
      width: '100%',
      position: 'fixed',
      top: 0,
      bottom: 0,
      zIndex: 2,
    };
    const yahooOptions = {
      width: '80%',
      height: '100%',
      position: 'fixed',
      top: 0,
      left: '10%',
      zIndex: 2,
      paddingTop: 20,
    };
    const Validating = (
      <div className="validating">
        <h2>Validating...</h2>
        <p>
          Please wait while we validate
          <br />
          your account.
        </p>
        <LottieImg
          name="loading-spinner-blue"
          size={{ width: 65, height: 65 }}
          style={{ margin: '0 auto' }}
        />
      </div>
    );
    const Success = (
      <div className="success">
        <h2>Success!</h2>
        <RetinaImg
          style={{ width: 65, height: 65, fontSize: 65 }}
          isIcon
          name="check-alone.svg"
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
    const serviceName = this.props.serviceName.toLowerCase();
    let wbView;
    let loadingImg;
    if (this.needOpenInBrowser(serviceName)) {
      wbView = (
        <div className="jira-oauth-title">
          <h2>Sign in with your browser.</h2>
          {serviceName === 'office365' && (
            <a
              className="sign-with-imap"
              onClick={() => OnboardingActions.chooseAccountProvider('office365')}
            >
              Trouble using your browser to sign in? Try signing in here instead.
            </a>
          )}
        </div>
      );
    } else {
      wbView = (
        <webview
          useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
          key={this.randomNum}
          ref="webview"
          src={this.state.url}
          partition={`in-memory-only${this.randomNum}`}
          style={isYahoo ? yahooOptions : defaultOptions}
        />
      );
      loadingImg = (
        <LottieImg
          name="loading-spinner-blue"
          size={{ width: 65, height: 65 }}
          style={{ margin: '200px auto 0' }}
        />
      );
    }
    return (
      <div className={`page account-setup oauth ${serviceName}`}>
        {this.needOpenInBrowser(serviceName) && (
          <div title="Open browser" className="oauth-browser-btn" onClick={this.openBrowser}>
            <RetinaImg
              name="popout.svg"
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
              style={{ width: 24, height: 24, fontSize: 24 }}
            />
          </div>
        )}
        {authStage === 'buildingAccount' && Validating}
        {authStage === 'accountSuccess' && Success}
        {!['buildingAccount', 'accountSuccess', 'error'].includes(authStage) && wbView}
        {loading &&
          !['buildingAccount', 'accountSuccess', 'error'].includes(authStage) &&
          loadingImg}
        {authStage === 'error' && <LoginErrorPage errorMessage={this.state.errorMessage} />}
      </div>
    );
  }
}
