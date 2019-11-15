import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import ContactAvatar from '../../common/ContactAvatar';
import GroupChatAvatar from '../../common/GroupChatAvatar';
import { RetinaImg } from 'mailspring-component-kit';
import { getApp, getToken } from '../../../utils/appmgt';
import { ChatActions, MessageStore } from 'chat-exports';
import { remote } from 'electron';
export default class ConversationItem extends PureComponent {
  static propTypes = {
    selected: PropTypes.bool,
    conversation: PropTypes.shape({
      jid: PropTypes.string.isRequired,
      name: PropTypes.string,
      email: PropTypes.string, // .isRequired,
      avatar: PropTypes.string,
      lastMessageText: PropTypes.string.isRequired,
      lastMessageTime: PropTypes.number.isRequired,
    }).isRequired,
    referenceTime: PropTypes.number,
  };

  static defaultProps = {
    selected: false,
    referenceTime: new Date().getTime(),
  };

  state = {};

  UNSAFE_componentWillMount = () => {
    const { conversation } = this.props;
    if (!conversation.jid.match(/@app\.im/)) {
      return;
    }
    const userId = conversation.curJid.split('@')[0];
    const appId = conversation.jid.split('@')[0];
    getToken(userId).then(token => {
      getApp(userId, appId, token, (err, app) => {
        if (!err && app) {
          const state = Object.assign({}, this.state, { appName: app.name });
          this.setState(state);
        }
      });
    });
  };

  onClickRemove = async event => {
    event.stopPropagation();
    event.preventDefault();
    remote.dialog
      .showMessageBox({
        type: 'error',
        message: 'All Conversation Messages Will Be Cleared!',
        buttons: ['OK', 'CANCEL'],
        defaultId: 1,
        icon:
          AppEnv.getLoadSettings().resourcePath +
          '/static/images/notification/icon-alert-onred@2x.png',
      })
      .then(({ response }) => {
        if (response === 0) {
          this.remove();
        }
      });
  };

  remove = () => {
    const { conversation } = this.props;
    MessageStore.removeMessagesByConversationJid(conversation.jid);
    ChatActions.deselectConversation();
    ChatActions.removeConversation(conversation.jid);
    AppEnv.config.set('chatNeedAddIntialConversations', false);
  };

  render() {
    const { selected, conversation, referenceTime, onClick, ...otherProps } = this.props;
    const unreadMessage =
      !conversation.isHiddenNotification && conversation.unreadMessages
        ? conversation.unreadMessages
        : null;
    return (
      <div
        onClick={onClick}
        className={'item' + (selected ? ' selected' : '')}
        style={{ width: '100%' }}
        {...otherProps}
      >
        <div style={{ width: '100%', display: 'flex' }}>
          <div className="avatarWrapper">
            {conversation.isGroup ? (
              <GroupChatAvatar conversation={conversation} size={23} />
            ) : (
              <ContactAvatar
                conversation={conversation}
                jid={conversation.jid}
                name={conversation.name}
                email={conversation.email}
                size={23}
              />
            )}
            {/* {!conversation.isHiddenNotification ? <Badge count={conversation.unreadMessages} /> : null} */}
          </div>
          <div className="content">
            <div className="headerRow">
              {conversation.at && unreadMessage ? <span className="at-me">[@me]</span> : null}
              <span className="headerText">{this.state.appName || conversation.name}</span>
              {/* <span className="time">{timeDescriptor(conversation.lastMessageTime)}</span> */}
              <span className="unread-count">{unreadMessage}</span>
            </div>
            <div className="subHeader">
              {conversation.isGroup &&
              conversation.lastMessageSenderName &&
              conversation.lastMessageText
                ? `${conversation.lastMessageSenderName}:`
                : null}
              {conversation.lastMessageText}
            </div>
          </div>
        </div>
        <span className="remove-button" onClick={this.onClickRemove}>
          <RetinaImg
            name={'close_1.svg'}
            style={{ width: 24, height: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </span>
      </div>
    );
  }
}
