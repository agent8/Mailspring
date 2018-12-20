import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { getavatar } from '../../utils/restjs';
import getDb from '../../db';
import xmpp from '../../xmpp/index';
import { getContactInfo, findGroupChatOwner } from '../../utils/contact-utils';
import { groupMessages } from '../../utils/message';
import ContactAvatar from './ContactAvatar'

class GroupChatAvatar extends Component {
  constructor(props) {
    super(props);
    this.state = {
      avatarMembers: []
    }
  }
  componentDidMount() {
    this.refreshAvatar(this.props);
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.conversation.jid !== this.props.conversation.jid) {
      this.refreshAvatar(nextProps);
    }
  }
  refreshAvatar = (props) => {
    const { conversation } = props;
    console.log('ConversationItem componentWillMount 1:', conversation);
    if (!conversation.isGroup) {
      return;
    }
    const avatarMembers = [];
    console.log('ConversationItem componentWillMount 2:', avatarMembers);
    xmpp.getRoomMembers(conversation.jid, null, conversation.curJid).then((result) => {
      const members = result.mucAdmin.items;
      console.log('conversationJid members:', members);
      getDb().then(db => {
        db.messages.find().where('conversationJid').eq(conversation.jid).exec().then(messages => {
          messages.sort((a, b) => a.sentTime - b.sentTime);
          groupMessages(messages).then(groupedMessages => {
            console.log('conversationJid groupedMessages:', groupedMessages, members);
            if (groupedMessages.length >= 2) {
              // last two message senders
              let i = groupedMessages.length - 1;
              let sender = groupedMessages[i].sender
              let member = getContactInfo(sender, members);
              avatarMembers.push(member);
              i--;
              sender = groupedMessages[i].sender
              member = getContactInfo(sender, members);
              avatarMembers.push(member);
            } else if (groupedMessages.length == 1) {
              // last sender + group chat owner
              let i = 0;
              let sender = groupedMessages[i].sender;
              let member = getContactInfo(sender, members);
              avatarMembers.push(member);
              member = findGroupChatOwner(members);
              avatarMembers.push(member);
            } else {
              // group chat owner + anyone other(first or second member)
              let member = findGroupChatOwner(members);
              avatarMembers.push(member);
              if (members[0] !== member) {
                avatarMembers.push(members[0]);
              } else if (members.length > 1) {
                avatarMembers.push(members[1]);
              }
            }
          });
        }).catch(() => {
          // group chat owner + anyone other(first or second member)
          console.log('no groupedMessages got catch:', members);
          let member = findGroupChatOwner(members);
          avatarMembers.push(member);
          if (members[0] !== member) {
            avatarMembers.push(members[0]);
          } else if (members.length > 1) {
            avatarMembers.push(members[1]);
          }
        })
        this.setState({
          avatarMembers
        })
      })
    })
  }
  render() {
    const { avatarMembers } = this.state;
    console.log('*****group avatar render avatarMembers', avatarMembers);
    const name1 = avatarMembers[0] && avatarMembers[0].name;
    const name2 = avatarMembers[1] && avatarMembers[1].name;
    return (
      <div className="groupAvatar">
        {avatarMembers && avatarMembers.length >= 1 ? (
          <ContactAvatar jid={avatarMembers[0].jid.bare} name={name1} email={avatarMembers[0].email} size={30} />
        ) : null}
        {avatarMembers && avatarMembers.length >= 2 ? (
          <ContactAvatar jid={avatarMembers[0].jid.bare} name={name2} email={avatarMembers[0].email} size={30} />
        ) : null}
      </div>
    )
  }
}

GroupChatAvatar.propTypes = {
  conversation: PropTypes.object.isRequired
};

GroupChatAvatar.defaultProps = {
  size: 48,
};

export default GroupChatAvatar;
