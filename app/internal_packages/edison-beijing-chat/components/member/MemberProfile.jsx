import React, { Component } from 'react';
import ContactAvatar from '../common/ContactAvatar';
import Button from '../common/Button';
import {
  ChatActions,
  ContactStore,
  MemberProfileStore,
  BlockStore,
  MessageStore,
  LocalStorage,
  ConversationStore,
  UserCacheStore,
} from 'chat-exports';
import { uploadContacts } from '../../utils/restjs';
import { remote } from 'electron';
import { checkToken, refreshChatAccountTokens, queryProfile } from '../../utils/restjs';
import { Actions } from 'mailspring-exports';
import Contact from '../../../../src/flux/models/contact';
import keyMannager from '../../../../src/key-manager';
import { RetinaImg } from 'mailspring-component-kit';
import { name, nickname } from '../../utils/name';
import { jidbare } from '../../utils/jid';
export default class MemberProfile extends Component {
  constructor(props) {
    super(props);
    this.state = {
      member: {},
      visible: false,
    };
    this.panelElementRef = React.createRef();
  }

  componentDidMount = () => {
    document.body.addEventListener('click', this.onClickWithProfile);
    this._unsub = MemberProfileStore.listen(({ member }) => this.setMember(member));
  };

  componentWillUnmount = () => {
    document.body.removeEventListener('click', this.onClickWithProfile);
    this._unsub();
  };

  setMember = member => {
    this.setState({
      member: { ...member, name: name(member.jid), nickname: nickname(member.jid) },
      visible: true,
    });
  };

  onClickWithProfile = e => {
    //  cxm:
    // because onBlur on a div container does not work as expected
    // so it's necessary to use this as a workaround
    // 判断是否点击在更多按钮上
    let btnMore = document.querySelector('.button-more__profile');
    if (e.target === btnMore) return;
    // 判断是否点击在member上
    let rows = document.querySelectorAll('.row');
    for (let row of rows) {
      if (row.contains && row.contains(e.target)) return;
    }

    let current = this.panelElementRef.current;
    if (!current) return;

    const rect = current.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      this.exitProfile(this.state.member);
    }
  };

  startPrivateChat = e => {
    this.exitProfile(this.state.member);
    const member = Object.assign({}, this.state.member);
    member.jid = (member.jid && member.jid.bare) || member.jid;
    member.name = member.name || (member.jid && member.jid.split('^at^')[0]);
    member.curJid = member.curJid || this.props.conversation.curJid;
    ConversationStore.createPrivateConversation(member);
  };

  composeEmail = e => {
    const member = this.state.member;
    this.exitProfile(member);
    const contact = new Contact({
      id: member.id,
      accountId: member.accountId,
      name: member.name,
      email: member.email,
    });
    Actions.composeNewDraftToRecipient(contact);
  };

  exitProfile = async (member, close = true) => {
    if (!member) {
      return;
    }
    let { jid, nickname } = member;
    jid = jidbare(jid);
    const nicknames = global.chatLocalStorage.nicknames;
    if (nicknames[jid] !== nickname) {
      nicknames[jid] = nickname;
      LocalStorage.saveToLocalStorage();
    }

    if (close) {
      this.setState({ visible: false });
    } else {
      // update name and nickname
      this.setMember(this.state.member);
    }

    MessageStore.saveMessagesAndRefresh();
    UserCacheStore.saveUserCache([{ ...this.state.member, name: nickname }]);
    LocalStorage.trigger();
    ChatActions.changeConversationName({ name: nickname || name(jid), jid });
  };

  showMenu = async e => {
    e.stopPropagation();
    const { member } = this.state;
    const jid = jidbare(member.jid);
    const curJid = this.props.conversation.curJid;
    const isBlocked = await BlockStore.isBlocked(jid, curJid);
    const menus = [
      {
        label: `Add to Contacts`,
        click: () => {
          this.addToContacts();
        },
      },
    ];

    menus.push(
      isBlocked
        ? {
            label: `Unblock this Contact`,
            click: () => {
              this.unblockContact();
            },
          }
        : {
            label: `Block this Contact`,
            click: () => {
              this.blockContact();
            },
          }
    );

    remote.Menu.buildFromTemplate(menus).popup(remote.getCurrentWindow());
  };

  blockContact = async () => {
    const member = this.state.member;
    const jid = jidbare(member.jid);
    const curJid = this.props.conversation.curJid;
    await BlockStore.block(jid, curJid);
    alert(`You have blocked ${member.nickname || member.name}`);
  };

  unblockContact = async () => {
    const member = this.state.member;
    const jid = jidbare(member.jid);
    const curJid = this.props.conversation.curJid;
    await BlockStore.unblock(jid, curJid);
    alert(`You have unblocked ${member.nickname || member.name}`);
  };

  addToContacts = async () => {
    const member = this.state.member;
    const jid = jidbare(member.jid);
    let contacts = await ContactStore.getContacts();
    if (contacts.some(item => item.email === member.email)) {
      alert(`This contact(${member.nickname || member.name}) has been in the contacts.`);
      return;
    }
    contacts = contacts.map(item => ({ email: item.email, displayName: item.name }));
    contacts.push({ email: member.email, displayName: member.name || member.nickname });
    const chatAccounts = AppEnv.config.get('chatAccounts') || {};
    const email = Object.keys(chatAccounts)[0];
    let accessToken = await keyMannager.getAccessTokenByEmail(email);
    const { err, res } = await checkToken(accessToken);
    if (err || !res || res.resultCode !== 1) {
      await refreshChatAccountTokens();
      accessToken = await keyMannager.getAccessTokenByEmail(email);
    }
    ContactStore.saveContacts(
      [
        {
          jid,
          curJid: member.curJid,
          name: member.name || member.nickname || jid.split('@')[0],
          email: member.email,
          avatar: member.avatar,
        },
      ],
      member.curJid
    );
    uploadContacts(accessToken, contacts, () => {
      alert(`This contact(${member.nickname || member.name}) has been added into the contacts.`);
    });
  };

  onChangeNickname = e => {
    let nickname = e.target.value;
    this.setState(
      {
        member: { ...this.state.member, nickname: nickname.trim() },
      },
      () => {
        this.exitProfile(this.state.member, false);
      }
    );
  };

  onKeyPressEvent = e => {
    const { nativeEvent, currentTarget } = e;
    if (nativeEvent.keyCode === 13 && !nativeEvent.shiftKey) {
      currentTarget.blur();
      e.preventDefault();
      return false;
    }
    return true;
  };

  get isNotMe() {
    let { jid } = this.state.member;
    let curJid = this.props.conversation && this.props.conversation.curJid;
    return jid !== curJid;
  }

  renderMessageButton() {
    return (
      <button
        className="btn btn-toolbar command-button"
        title="Start a private chat"
        onClick={this.startPrivateChat}
      >
        <RetinaImg
          name={'chat.svg'}
          style={{ width: 16 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
        <span className="btnText">Messages</span>
      </button>
    );
  }

  renderComposeButton() {
    return (
      <button
        className="btn btn-toolbar command-button"
        title="Compose new message"
        onClick={this.composeEmail}
      >
        <RetinaImg
          name={'email.svg'}
          style={{ width: 16 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
        <span className="btnText">Compose</span>
      </button>
    );
  }

  render = () => {
    if (!this.state.visible) {
      return null;
    }
    let { email, jid, name, nickname } = this.state.member;

    return (
      <div className="member-profile-panel" ref={this.panelElementRef} tabIndex={1}>
        <Button className="more button-more__profile" onClick={this.showMenu}></Button>
        <div className="avatar-area">
          <ContactAvatar jid={jidbare(jid)} name={name} email={email} size={140} />
          <div className="name-buttons">
            <h2 className="member-name" title={name}>
              {name}
            </h2>
            {this.isNotMe && this.renderMessageButton()}
            {this.renderComposeButton()}
          </div>
        </div>
        <div className="email">
          <div className="email-label">email</div>
          <div className="member-email">{email}</div>
        </div>
        <div className="nickname">
          <div className="nickname-label">nickname</div>
          <input
            key={nickname}
            className="nickname-input"
            type="text"
            defaultValue={nickname}
            placeholder="input nickname here"
            // onChange={this.onChangeNickname}
            onKeyPress={this.onKeyPressEvent}
            onBlur={this.onChangeNickname}
          ></input>
        </div>
      </div>
    );
  };
}
