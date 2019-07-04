import React, { Component } from 'react';
import ContactAvatar from '../../common/ContactAvatar';
import CancelIcon from '../../common/icons/CancelIcon';
import { theme } from '../../../../utils/colors';
import { name } from '../../../../utils/name';
import { getAppByJid } from '../../../../utils/appmgt';
const { primaryColor } = theme;


export default class InfoMember extends Component {
  currentUserIsOwner = false;
  constructor(props) {
    super();
    this.state = {
      visible: false,
      isHiddenNotifi: props.selectedConversation && !!props.selectedConversation.isHiddenNotification
    }
  }

  onClickRemove = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const { member } = this.props;
    this.props.removeMember(member);
  };

  editProfile = () => {
    const { member } = this.props;
    this.props.editProfile(member);
  };

  render = () => {
    const { conversation, member } = this.props;
    const jid = typeof member.jid === 'object' ? member.jid.bare : member.jid;
    console.log( 'infom.render: ', member);
    let membername = name(jid) || member.name;
    if (true || !membername && jid.match(/@app/)) {
      const app = getAppByJid(jid);
      membername = app && (app.name || app.appName);
    }
    const email = member.email;
    const moreInfo = [];
    if (member.affiliation === 'owner') {
      moreInfo.push('Owner');
    }
    if (jid === conversation.curJid) {
      moreInfo.push('Me');
    }

    return (
      <div className="row" key={jid} onClick={this.editProfile}>
        <div className="avatar">
          <ContactAvatar
            conversation={conversation}
            jid={jid}
            name={membername}
            email={email}
            avatar={member.avatar}
            size={30} />
        </div>
        <div className="info">
          <div className="name">
            {membername}
            {moreInfo && moreInfo.length > 0 ? <span className="chat-role"> ({moreInfo.join(' ')})</span> : null}
          </div>
          <div className="email">{email}</div>
        </div>
        {this.props.currentUserIsOwner && member.affiliation !== 'owner' &&
          <span className="remove-member" onClick={this.onClickRemove}>
            <CancelIcon color={primaryColor} />
          </span>
        }
      </div>)
  };
}
