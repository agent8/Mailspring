import React from 'react';
import { MessageWindow } from 'mailspring-component-kit';
import { Actions, Constant } from 'mailspring-exports';
import { ipcRenderer } from 'electron';
const minimumDetailHeight = 28;
export default class MessageWindowRoot extends React.PureComponent {
  static displayName = 'MessageWindowRoot';
  static containerRequired = false;

  constructor(props) {
    super(props);
    this.state = this.defaultState();
    this._mounted = false;
    this._details = null;
  }
  defaultState = () => {
    return {
      title: '',
      detail: '',
      buttons: [
        { label: 'Ok', order: 0, originalIndex: 0 },
        { label: 'Cancel', order: 1, originalIndex: 1 },
      ],
      checkboxLabel: '',
      checkboxChecked: false,
      defaultId: 0,
      cancelId: 1,
      sourceWindowKey: '',
      requestId: '',
    };
  };
  componentDidMount() {
    this._mounted = true;
    ipcRenderer.on('reserveWindow-popout', this._onShowMessages);
  }
  componentDidUpdate(prevProps, prevState, snapshot) {
    AppEnv.logDebug(`requestId ${this.state.requestId}`);
    this._updateBrowserWindowHeight();
    if (this.state.requestId.length > 0) {
      this.windowShow();
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    ipcRenderer.removeListener('reserveWindow-popout', this._onShowMessages);
  }
  _onShowMessages = (
    event,
    {
      title = '',
      details = '',
      checkLabel = '',
      buttons,
      defaultId,
      cancelId,
      targetWindowKey = '',
      sourceWindowKey = '',
      requestId = '',
    } = {}
  ) => {
    // const currentKey = AppEnv.getCurrentWindowKey();
    // if (targetWindowKey !== currentKey) {
    //   AppEnv.logDebug(
    //     `not for current window ${currentKey}, targetWindowKey ${targetWindowKey}, ignoring`
    //   );
    //   return;
    // }
    if (this._mounted) {
      // this._updateBrowserWindowWidth(buttons.length, title.length);
      this.setState({
        title,
        details,
        checkLabel,
        defaultId,
        cancelId,
        buttons,
        sourceWindowKey,
        requestId,
      });
      if (typeof title === 'string' && title.length > 0) {
        AppEnv.setWindowTitle(title);
      }
    }
    AppEnv.logDebug(`MessageWindow: on show Message ${requestId}`);
  };
  _updateBrowserWindowHeight = () => {
    const currentSize = AppEnv.getSize();
    if (this._details) {
      const detailsHeight = this._details.getBoundingClientRect().height;
      const extraHeight = detailsHeight - minimumDetailHeight;
      // console.log(
      //   `update height detailHeight: ${detailsHeight}, current height: ${currentSize.height}, extraHeight: ${extraHeight}`
      // );
      if (
        extraHeight > 0 &&
        currentSize.height - detailsHeight <=
          Constant.MessageWindowSize.height - minimumDetailHeight
      ) {
        currentSize.height += extraHeight;
        AppEnv.setSize(currentSize.width, currentSize.height);
      }
    }
  };
  _updateBrowserWindowWidth = (buttonsSize, titleLength) => {
    const currentSize = AppEnv.getSize();
    const extraTitleLength = Math.ceil((titleLength - 55) * 5.5);
    const extraButtonLength = (buttonsSize - 2) * 112;
    if (extraTitleLength > extraButtonLength && extraTitleLength > 0) {
      currentSize.width += extraTitleLength;
    } else if (extraButtonLength >= extraTitleLength && extraButtonLength > 0) {
      currentSize.width += extraButtonLength;
    }
    AppEnv.setSize(currentSize.width, currentSize.height);
  };
  windowShow = () => {
    AppEnv.center();
    AppEnv.show();
  };
  windowHide = () => {
    AppEnv.hide();
    if (this._mounted) {
      this.setState(this.defaultState());
      AppEnv.setSize(Constant.MessageWindowSize.width, Constant.MessageWindowSize.height);
    }
  };
  _onCancel = () => {
    this.windowHide();
  };
  _onClick = () => {
    this.windowHide();
  };

  render() {
    return <MessageWindow {...this.state} onCanceled={this._onCancel} onClicked={this._onClick} />;
  }
}
