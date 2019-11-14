import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { remote } from 'electron';
import { RetinaImg } from 'mailspring-component-kit';
import { FixedPopover } from 'mailspring-component-kit';
import {
  ChatActions,
  MessageStore,
  RoomStore,
  ConversationStore,
  ContactStore,
  UserCacheStore,
  AppStore,
  LocalStorage,
} from 'chat-exports';
import Button from '../../common/Button';
import InfoMember from './InfoMember';
import { NEW_CONVERSATION } from '../../../utils/constant';
import InviteGroupChatList from '../new/InviteGroupChatList';
import { name, nickname } from '../../../utils/name';
import { alert } from '../../../utils/electron-utils';
import genRoomId from '../../../utils/genRoomId';
import conversationTitle from '../../../utils/conversationTitle';
export default class ConversationInfo extends Component {
  constructor(props) {
    super();
    this.state = {
      inviting: false,
      members: [],
      loadingMembers: false,
      visible: false,
      isHiddenNotifi:
        props.selectedConversation && !!props.selectedConversation.isHiddenNotification,
    };
  }

  _listenToStore = () => {
    this._unsubs = [];
    this._unsubs.push(RoomStore.listen(this.refreshRoomMembers));
    this._unsubs.push(LocalStorage.listen(this.refreshRoomMembers));
  };

  componentWillUnmount() {
    for (const unsub of this._unsubs) {
      unsub();
    }
  }

  componentDidMount() {
    this._listenToStore();
    this.refreshRoomMembers();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.selectedConversation.jid !== this.props.selectedConversation.jid) {
      this.setState({
        members: [],
      });
      this.refreshRoomMembers(nextProps);
    }
  }

  refreshRoomMembers = async nextProps => {
    this.setState({ loadingMembers: true });
    const members = await this.getRoomMembers(nextProps);
    for (const member of members) {
      member.name = name(member.jid);
      member.nickname = nickname(member.jid);
    }
    members.sort((a, b) => (a.affiliation + a.name > b.affiliation + b.name ? 1 : -1));
    this.setState({
      members,
      loadingMembers: false,
    });
  };

  getRoomMembers = async (nextProps = {}) => {
    const conversation =
      (nextProps && nextProps.selectedConversation) || this.props.selectedConversation;
    if (conversation && conversation.isGroup) {
      return await RoomStore.getRoomMembers(conversation.jid, conversation.curJid, true);
    }
    return [];
  };

  clearMessages = () => {
    const conversation = this.props.selectedConversation;
    const jid = conversation.jid;
    MessageStore.removeMessagesByConversationJid(jid);
    return;
  };

  toggleNotification = event => {
    const isHidden = !this.props.selectedConversation.isHiddenNotification;
    this.props.selectedConversation.isHiddenNotification = isHidden;
    ConversationStore.updateConversationByJid(
      { isHiddenNotification: isHidden },
      this.props.selectedConversation.jid
    );
    this.setState({
      isHiddenNotifi: isHidden,
    });
  };

  exitGroup = async () => {
    if (!global.confirm('Are you sure to exit from this group?')) {
      return;
    }
    const { selectedConversation: conversation } = this.props;
    await global.xmpp.leaveRoom(conversation.jid, conversation.curJid, conversation.curJid);
    const isNeedRetain = await RoomStore.updateConversationCurJid(
      conversation.curJid,
      conversation.jid
    );
    if (!isNeedRetain) {
      ChatActions.removeConversation(conversation.jid);
      ChatActions.deselectConversation();
    }
  };

  toggleInvite = moreBtnEl => {
    this.setState({ inviting: !this.state.inviting, moreBtnEl });
  };

  onUpdateGroup = async contacts => {
    this.setState({ inviting: false });

    if (contacts.some(contact => contact.jid.match(/@app/))) {
      return alert('plugin app should not be added to any group chat as contact.');
    }
    if (!contacts || !contacts.length) {
      return;
    }

    const { selectedConversation } = this.props;
    if (selectedConversation.isGroup) {
      Promise.all(
        contacts.map(contact =>
          global.xmpp.addMember(selectedConversation.jid, contact.jid, selectedConversation.curJid)
        )
      );
    } else {
      const roomId = genRoomId();
      const owner = await ContactStore.findContactByJid(selectedConversation.curJid);

      if (!contacts.filter(item => item.jid === selectedConversation.jid).length) {
        const other = await ContactStore.findContactByJid(selectedConversation.jid);
        if (other) {
          contacts.unshift(other);
        } else {
          contacts.unshift({ jid: selectedConversation.jid, name: '' });
        }
      }
      if (!contacts.filter(item => item.jid === selectedConversation.curJid).length) {
        if (owner) {
          contacts.unshift(owner);
        } else {
          contacts.unshift({ jid: selectedConversation.curJid, name: '' });
        }
      }
      const names = contacts.map(item => item.name);
      ConversationStore.createGroupConversation({
        contacts,
        roomId,
        name: conversationTitle(names),
        curJid: selectedConversation.curJid,
        creator: owner,
      });
    }
  };

  showMenu = e => {
    const props = this.props;
    const isHidden = props.selectedConversation.isHiddenNotification;
    let menuToggleNotificationLabel;
    if (isHidden) {
      menuToggleNotificationLabel = 'Show Notifications';
    } else {
      menuToggleNotificationLabel = 'Hide Notifications';
    }
    const menus = [
      {
        label: `Clear Message History`,
        click: () => {
          this.clearMessages();
        },
      },
      { type: 'separator' },
      {
        label: menuToggleNotificationLabel,
        click: e => {
          this.toggleNotification(e);
        },
      },
    ];
    const { selectedConversation: conversation } = this.props;
    if (!conversation.jid.match(/@app/)) {
      menus.unshift({
        label: `Add to Group...`,
        click: async () => {
          const moreBtnEl = document.querySelector('.more');
          await AppStore.refreshAppsEmailContacts();
          this.toggleInvite(moreBtnEl);
        },
      });
    }
    this.menu = remote.Menu.buildFromTemplate(menus).popup(remote.getCurrentWindow());
  };

  filterCurrentMemebers = contact => {
    if (this.props.selectedConversation.isGroup) {
      const memberJids = this.state.members.map(c => c.email);
      return !memberJids.includes(contact.email);
    } else {
      if (
        this.props.selectedConversation.roomMembers &&
        this.props.selectedConversation.roomMembers.length > 0
      ) {
        return [this.props.selectedConversation.roomMembers[0].email];
      } else {
        return [this.props.selectedConversation.email];
      }
    }
  };

  renderGroupConversationMember() {
    const { selectedConversation: conversation } = this.props;
    const { members: roomMembers } = this.state;
    let currentUserIsOwner = false;

    for (const member of roomMembers) {
      const jid = typeof member.jid === 'object' ? member.jid.bare : member.jid;
      if (member.affiliation === 'owner' && jid === conversation.curJid) {
        currentUserIsOwner = true;
        break;
      }
    }
    return [
      roomMembers &&
        roomMembers.map(member => {
          return (
            <InfoMember
              conversation={conversation}
              member={member}
              currentUserIsOwner={currentUserIsOwner}
              key={member.jid}
            />
          );
        }),
      <div key="exit-group" className="exit-group" onClick={this.exitGroup}>
        Exit from Group
      </div>,
    ];
  }

  renderPrivateConversationMember() {
    const { selectedConversation: conversation } = this.props;
    const { dataValues, email, isNewRecord, curJid } = conversation;
    let privateChatMember = { ...dataValues, email, isNewRecord };
    let self = JSON.parse(JSON.stringify(UserCacheStore.getUserInfoByJid(curJid)));

    return [
      <InfoMember
        conversation={conversation}
        member={privateChatMember}
        currentUserIsOwner={false}
        key={privateChatMember.jid}
      />,
      self && (
        <InfoMember
          conversation={conversation}
          member={self}
          currentUserIsOwner={false}
          key="curJid"
        />
      ),
    ];
  }

  render = () => {
    const { selectedConversation: conversation, contacts } = this.props;
    const { members: roomMembers, loadingMembers, inviting } = this.state;

    return (
      <div className="info-content">
        <div className="member-management">
          {loadingMembers ? (
            <RetinaImg name="inline-loading-spinner.gif" mode={RetinaImg.Mode.ContentPreserve} />
          ) : (
            <div className="member-count">
              {conversation.isGroup ? roomMembers.length + ' People' : ''}
            </div>
          )}
          <Button className="close" onClick={this.props.onCloseInfoPanel}></Button>
          <Button className="more" onClick={this.showMenu}></Button>
        </div>
        <div className="members">
          {conversation.isGroup
            ? this.renderGroupConversationMember()
            : this.renderPrivateConversationMember()}
        </div>
        {inviting && conversation.jid !== NEW_CONVERSATION && (
          <FixedPopover
            {...{
              direction: 'down',
              originRect: {
                width: 350,
                height: 430,
                top: this.state.moreBtnEl.getBoundingClientRect().top,
                left: this.state.moreBtnEl.getBoundingClientRect().left,
              },
              closeOnAppBlur: false,
              onClose: () => {
                this.setState({ inviting: false });
              },
            }}
          >
            <InviteGroupChatList
              contacts={contacts.filter(this.filterCurrentMemebers)}
              groupMode={true}
              onUpdateGroup={this.onUpdateGroup}
            />
          </FixedPopover>
        )}
      </div>
    );
  };
}

ConversationInfo.propTypes = {
  selectedConversation: PropTypes.shape({
    jid: PropTypes.string.isRequired,
    name: PropTypes.string, //.isRequired,
    email: PropTypes.string, //.isRequired,
    avatar: PropTypes.string,
    isGroup: PropTypes.bool.isRequired,
    roomMembers: PropTypes.array,
  }).isRequired,
};
