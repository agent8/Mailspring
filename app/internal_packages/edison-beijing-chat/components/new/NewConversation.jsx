import React, { Component } from 'react';
import { RetinaImg, InjectedComponent } from 'mailspring-component-kit';
import Select, { Option } from 'rc-select';
import { Actions, WorkspaceStore } from 'mailspring-exports';
import { ChatActions, ConversationStore, ContactStore, AppStore } from 'chat-exports';
import ContactAvatar from '../common/ContactAvatar';
import Button from '../common/Button';
import genRoomId from '../../utils/genRoomId';
import conversationTitle from '../../utils/conversationTitle';
const { AccountStore } = require('mailspring-exports');

function generateContactValue(contact) {
  return contact.name + '|' + contact.email;
}

function generateContactName(contact) {
  // use zero-widthjoiner break up the string
  // If zero width characters are not used,
  // once onBlur, rc-select will auto select the option that has same label to input value,
  // and if there are more than one, select the first one,
  // which is not in line with our expectation
  return contact.name + '\u200d';
}
export default class NewConversation extends Component {
  static displayName = 'NewConversation';

  constructor() {
    super();
    this.state = {
      members: [],
      contacts: [],
      selectedOptions: [],
      loading: true,
    };
    this._mounted = false;
  }

  componentDidMount() {
    this._mounted = true;
    this.initContacts();
    this.unsub = AppStore.listen(() => {
      this.initContacts();
    });
    setTimeout(this._setDropDownHeight, 300);
    window.addEventListener('resize', this.setUlListPosition);
  }

  initContacts = async () => {
    const contacts = await ContactStore.getContacts();

    if (this._mounted) {
      this.setState({ contacts, loading: false });
    }
  };

  componentWillUnmount() {
    this._mounted = false;
    window.removeEventListener('resize', this.setUlListPosition);
    this.unsub();
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.state.members.length !== prevState.members.length) {
      this.setUlListPosition();
    }
  }

  isMe(email) {
    return !!AccountStore.accountForEmail(email);
  }

  setUlListPosition() {
    const container = document.querySelector('#contact-select');
    const ulList = document.querySelector('#contact-select ul');
    if (container && ulList) {
      const widthDiff =
        ulList.getBoundingClientRect().width - container.getBoundingClientRect().width;
      if (widthDiff <= 0) {
        ulList.setAttribute('style', 'margin-left: 0');
      } else {
        ulList.setAttribute('style', `margin-left: -${widthDiff + 20}px`);
      }
    }
  }

  _setDropDownHeight() {
    const dropDown = document.querySelector('.rc-select-dropdown');
    if (dropDown) {
      const offsetTop = dropDown.offsetTop;
      dropDown.style.maxHeight = `calc(100vh - ${offsetTop + 5}px)`;
    }
  }

  handleChange = selectedOptions => {
    const { contacts } = this.state;
    const members = [];
    contacts.forEach(item => {
      if (selectedOptions.some(option => option === generateContactValue(item))) {
        members.push({
          name: item.name,
          jid: item.jid,
          curJid: item.curJid,
          email: item.email,
        });
      }
    });
    this.setState(
      {
        members,
        selectedOptions,
      },
      this.focusIntoInput
    );
  };

  onSelect = value => {
    const { selectedOptions } = this.state;
    this.handleChange([...selectedOptions, value]);
  };
  onDeselect = value => {
    const { selectedOptions } = this.state;
    this.handleChange(selectedOptions.filter(option => option !== value));
  };

  createConversation = () => {
    if (this.state.members.length === 0) {
      return;
    }
    this._close();
    Actions.selectRootSheet(WorkspaceStore.Sheet.ChatView);

    const contacts = this.state.members;
    if (contacts && contacts.length) {
      const curJid = contacts[0].curJid;
      if (contacts.length === 1) {
        ConversationStore.createPrivateConversation(contacts[0]);
      } else if (contacts.some(contact => contact.jid.match(/@app/))) {
        return alert('Should only create private conversation with single plugin app contact.');
      } else {
        const roomId = genRoomId();
        const names = contacts.map(contact => contact.name);
        const creator = this.state.contacts.find(
          item => item.jid === item.curJid && contacts.findIndex(i => i.curJid === item.curJid) > -1
        );
        ConversationStore.createGroupConversation({
          contacts,
          roomId,
          name: conversationTitle(names),
          curJid,
          creator,
        });
      }
      AppEnv.config.set('chatNeedAddIntialConversations', false);
    }
  };

  _close = () => {
    Actions.popSheet({ reason: 'NewConversation:_close' });
    const conv = ConversationStore.selectedConversationBeforeNew;
    if (conv) {
      ConversationStore.setSelectedConversation(conv.jid);
    } else {
      ChatActions.deselectConversation();
    }
    ConversationStore.selectedConversationBeforeNew = null;
  };

  onKeyUp = event => {
    if (event.keyCode === 27) {
      // ESC
      this._close();
    }
  };

  focusIntoInput = () => {
    document.querySelector('#contact-select').focus();
    document.querySelector('#contact-select input').focus();
  };

  render() {
    const { members, contacts, loading, selectedOptions } = this.state;

    const children = contacts
      .filter(contact => !!contact && !this.isMe(contact.email))
      .map((contact, index) => (
        <Option
          key={contact.jid}
          jid={contact.jid}
          curjid={contact.curJid}
          value={generateContactValue(contact)}
          email={contact.email}
          label={generateContactName(contact)}
        >
          <div className="chip">
            <ContactAvatar jid={contact.jid} name={contact.name} email={contact.email} size={32} />
            <span className="contact-name">{contact.name}</span>
            <span className="contact-email">{contact.email}</span>
          </div>
        </Option>
      ));
    return (
      <div className="new-conversation-popup">
        <div className="newConversationPanel" onKeyUp={this.onKeyUp}>
          <InjectedComponent matching={{ role: 'ToolbarWindowControls' }} />
          <div className="to">
            <span className="close" onClick={this._close}>
              <RetinaImg
                name={'close_1.svg'}
                style={{ width: 24, height: 24 }}
                isIcon
                mode={RetinaImg.Mode.ContentIsMask}
              />
            </span>
            <span className="new-message-title">New Message</span>
          </div>
          <div
            ref={el => {
              this.contactInputEl = el;
            }}
            style={{ display: 'flex' }}
            onClick={this.focusIntoInput}
            className="contact-select-wrapper"
          >
            <Select
              mode="tags"
              id="contact-select"
              style={{ width: '400px', flex: 1, height: '70px' }}
              dropdownStyle={{ maxHeight: 1 }} // init set 1px, fixbug DC-990:4
              onSelect={this.onSelect}
              onDeselect={this.onDeselect}
              value={selectedOptions}
              defaultOpen
              multiple
              autoFocus
              open
              placeholder="Find a contact or enter an email"
              tokenSeparators={[',']}
              optionLabelProp="label"
              loading={loading}
            >
              {children}
            </Select>
            <Button
              className={`btn go ${members.length === 0 ? 'btn-disabled' : ''}`}
              onClick={this.createConversation}
            >
              Go
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
