import { ipcRenderer } from 'electron';
import MailspringStore from 'mailspring-store';
import { Actions, WorkspaceStore } from 'mailspring-exports';
import { ChatActions, MessageStore, ContactStore, RoomStore, UserCacheStore } from 'chat-exports';
import ConversationModel from '../model/Conversation';
import _ from 'underscore';
import { MESSAGE_STATUS_RECEIVED } from '../model/Message';
import { setTimeout } from 'timers';
import { NEW_CONVERSATION } from '../utils/constant';
import { name } from '../utils/name';
class ConversationStore extends MailspringStore {
  constructor() {
    super();
    this.conversations = [];
    this.selectedConversation = null;
    this._conversationTopBar = null;
    this.convName = {};
    this._registerListeners();
    this.refreshConversations();
    this._triggerDebounced = _.debounce(() => this.trigger(), 20);
    this.setTrayChatUnreadCount = _.debounce(count => AppEnv.setTrayChatUnreadCount(count), 500);
  }

  _registerListeners() {
    this.listenTo(ChatActions.selectConversation, this.setSelectedConversation);
    this.listenTo(ChatActions.deselectConversation, this.deselectConversation);
    this.listenTo(ChatActions.removeConversation, this.removeConversation);
    this.listenTo(ChatActions.goToPreviousConversation, this.previousConversation);
    this.listenTo(ChatActions.goToNextConversation, this.nextConversation);
    this.listenTo(ChatActions.goToMostRecentConversation, this.goToMostRecentConvorsation);
    this.listenTo(ChatActions.changeConversationName, this.changeConversationName);
    this.listenTo(Actions.goToMostRecentChat, this.goToMostRecentConvorsation);
    this.listenTo(WorkspaceStore, this.workspaceChanged);

    if (AppEnv.isMainWindow()) {
      ipcRenderer.on('new-conversation', () => {
        this.showNewConversationSheet();
      });
      ipcRenderer.on('select-conversation', (event, jid) => {
        Actions.selectRootSheet(WorkspaceStore.Sheet.ChatView);
        this.setSelectedConversation(jid);
      });
    }
  }

  setConversationTopBar = el => {
    this._conversationTopBar = el;
  };

  showNewConversationSheet() {
    if (this._conversationTopBar) {
      this._conversationTopBar.newConversation();
    }
  }

  previousConversation = async () => {
    const jid = this.selectedConversation ? this.selectedConversation.jid : null;
    const jids = this.conversations.map(conv => conv.jid);
    const selectedIndex = jids.indexOf(jid);
    if (jids.length > 1 && selectedIndex > 0) {
      this.setSelectedConversation(jids[selectedIndex - 1]);
    }
  };

  nextConversation = async () => {
    const jid = this.selectedConversation ? this.selectedConversation.jid : null;
    const jids = this.conversations.map(conv => conv.jid);
    const selectedIndex = jids.indexOf(jid);
    if (selectedIndex === -1 || selectedIndex < jids.length - 1) {
      this.setSelectedConversation(jids[selectedIndex + 1]);
    }
  };

  removeConversation = async jid => {
    await ConversationModel.destroy({
      where: {
        jid,
      },
    });
    this.refreshConversations();
    MessageStore.removeMessagesByConversationJid(jid);
  };

  deselectConversation = async () => {
    this.selectedConversation = null;
    MessageStore.conversationJid = null;
    this._triggerDebounced();
  };

  setSelectedConversation = async jid => {
    // the same conversation, skip refresh
    if (this.selectedConversation && this.selectedConversation.jid === jid) {
      if (this.selectedConversation.unreadMessages) {
        await this._clearUnreadCount(jid);
      }
      return;
    }
    await this._clearUnreadCount(jid);

    // ChatActions.selectConversation(jid);
    const selectedConversation = await this.getConversationByJid(jid);
    let user = '';
    if (
      selectedConversation &&
      !selectedConversation.isGroup &&
      !selectedConversation.email &&
      selectedConversation.jid.indexOf('@app') === -1 &&
      selectedConversation.jid !== 'NEW_CONVERSATION'
    ) {
      user = await UserCacheStore.getUserInfoByJid(selectedConversation.jid);
      if (!user) {
        user = await ContactStore.findContactByJid(selectedConversation.jid);
        if (!user) {
          console.error('Chat:user info is null', selectedConversation);
        }
      }
      if (user) {
        selectedConversation.email = user.email;
      }
    }
    this.selectedConversation = selectedConversation;
    this.selectedConversation = selectedConversation;
    // this.trigger();
    // this._triggerDebounced();
  };

  setSelectedConversationByNew = () => {
    this.selectedConversation = {
      jid: NEW_CONVERSATION,
      curJid: null,
      name: ' ',
      email: null,
      avatar: null,
      isGroup: false,
      unreadMessages: 0,
    };
    this._triggerDebounced();
  };

  setSelectedConversationsCurJid = async curJid => {
    if (this.selectedConversation && this.selectedConversation.jid) {
      await this.updateConversationByJid({ curJid }, this.selectedConversation.jid);
      this.refreshConversations();
    }
  };

  _clearUnreadCount = async jid => {
    await ConversationModel.update({ unreadMessages: 0, at: false }, { where: { jid } });
    this.refreshConversations();
  };

  getSelectedConversation = () => {
    return this.selectedConversation;
  };

  getConversations() {
    return this.conversations;
  }

  workspaceChanged = () => {
    const sheet = WorkspaceStore.topSheet();
    if (sheet) {
      if (sheet.id !== 'ChatView' && sheet.id !== 'Preferences') {
        this.deselectConversation();
      }
    }
  };

  goToMostRecentConvorsation = () => {
    const conversation = this.getMostRecentConversation();
    if (conversation) {
      ChatActions.selectConversation(conversation.jid);
    }
  };

  getMostRecentConversation = () => {
    return this.conversations.length > 0 ? this.conversations[0] : null;
  };

  getConversationByJid = async jid => {
    let result;
    for (const conv of this.conversations) {
      if (conv.jid === jid) {
        result = conv;
        break;
      }
    }
    if (!result) {
      result = await ConversationModel.findOne({
        where: {
          jid,
        },
      });
    }
    if (result && result.isGroup) {
      const room = RoomStore.rooms && RoomStore.rooms[result.jid];
      if (room) {
        result.members = room.dataValues ? room.dataValues.members : room.members;
      }
    }
    return result;
  };

  findConversationsByCondition = async condition => {
    return await ConversationModel.findAll({
      where: condition,
    });
  };

  refreshConversations = async () => {
    const res = await ConversationModel.findAll({
      order: [['lastMessageTime', 'desc']],
      //   raw: true,
    });
    this.conversations = res.map(item => ({ ...item.dataValues }));
    if (this.selectedConversation && this.selectedConversation.jid !== NEW_CONVERSATION) {
      this.selectedConversation = await this.getConversationByJid(this.selectedConversation.jid);
    }
    this._triggerDebounced();
    this.setTray();
  };

  setTray = () => {
    let count = 0;
    const conversationFormat = [];
    this.conversations.forEach(item => {
      count += item.unreadMessages;
      conversationFormat.push({
        jid: item.jid,
        curJid: item.curJid,
        name: item.name,
        unreadMessages: item.unreadMessages,
        isGroup: item.isGroup,
      });
    });

    this.setTrayChatUnreadCount(count);
    AppEnv.config.set('conversations', conversationFormat);
    ipcRenderer.send('update-system-tray-conversation-menu');
  };

  saveConversations = async convs => {
    for (const conv of convs) {
      const convInDb = await ConversationModel.findOne({
        where: {
          jid: conv.jid,
        },
      });
      // if exists in db, don't update curJid
      if (convInDb) {
        delete conv.curJid;
        delete conv.name;
      }
      await ConversationModel.upsert(conv);
    }
    this.refreshConversations();
  };

  updateConversationByJid = async (data, jid) => {
    await ConversationModel.update(data, {
      where: {
        jid,
      },
    });
    this.refreshConversations();
  };

  createGroupConversation = async payload => {
    await RoomStore.createGroupChatRoom(payload);
    const { contacts: selectedContacts, roomId, name, curJid, creator } = payload;
    const content = '';
    const timeSend = new Date().getTime();
    const conversation = {
      jid: roomId,
      curJid: curJid,
      name: name,
      isGroup: true,
      unreadMessages: 0,
      lastMessageTime: new Date(timeSend).getTime(),
      lastMessageText: content,
      lastMessageSender: curJid,
    };
    let avatarMembers = [
      creator,
      selectedContacts.find(contact => contact.jid !== conversation.curJid),
    ];
    conversation.avatarMembers = avatarMembers;
    await this.saveConversations([conversation]);
    await this.setSelectedConversation(roomId);
  };

  createPrivateConversation = async contact => {
    const jid = contact.jid;
    let conversation = await this.getConversationByJid(jid);
    // 如果已经创建有直接返回并选中
    if (conversation) {
      await this.setSelectedConversation(jid);
      return;
    }
    conversation = {
      jid: contact.jid,
      curJid: contact.curJid,
      name: name(contact.jid) || contact.name,
      isGroup: false,
      // below is some filling to show the conversation
      unreadMessages: 0,
      lastMessageSender: contact.curJid,
      lastMessageText: '',
      lastMessageTime: new Date().getTime(),
    };
    await this.saveConversations([conversation]);
    await this.setSelectedConversation(jid);
  };

  createInitialPrivateConversationsFromAllContacts = async () => {
    const chatNeedAddIntialConversations = AppEnv.config.get('chatNeedAddIntialConversations');
    if (!chatNeedAddIntialConversations) {
      return;
    }
    const chatAccounts = AppEnv.config.get('chatAccounts') || {};
    for (const email in chatAccounts) {
      await this.createInitialPrivateConversationsFromAllContactsOfEmail(email, true);
    }
  };

  createInitialPrivateConversationsFromAllContactsOfEmail = async (email, completed) => {
    let contacts = await ContactStore.getContacts();
    const chatAccounts = AppEnv.config.get('chatAccounts') || {};
    const chatAccount = chatAccounts[email];
    let chatConversationsInitialized = AppEnv.config.get('chatConversationsInitialized') || '';
    if (!chatAccount || chatConversationsInitialized.includes(email)) {
      return;
    }
    chatConversationsInitialized = email + ' ' + chatConversationsInitialized;
    const curjid = chatAccount.userId + '@im.edison.tech';
    // let conversations = this.conversations;
    // conversations = conversations.filter(conv => conv.curJid === curjid);
    contacts = contacts.filter(
      contact =>
        !contact.jid.match(/@app/) && !contact.jid.includes('^at^') && contact.curJid === curjid
    );
    for (const contact of contacts) {
      await this.createPrivateConversation(contact);
    }
    if (completed) {
      AppEnv.config.set('chatConversationsInitialized', chatConversationsInitialized);
    }
  };

  onChangeConversationName = async data => {
    // called by xmpp.on('edimucconfig', data => {...})
    if (!data || !data.edimucevent || !data.edimucevent.edimucconfig) {
      return;
    }
    const config = data.edimucevent.edimucconfig;
    const convJid = data.from.bare;
    let contact = await ContactStore.findContactByJid(config.actorJid);
    if (!contact) {
      contact = UserCacheStore.getUserInfoByJid(config.actorJid);
    }
    const name = (contact && (contact.name || contact.email)) || config.actorJid.split('@')[0];
    const body = {
      content: `${name} changes the group name to ${config.name}`,
      type: 'change-group-name',
    };
    const msg = {
      id: data.id,
      conversationJid: convJid,
      sender: config.actorJid,
      body: JSON.stringify(body),
      sentTime: new Date().getTime(),
      status: MESSAGE_STATUS_RECEIVED,
    };
    MessageStore.saveMessagesAndRefresh([msg]);

    await this.saveConversationName(convJid, config.name);
    await RoomStore.updateRoomName(convJid, config.name);
  };

  saveConversationName = async (jid, name) => {
    const conv = await this.getConversationByJid(jid);
    if (!conv || conv.name === name) {
    } else {
      this.convName[jid] = { name, ts: new Date().getTime() };

      setTimeout(async () => {
        let obj = this.convName[jid];
        if (new Date().getTime() - obj.ts > 45) {
          await conv.update({ name });
          this.refreshConversations();
        }
      }, 50);
    }
  };

  changeConversationName = async ({ name: newName, jid }) => {
    for (let conversation of this.conversations) {
      if (conversation.jid === jid) {
        const { name, jid, curJid, isGroup } = conversation;
        if (newName && newName !== name) {
          this.saveConversationName(jid, newName);
          if (isGroup) {
            await global.xmpp.setRoomName(jid, { name: newName }, curJid);
          }
        }
        break;
      }
    }
  };
}

module.exports = new ConversationStore();
