import React from 'react';
import { ReactDOM, Actions } from 'mailspring-exports';
export default class ICloudAppTokenRoot extends React.PureComponent {
  static displayName = 'ICloudAppTokenRoot';
  static containerRequired = false;

  constructor(props) {
    super(props);
    this.state = {};
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
      // 'did-finish-load': this._loaded,
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
    webview.setAttribute(
      'preload',
      '../internal_packages/icloud-app-token/lib/oauth-inject-iclound.js'
    );
  };

  _onConsoleMessage = e => {
    console.log('*****webview: ', e.message);
    if (e.message.includes('icloud')) {
      const token = e.message.split(':')[1];
      // send the token to onboarding window
      Actions.transfterICloudToken(token);
      setTimeout(AppEnv.close, 100);
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
    return (
      <webview
        useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36"
        ref="webview"
        src={'https://appleid.apple.com/#!&page=signin'}
        partition={`in-memory-only`}
        style={defaultOptions}
      />
    );
  }
}
