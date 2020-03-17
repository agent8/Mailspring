import React from 'react';
import PropTypes from 'prop-types';
import { ChatActions } from 'chat-exports';
import { MessageSend } from 'chat-exports';
import ContactAvatar from '../common/ContactAvatar';
import MessageApp from './MessageApp';
import MessagePrivateApp from './MessagePrivateApp';
import MessageItemBody from './MessageItemBody';
import { FILE_TYPE } from '../../utils/filetypes';
import { colorForString } from '../../utils/colors';
import { name } from '../../utils/name';
const { DateUtils } = require('mailspring-exports');

export default class MessageItem extends React.Component {
  static propTypes = {
    msg: PropTypes.shape({
      id: PropTypes.string.isRequired,
      conversationJid: PropTypes.string.isRequired,
      sender: PropTypes.string.isRequired,
      body: PropTypes.object.isRequired,
      sentTime: PropTypes.number.isRequired,
      status: PropTypes.string.isRequired,
    }).isRequired,
    conversation: PropTypes.shape({
      jid: PropTypes.string.isRequired,
      isGroup: PropTypes.bool.isRequired,
    }),
  };

  static timer;

  constructor(props) {
    super(props);
    this.state = { isEditing: false, file_downloaded: false };
    this.getContactInfoByJid = this.getContactInfoByJid.bind(this);
    this.getContactAvatar = this.getContactAvatar.bind(this);
    this.getMessageClasses = this.getMessageClasses.bind(this);
    this.senderContact = this.senderContact.bind(this);
    this.retrySend = this.retrySend.bind(this);
  }

  componentDidMount() {
    this.unlisten = ChatActions.updateProgress.listen(this.updateProgress, this);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    //   const newState = this.receiveProps(nextProps);
    //   this.setState(newState, () => {
    //     // if has span tag, that's no need to run emoji process
    //     if (this.contentEl && this.contentEl.innerHTML.indexOf('<span role="img"') === -1) {
    //       this.contentEl.innerHTML = a11yEmoji(this.contentEl.innerHTML);
    //     }
    //   });
    // console.log('===========1111', nextProps.msg);
  }

  // TODO
  //   shouldComponentUpdate(nextProps, nextState) {
  //     return (
  //       this.props.msg.body.content !== nextProps.msg.body.content ||
  //       this.props.msg.siblings !== nextProps.msg.siblings ||
  //       //   this.props.msg.siblings.length !== nextProps.msg.siblings.length ||
  //       this.state.isEditing !== nextState.isEditing
  //     );
  //   }

  componentWillUnmount() {
    this.unlisten && this.unlisten();
  }

  getContactInfoByJid(jid) {
    return this.props.getContactInfoByJid(jid);
  }

  getContactAvatar(member) {
    const { conversation } = this.props;
    if (member) {
      const memberJid = typeof member.jid === 'object' ? member.jid.bare : member.jid;
      return (
        <ContactAvatar
          jid={memberJid}
          name={member.name}
          conversation={conversation}
          email={member.email}
          avatar={member.avatar}
          size={32}
        />
      );
    }
    return null;
  }

  updateProgress(progress) {
    const { msgBody } = this.props.msg;
    if (
      progress.finished &&
      msgBody.mediaObjectId &&
      msgBody.mediaObjectId === progress.mediaObjectId
    ) {
      this.setState({
        file_downloaded: true,
      });
    }
  }

  getMessageClasses(currentUserJid) {
    const { msg } = this.props;
    const { isEditing } = this.state;
    const isCurrentUser = msg.sender === currentUserJid;
    const isMessageFail = msg.status === 'MESSAGE_STATUS_TRANSFER_FAILED' && isCurrentUser;

    const messageStyles = ['message'];

    if (msg.sender === currentUserJid) {
      messageStyles.push('currentUser');
    } else {
      messageStyles.push('otherUser');
    }
    if (isEditing) {
      messageStyles.push('editing');
    }
    if (isMessageFail) {
      messageStyles.push('message-fail');
    }

    return messageStyles.join(' ');
  }

  senderContact() {
    const { msg } = this.props;
    return this.getContactInfoByJid(msg.sender);
  }

  get senderName() {
    const { msg } = this.props;
    // const member = this.senderContact();
    return name(msg.sender);
  }

  retrySend() {
    const { msg, conversation } = this.props;
    const { msgBody } = this.props.msg;
    if (msgBody.failMessage) {
      msgBody.failMessage = '';
      msgBody.type = msgBody.path ? FILE_TYPE.IMAGE : FILE_TYPE.TEXT;
    }
    if (msgBody.localFile && !msgBody.uploadFailed) {
      const loadConfig = {
        conversation,
        messageId: msg.id,
        msgBody,
        filepath: msgBody.localFile,
        type: 'upload',
      };
      const { queueLoadMessage } = this.props;
      queueLoadMessage(loadConfig);
    } else {
      MessageSend.sendMessage(msgBody, conversation, msg.id);
    }
  }

  renderMsgSibings(siblings) {
    const { conversation, queueLoadMessage } = this.props;

    if (siblings) {
      return siblings.map(msg => (
        <MessageItemBody
          msg={msg}
          key={msg.id}
          conversation={conversation}
          getContactInfoByJid={this.getContactInfoByJid}
          onEdit={() => {
            this.setState({ isEditing: !this.state.isEditing });
          }}
          queueLoadMessage={queueLoadMessage}
        ></MessageItemBody>
      ));
    }
    return null;
  }

  render() {
    const { msg, conversation, queueLoadMessage } = this.props;
    const msgBody = msg.body;
    const { currentUserJid } = conversation;
    const isCurrentUser = msg.sender === currentUserJid;
    const color = colorForString(msg.sender);
    const member = this.senderContact();
    const senderName = this.senderName;
    const messageFail = msg.status === 'MESSAGE_STATUS_TRANSFER_FAILED' && isCurrentUser;
    let key = msg.id + '_' + msg.updatedAt.getTime();

    if (msgBody.deleted) {
      return null;
    }

    if (msgBody.isAppprivateCommand) {
      return (
        <MessagePrivateApp
          msg={msg}
          userId={currentUserJid}
          conversation={conversation}
          getContactInfoByJid={this.getContactInfoByJid}
          getContactAvatar={this.getContactAvatar}
          key={key}
        />
      );
    }

    if (msgBody.appJid) {
      return (
        <MessageApp
          msg={msg}
          userId={currentUserJid}
          conversation={conversation}
          getContactInfoByJid={this.getContactInfoByJid}
          getContactAvatar={this.getContactAvatar}
          key={key}
        />
      );
    }

    const className = this.getMessageClasses(currentUserJid);

    return (
      <div key={key} className={className} style={{ borderColor: color }}>
        <div className="messageIcons">
          {messageFail ? <div className="messageFailed" title="Not Delivered" /> : null}
          <div className="messageSender">{this.getContactAvatar(member)}</div>
        </div>
        <div className="message-content">
          <div className="message-header">
            <span className="username">{senderName}</span>
            <span className="time">{DateUtils.shortTimeString(msg.sentTime)}</span>
          </div>
          {/* {this.props.messageBody} */}
          <MessageItemBody
            msg={msg}
            conversation={conversation}
            getContactInfoByJid={this.getContactInfoByJid}
            onEdit={() => {
              this.setState({ isEditing: !this.state.isEditing });
            }}
            queueLoadMessage={queueLoadMessage}
          ></MessageItemBody>
          {this.renderMsgSibings(msg.siblings)}
        </div>
        {messageFail ? (
          <div className="message-retry" onClick={this.retrySend}>
            Try Again
          </div>
        ) : null}
      </div>
    );
  }
}
