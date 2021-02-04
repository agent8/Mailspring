import React from 'react';
import { ReactDOM, Actions } from 'mailspring-exports';
import { LottieImg } from 'mailspring-component-kit';
import { clipboard } from 'electron';
export default class ICloudAppTokenRoot extends React.PureComponent {
  static displayName = 'ICloudAppTokenRoot';
  static containerRequired = false;

  constructor(props) {
    super(props);
    this.state = {
      status: '',
    };
  }
  UNSAFE_componentWillMount() {}

  componentDidMount() {
    this._setupWebview();
  }
  componentWillUnmount() {}
  _setupWebview = () => {
    const webview = ReactDOM.findDOMNode(this.refs.webview);
    if (!webview) {
      return;
    }
    const listeners = {
      // 'did-fail-load': this._webviewDidFailLoad,
      // 'did-finish-load': () => {
      //   webview.openDevTools();
      // },
      // 'did-get-response-details': this._webviewDidGetResponseDetails,
      // 'console-message': this._onConsoleMessage,
      'ipc-message': this._onMessage,
      'core:paste': this._pasteIntoWebview,
      'core:select-all': this._selectAllInWebview,
    };

    for (const event of Object.keys(listeners)) {
      webview.removeEventListener(event, listeners[event]);
    }
    for (const event of Object.keys(listeners)) {
      webview.addEventListener(event, listeners[event]);
    }
    webview.setAttribute(
      'preload',
      '../internal_packages/icloud-app-token/lib/oauth-inject-iclound.js'
    );
  };

  _onConsoleMessage = e => {
    console.log('*****_onConsoleMessage: ', e.message);
  };

  _onMessage = e => {
    if (e.channel === 'token') {
      const message = e.args ? e.args[0] : '';
      const userName = message.split('$edo$')[0];
      const token = message.split('$edo$')[1];
      // send the token to onboarding window
      Actions.transfterICloudToken(userName, token);
      setTimeout(() => AppEnv.close(), 100);
    } else if (e.channel === 'loading') {
      this.setState({
        status: 'loading',
      });
    } else if (e.channel === 'error') {
      this.setState({
        status: 'error',
      });
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

  render() {
    const defaultOptions = {
      height: '100%',
      width: '100%',
      position: 'fixed',
      top: 0,
      bottom: 0,
      zIndex: 2,
    };
    const { status } = this.state;
    if (status === 'loading') {
      defaultOptions.display = 'none';
    }
    return (
      <div className="icloud-app-token-root">
        {status === 'loading' && (
          <LottieImg
            name={'loading-spinner-blue'}
            height={40}
            width={40}
            style={{ width: 40, height: 40 }}
          />
        )}
        <webview
          useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
          ref="webview"
          src={'https://appleid.apple.com/#!&page=signin'}
          partition={`in-memory-only`}
          style={defaultOptions}
        />
      </div>
    );
  }
}
