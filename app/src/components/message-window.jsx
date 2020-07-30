import React from 'react';
import { RetinaImg } from 'mailspring-component-kit';
import { Actions } from 'mailspring-exports';
const minimumDetailHeight = 28;
export default class MessageWindow extends React.PureComponent {
  static displayName = 'MessageWindow';
  static defaultProps = {
    onCanceled: () => {},
    onClicked: () => {},
    style: {},
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
  static containerRequired = false;

  constructor(props) {
    super(props);
    this._buttonClicked = false;
    this._mounted = false;
    this._details = null;
    this._timer = null;
  }
  componentDidMount() {
    this._mounted = true;
    Actions.closeMessageWindow.listen(this._onCancel);
    document.body.addEventListener('keydown', this._onKeyPress);
  }

  componentWillUnmount() {
    this._mounted = false;
    document.body.removeListener('keydown', this._onKeyPress);
    Actions.closeMessageWindow.unlisten(this._onCancel);
  }
  _allowButtonClick = () => {
    if (!this._timer) {
      this._timer = setTimeout(() => {
        this._timer = null;
      }, 300);
      return true;
    }
    return false;
  };
  _onCancel = () => {
    Actions.messageWindowReply({
      sourceWindowKey: this.props.sourceWindowKey,
      response: this.props.cancelId,
      checkboxChecked: this.props.checkboxChecked,
      requestId: this.props.requestId,
    });
    this.props.onCanceled();
  };
  _onClick = originalIndex => {
    if (this._allowButtonClick()) {
      Actions.messageWindowReply({
        sourceWindowKey: this.props.sourceWindowKey,
        response: this.props.cancelId,
        checkboxChecked: this.props.checkboxChecked,
        requestId: this.props.requestId,
      });
      this.props.onClicked(originalIndex);
    }
  };
  _onKeyPress = e => {
    //Ignore key press that are part of composition of CJKT character
    //https://developer.mozilla.org/en-US/docs/Web/API/GlobalEventHandlers/onkeydown
    if (e.isComposing || e.keyCode === 229) {
      return;
    }
    if (e.key === 'Escape') {
      this._onCancel();
    } else if (e.key === 'Enter') {
      this._onClick(this.props.defaultId);
    }
  };

  renderButtons() {
    return this.props.buttons.map(button => {
      let className = 'btn';
      if (button.order === 0) {
        className += ' default';
      }
      return (
        <button
          key={button.order}
          className={className}
          style={{ flexOrder: button.order }}
          onClick={this._onClick.bind(this, button.originalIndex)}
        >
          {button.label}
        </button>
      );
    });
  }

  render() {
    return (
      <div className="message-window" onKeyDown={this._onKeyPress} style={this.props.style}>
        <div className="message-area">
          <div className="logo">
            <RetinaImg
              name="logo-edison.png"
              style={{
                width: 40,
                height: 40,
              }}
              mode={RetinaImg.Mode.ContentPreserve}
            />
          </div>
          <div className="text-area">
            <div className="title">{this.props.title}</div>
            <div
              className="details"
              ref={ref => (this._details = ref)}
              style={{ minHeight: minimumDetailHeight }}
            >
              {this.props.details}
            </div>
          </div>
        </div>
        <div className="button-area">{this.renderButtons()}</div>
      </div>
    );
  }
}
