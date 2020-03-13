import React, { Component } from 'react';
import path from 'path';
import fs from 'fs';
import { RetinaImg } from 'mailspring-component-kit';
import MessageEditBar from './MessageEditBar';
import { FILE_TYPE, isImage } from '../../utils/filetypes';
import MessageText from '../common/MessageText';
// import a11yEmoji from 'a11y-emoji';
import MessageItemBodyImage from './MessageItemBodyImage';
import MessageItemBodyFile from './MessageItemBodyFile';
import { remote } from 'electron';
import { MessageModel, MessageSend, MessageStore } from 'chat-exports';
const { Menu, MenuItem } = remote;

class MessageItemBody extends Component {
  static isEditing = false;

  constructor(props) {
    super(props);
    this.state = { isEditing: false };
    this.showPopupMenu = this.showPopupMenu.bind(this);
    this.handleDownload = this.handleDownload.bind(this);
    this.deleteMessage = this.deleteMessage.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  componentDidMount() {
    if (this.contentEl) {
      //   this.contentEl.innerHTML = a11yEmoji(this.contentEl.innerHTML);
    }
  }

  senderContact() {
    const { msg, getContactInfoByJid } = this.props;
    return getContactInfoByJid(msg.sender);
  }

  handleDownload() {
    const msgBody = this.props.msg.body;
    const fileName = msgBody.path ? path.basename(msgBody.path) : '';
    AppEnv.showSaveDialog({ title: `download file`, defaultPath: fileName }, filePath => {
      if (!filePath || typeof filePath !== 'string') {
        return;
      }
      const loadConfig = {
        msgBody,
        filepath: filePath,
        type: 'download',
      };
      const { queueLoadMessage } = this.props;
      queueLoadMessage(loadConfig);
    });
  }

  deleteMessage() {
    const { msg, conversation } = this.props;
    const body = {
      ...this.props.msg.msgBody,
      updating: true,
      deleted: true,
    };
    MessageSend.sendMessage(body, conversation, msg.id);
    MessageModel.destroy({ where: { id: msg.id, conversationJid: conversation.jid } });
  }

  onKeyDown(event) {
    let keyCode = event.keyCode;
    if (keyCode === 27) {
      // ESC
      event.stopPropagation();
      event.preventDefault();
      this.cancelEdit();
    }
  }

  cancelEdit = () => {
    this.setState({
      isEditing: false,
    });
    this.props.onEdit();
  };

  showPopupMenu(event) {
    event.stopPropagation();
    event.preventDefault();

    let menu = new Menu();
    let menuItem;
    const msgBody = this.props.msg.body;

    if (msgBody.type === FILE_TYPE.TEXT) {
      menuItem = new MenuItem({
        label: 'Edit text',
        click: () => {
          this.setState({ isEditing: true });
          this.props.onEdit();
          menu.closePopup();
        },
      });
      menu.append(menuItem);
    }

    menuItem = new MenuItem({
      label: 'Delete message',
      click: () => {
        this.deleteMessage();
        menu.closePopup();
      },
    });
    menu.append(menuItem);
    menu.popup({ x: event.clientX, y: event.clientY });
  }

  renderContent() {
    const { msg, conversation, getContactInfoByJid, queueLoadMessage } = this.props;
    const msgBody = msg.body;
    const { isEditing } = this.state;
    const textContent = (msgBody.path && path.basename(msgBody.path)) || msgBody.content || msgBody;
    if (isEditing) {
      return (
        <div onKeyDown={this.onKeyDown}>
          <MessageEditBar
            msg={msg}
            cancelEdit={this.cancelEdit}
            value={msgBody.content || msgBody}
            conversation={conversation}
            deleteMessage={this.deleteMessage}
          />
        </div>
      );
    }

    if (msgBody.mediaObjectId) {
      if (isImage(msgBody.type)) {
        return (
          <MessageItemBodyImage
            msg={msg}
            msgBody={msgBody}
            getContactInfoByJid={getContactInfoByJid}
          ></MessageItemBodyImage>
        );
      }
      return (
        <MessageItemBodyFile
          msgBody={msgBody}
          queueLoadMessage={queueLoadMessage}
        ></MessageItemBodyFile>
      );
    }

    return (
      <div className="text-content">
        <div className="text" ref={el => (this.contentEl = el)}>
          <MessageText text={textContent} edited={msgBody.updating} />
        </div>
        {msgBody.failMessage ? (
          <div className="fail-message-text"> {msgBody.failMessage} </div>
        ) : null}
      </div>
    );
  }

  renderMessageToolbar() {
    const { msg } = this.props;
    const msgBody = msg.body;
    const isFile = msgBody.mediaObjectId;
    const isCurrentUser = msg.sender === this.props.conversation.curJid;

    if (!isFile && !isCurrentUser) {
      return null;
    }

    return (
      <div className="message-toolbar">
        {isFile && (
          <span className="download-img" title={msgBody.path} onClick={this.handleDownload}>
            <RetinaImg
              name={'download.svg'}
              style={{ width: 24, height: 24 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
            />
          </span>
        )}
        {isCurrentUser && (
          <span
            className="inplace-edit-img"
            onClick={this.showPopupMenu}
            onContextMenu={this.showPopupMenu}
          >
            <RetinaImg
              name={'expand-more.svg'}
              style={{ width: 26, height: 26 }}
              isIcon
              mode={RetinaImg.Mode.ContentIsMask}
            />
          </span>
        )}
      </div>
    );
  }

  render() {
    return (
      <div className="messageBody">
        {this.renderContent()}
        {this.renderMessageToolbar()}
      </div>
    );
  }
}

export default MessageItemBody;
