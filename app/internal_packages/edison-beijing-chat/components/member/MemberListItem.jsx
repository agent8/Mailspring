import React, { Component } from 'react';
import { AccountStore } from 'mailspring-exports';
import { ChatActions, ConversationStore, UserCacheStore } from 'chat-exports';
import ContactAvatar from '../common/ContactAvatar';
import CancelIcon from '../common/icons/CancelIcon';
import { theme } from '../../utils/colors';
import { jidbare } from '../../utils/jid';
import { getAppByJid } from '../../utils/appmgt';
import { name } from '../../utils/name';

const { primaryColor } = theme;
export default class InfoMember extends Component {
  currentUserIsOwner = false;
  constructor(props) {
    super();
    this.state = {
      visible: false,
      isHiddenNotifi:
        props.selectedConversation && !!props.selectedConversation.isHiddenNotification,
    };
  }

  onClickRemove = e => {
    e.stopPropagation();
    e.preventDefault();
    const { member } = this.props;
    this.removeMember(member);
  };

  // 避免双击事件触发两次单击事件
  clickCoordinate(jid) {
    this._clickTime = (this._clickTime || 0) + 1;
    setTimeout(() => {
      if (this._clickTime === 1) {
        // 单击事件
        this.editProfile();
      } else if (this._clickTime === 2) {
        // 双击事件
        this.changeCurrent(jid);
      }
      this._clickTime = 0;
    }, 300);
  }

  editProfile = () => {
    const { member } = this.props;
    ChatActions.checkMember({ member });
  };

  removeMember = async member => {
    const { conversation } = this.props;
    if (member.affiliation === 'owner') {
      alert('you can not remove the owner of the group chat!');
      return;
    }
    const jid = typeof member.jid === 'object' ? member.jid.bare : member.jid;
    await global.xmpp.leaveRoom(conversation.jid, jid, conversation.curJid);
  };

  changeCurrent = async jid => {
    const { member, conversation } = this.props;
    if (jid === conversation.curJid) {
      return;
    }
    if (AccountStore.isMyEmail(member.email)) {
      ConversationStore.setSelectedConversationsCurJid(jid);
    }
  };

  render = () => {
    let {
      conversation,
      member: { jid, email, affiliation, name: membername },
    } = this.props;

    jid = jidbare(jid);
    membername = name(jid);
    if (!membername && (jid || '').match(/@app/)) {
      const app = getAppByJid(jid);
      if (app) {
        membername = app.name || app.shortName || app.appName;
      }
    }
    const moreInfo = [];
    if (affiliation === 'owner') {
      moreInfo.push('Owner');
    }
    if (jid === conversation.curJid) {
      moreInfo.push('Me');
    }

    return (
      <div className="row" key={jid} onClick={() => this.clickCoordinate(jid)}>
        <div className="avatar">
          <ContactAvatar
            conversation={conversation}
            jid={jid}
            name={membername}
            email={email}
            size={30}
          />
        </div>
        <div className="info">
          <div className="name">
            {membername}
            {moreInfo && moreInfo.length > 0 ? (
              <span className="chat-role"> ({moreInfo.join(' ')})</span>
            ) : null}
          </div>
          <div className="email">{email}</div>
        </div>
        {this.props.currentUserIsOwner && affiliation !== 'owner' && (
          <span className="remove-member" onClick={this.onClickRemove}>
            <CancelIcon color={primaryColor} />
          </span>
        )}
      </div>
    );
  };
}
