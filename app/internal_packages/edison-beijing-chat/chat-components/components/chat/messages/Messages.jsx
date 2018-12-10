import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import uuid from 'uuid/v4';
import CheckIcon from '../../common/icons/CheckIcon';
import {
  MESSAGE_STATUS_DELIVERED,
  getStatusWeight,
} from '../../../db/schemas/message';
import { colorForString } from '../../../utils/colors';
import { buildTimeDescriptor } from '../../../utils/time';
import RetinaImg from '../../../../../../src/components/retina-img';
import { downloadFile } from '../../../utils/awss3';
const { dialog } = require('electron').remote;
import { isJsonString } from '../../../utils/stringUtils';
import ContactAvatar from '../../common/ContactAvatar';

var http = require("http");
var https = require("https");
var fs = require("fs");

// The number of pixels away from the bottom to be considered as being at the bottom
const BOTTOM_TOLERANCE = 32;

const flattenMsgIds = groupedMessages =>
  groupedMessages
    .map(group => group.messages.map(message => message.id))
    .reduce(
      (acc, curr) => {
        curr.forEach(id => acc.add(id));
        return acc;
      }, new Set()
    );

export default class Messages extends PureComponent {
  static propTypes = {
    currentUserId: PropTypes.string.isRequired,
    groupedMessages: PropTypes.arrayOf(
      PropTypes.shape({
        sender: PropTypes.string.isRequired,
        messages: PropTypes.arrayOf(
          PropTypes.shape({
            id: PropTypes.string.isRequired,
            conversationJid: PropTypes.string.isRequired,
            sender: PropTypes.string.isRequired,
            body: PropTypes.string.isRequired,
            sentTime: PropTypes.number.isRequired,
            status: PropTypes.string.isRequired,
          })
        ).isRequired
      })
    ).isRequired,
    referenceTime: PropTypes.number,
    selectedConversation: PropTypes.shape({
      jid: PropTypes.string.isRequired,
      isGroup: PropTypes.bool.isRequired,
    }),
  }

  static defaultProps = {
    referenceTime: new Date().getTime(),
    selectedConversation: { isGroup: false },
  };

  state = {
    shouldScrollBottom: true,
  }

  componentWillReceiveProps(nextProps) {
    const { selectedConversation: currentConv = {} } = this.props;
    const { selectedConversation: nextConv = {} } = nextProps;
    const { jid: currentJid } = currentConv;
    const { jid: nextJid } = nextConv;

    if (currentJid !== nextJid) {
      this.setState({ shouldScrollBottom: true });
      return;
    }

    const msgElem = this.messagesPanel;
    const isAtBottom = (msgElem.scrollHeight - msgElem.scrollTop) <
      (msgElem.clientHeight + BOTTOM_TOLERANCE);
    const { currentUserId } = this.props;
    const { groupedMessages: currentMsgs = [] } = this.props;
    const { groupedMessages: nextMsgs = [] } = nextProps;
    const currentIds = flattenMsgIds(currentMsgs);
    const nextIds = flattenMsgIds(nextMsgs);
    const areNewMessages = currentIds.size !== nextIds.size;
    const isLatestSelf = nextMsgs.length > 0 &&
      nextMsgs[nextMsgs.length - 1].sender === currentUserId;

    this.setState({
      shouldScrollBottom: areNewMessages && (isLatestSelf || isAtBottom),
    });
  }

  componentDidUpdate() {
    if (this.state.shouldScrollBottom) {
      this.scrollToMessagesBottom();
    }
  }

  messagesPanel = null;
  messagePanelEnd = null;

  scrollToMessagesBottom() {
    if (this.messagePanelEnd) {
      this.messagePanelEnd.scrollIntoView({ behavior: 'smooth' });
      this.setState({ shouldScrollBottom: false });
    }
  }

  getContactInfoByJid = (jid) => {
    const members = this.props.members;
    if (!members || members.length === 0) {
      return null;
    }
    for (const member of members) {
      if (member.jid.bare === jid) {
        return (
          <ContactAvatar jid={member.jid.bare} name={member.name}
            email={member.email} avatar={member.avatar} size={32} />
        )
      }
    }
    return null;
  }

  render() {
    const {
      currentUserId,
      groupedMessages,
      referenceTime,
      selectedConversation: { isGroup },
    } = this.props;
    const timeDescriptor = buildTimeDescriptor(referenceTime);
    const getMessageClasses = message => {
      const messageStyles = ['message'];
      if (message.sender === currentUserId) {
        messageStyles.push('currentUser');
      } else {
        messageStyles.push('otherUser');
      }
      return messageStyles.join(' ');
    };

    return (
      <div
        className="messages"
        ref={element => { this.messagesPanel = element; }}
      >
        {groupedMessages.map(group => (
          <div className="messageGroup" key={uuid()}>
            {group.messages.map((msg, idx) => {
              let msgBody = isJsonString(msg.body) ? JSON.parse(msg.body) : msg.body;
              msgBody.path = msgBody.localFile || msgBody.path;
              const color = colorForString(msg.sender);
              let msgFile;

              let download = (event) => {
                let path = dialog.showSaveDialog({ title: `download file` });
                if (!path || typeof path !== 'string') {
                  return;
                }
                if (!msgBody.mediaObjectId.match(/^https?:\/\//)) {
                  // the file is on aws
                  downloadFile(msgBody.aes, msgBody.mediaObjectId, path);
                } else {
                  let request;
                  if (msgBody.mediaObjectId.match(/^https/)) {
                    request = https;
                  } else {
                    request = http;
                  }
                  request.get(msgBody.mediaObjectId, function(res) {
                    var imgData = '';
                    res.setEncoding('binary');
                    res.on('data', function(chunk){
                      imgData += chunk;
                    });
                    res.on('end', function() {
                      fs.writeFile(path, imgData, 'binary', function(err) {
                        if (err) {
                          console.log('down fail');
                        }
                        console.log('down success');
                      });
                    });
                  });
                }
              };

              if (msgBody.path) {
                let maxHeight;
                if (msgBody.path.match(/\.gif$/)) {
                  maxHeight = '100px';
                } else if (msgBody.path.match(/(\.bmp|\.png|\.jpg|\.jpeg)$/)) {
                  maxHeight = '250px';
                }
                msgFile = (<div className="messageMeta">
                  <img
                    src={msgBody.path}
                    title={msgBody.mediaObjectId}
                    onClick={download}
                    style={{ maxHeight }}
                  />
                </div>)
              } else {
                msgFile = msgBody.mediaObjectId && <div className="messageMeta">
                  <RetinaImg
                    name="fileIcon.png"
                    mode={RetinaImg.Mode.ContentPreserve}
                    title={msgBody.mediaObjectId}
                    onClick={download}
                  />
                </div>
              }

              return (
                <div
                  key={msg.id}
                  className={getMessageClasses(msg)}
                  style={{ borderColor: color }}
                >
                  {isGroup && msg.sender !== currentUserId ?
                    <div className="messageSender">
                      {this.getContactInfoByJid(msg.sender)}
                    </div> : null
                  }
                  {isGroup && msg.sender === currentUserId ?
                    <div className="messageSender">
                      {this.getContactInfoByJid(msg.sender)}
                    </div> : null
                  }
                  <div className="messageContent">
                    <div className="messageBody">{msgBody.content || msgBody}</div>
                    {msgBody.mediaObjectId && <div className="messageMeta">
                      <div style={{ background: "#fff" }}>{msgFile}</div>
                    </div>
                    }
                    <div className="messageMeta">
                      {getStatusWeight(msg.status) >= getStatusWeight(MESSAGE_STATUS_DELIVERED) ?
                        <CheckIcon
                          className="messageStatus"
                          size={8}
                          color="white"
                        /> : null
                      }
                      {timeDescriptor(msg.sentTime, true)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))
        }
        <div ref={element => { this.messagePanelEnd = element; }} />
      </div>
    );
  }
}
