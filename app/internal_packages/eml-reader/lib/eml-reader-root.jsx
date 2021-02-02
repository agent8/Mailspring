import fs from 'fs';
import React from 'react';
import { simpleParser } from 'mailparser';
import { RetinaImg, EventedIFrame } from 'mailspring-component-kit';
import { EmailAvatar } from 'mailspring-exports';
import { convertToMessage } from './utils';
import MessageParticipants from '../../message-list/lib/message-participants';
import classNames from 'classnames';
import EmailFrame from '../../message-list/lib/email-frame';
export default class EmlReaderRoot extends React.PureComponent {
  static displayName = 'EmlReaderRoot';
  static containerRequired = false;

  constructor(props) {
    super(props);
    const windowProps = AppEnv.getWindowProps();
    this.filePath = windowProps.filePath;
    this.accountId = windowProps.accountId;
    this.state = {
      message: null,
      detailedHeaders: false,
    };
    this.mounted = false;
  }

  parseEml = () => {
    if (typeof this.filePath === 'string' && this.filePath.length > 0) {
      const emlStream = fs.createReadStream(this.filePath);
      simpleParser(emlStream)
        .then(this.convertFromMailToMessage)
        .catch(err => {
          AppEnv.logError(err);
        });
    }
  };
  convertFromMailToMessage = mail => {
    const msg = convertToMessage(mail, this.accountId);
    if (this.mounted) {
      this.setState({ message: msg });
    }
  };

  componentDidMount() {
    AppEnv.center();
    AppEnv.displayWindow();
    this.mounted = true;
    this.parseEml();
  }
  componentWillUnmount() {
    this.mounted = false;
  }
  _renderSubject() {
    let subject = this.state.message.subject;
    if (!subject || subject.length === 0) {
      subject = '(No Subject)';
    }
    return (
      <div className="message-subject-wrap">
        <div style={{ flex: 1, flexWrap: 'wrap' }}>
          <span className="message-subject">{subject}</span>
        </div>
      </div>
    );
  }
  _onClickParticipants = e => {
    let el = e.target;
    while (el !== e.currentTarget) {
      if (el.classList.contains('collapsed-participants')) {
        this.setState({ detailedHeaders: !this.state.detailedHeaders });
        e.stopPropagation();
        return;
      }
      el = el.parentElement;
    }
    e.stopPropagation();
    return;
  };
  _toggleHeaderDetail = e => {
    e.stopPropagation();
    this.setState({ detailedHeaders: !this.state.detailedHeaders });
  };
  _renderHeaderDetailToggle() {
    if (this.props.pending) {
      return null;
    }

    return (
      <div
        className={classNames({
          inactive: !this.state.detailedHeaders,
          'header-toggle-control': true,
        })}
        onClick={this._toggleHeaderDetail}
      >
        <RetinaImg
          name={'down-arrow.svg'}
          style={{ width: 16, height: 16, fontSize: 16 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }
  _renderEmailAvatar() {
    return (
      <EmailAvatar
        key="thread-avatar"
        message={this.props.message}
        messagePending={this.props.pending}
      />
    );
  }

  _renderHeader() {
    const { message } = this.state;
    return (
      <header
        ref={el => (this._headerEl = el)}
        className={`message-header `}
        onClick={this._onClickHeader}
      >
        <div className="row">
          {this._renderEmailAvatar()}
          <div style={{ flex: 1, width: 0 }}>
            <div className="participants-to">
              <MessageParticipants
                from={message.from}
                onClick={this._onClickParticipants}
                isDetailed={this.state.detailedHeaders}
              >
                {this._renderHeaderDetailToggle()}
              </MessageParticipants>
            </div>
            <MessageParticipants
              date={message.date}
              detailFrom={message.from}
              to={message.to}
              cc={message.cc}
              bcc={message.bcc}
              isBlocked={false}
              replyTo={message.replyTo.filter(c => !message.from.find(fc => fc.email === c.email))}
              onClick={this._onClickParticipants}
              isDetailed={false}
            >
              {this._renderHeaderDetailToggle()}
            </MessageParticipants>
          </div>
        </div>
        {this.state.detailedHeaders && (
          <div className="row with-border">
            <MessageParticipants
              date={message.date}
              detailFrom={message.from}
              to={message.to}
              cc={message.cc}
              bcc={message.bcc}
              isBlocked={false}
              replyTo={message.replyTo.filter(c => !message.from.find(fc => fc.email === c.email))}
              onClick={this._onClickParticipants}
              isDetailed={this.state.detailedHeaders}
            >
              {this._renderHeaderDetailToggle()}
            </MessageParticipants>
          </div>
        )}
        {/* {this._renderFolder()} */}
      </header>
    );
  }

  render() {
    if (!this.state.message) {
      return <span />;
    }
    return (
      <div className="page-frame message-list" id="message-list">
        {this._renderSubject()}
        {this._renderHeader()}
        <EmailFrame
          showQuotedText={true}
          content={this.state.message.body}
          message={this.state.message}
          pending={false}
          messageIndex={0}
          viewOriginalEmail={false}
          downloads={{}}
        />
      </div>
    );
  }
}
