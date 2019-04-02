import React, { PureComponent } from 'react';
import path from "path";
const sqlite = require('better-sqlite3');
import { CSSTransitionGroup } from 'react-transition-group';
import PropTypes from 'prop-types';
import MessagesTopBar from './MessagesTopBar';
import NewConversationTopBar from './NewConversationTopBar';
import MessagesSendBar from './MessagesSendBar';
import Messages from './Messages';
import Notifications from './Notifications';
import ConversationInfo from '../conversations/ConversationInfo';
import Divider from '../../common/Divider';
import InviteGroupChatList from '../new/InviteGroupChatList';
import xmpp from '../../../xmpp/index';
import chatModel, { saveToLocalStorage } from '../../../store/model';
import getDb from '../../../db';
import { downloadFile, uploadFile } from '../../../utils/awss3';
import uuid from 'uuid/v4';
import { NEW_CONVERSATION } from '../../../actions/chat';
import { FILE_TYPE } from './messageModel';
import registerLoginChatAccounts from '../../../utils/registerLoginChatAccounts';
import { RetinaImg } from 'mailspring-component-kit';
import FixedPopover from '../../../../../../src/components/fixed-popover';
import { checkToken, login, queryProfile, refreshChatAccountTokens } from '../../../utils/restjs';
import { isJsonStr } from '../../../utils/stringUtils';
import { AccountStore } from 'mailspring-exports';

import keyMannager from '../../../../../../src/key-manager';
import MemberProfile from '../conversations/MemberProfile';
import Notification from '../../../../../../src/components/notification';
import ThreadSearchBar from '../../../../../thread-search/lib/thread-search-bar';
import fs from "fs";
import https from "https";
import http from "http";
import ProgressBar from '../../common/ProgressBar';
import { MESSAGE_STATUS_UPLOAD_FAILED } from '../../../db/schemas/message';
import { beginStoringMessage } from '../../../actions/db/message';
import { updateSelectedConversation } from '../../../actions/db/conversation';
import { sendFileMessage } from '../../../utils/message';
const remote = require('electron').remote;
const { dialog } = remote;
const GROUP_CHAT_DOMAIN = '@muc.im.edison.tech';

window.registerLoginChatAccounts = registerLoginChatAccounts;

export default class MessagesPanel extends PureComponent {
  static propTypes = {
    deselectConversation: PropTypes.func.isRequired,
    sendMessage: PropTypes.func.isRequired,
    availableUsers: PropTypes.arrayOf(PropTypes.string),
    currentUserId: PropTypes.string,
    groupedMessages: PropTypes.arrayOf(
      PropTypes.shape({
        // sender: PropTypes.string.isRequired,
        time: PropTypes.string.isRequired,
        messages: PropTypes.arrayOf(
          PropTypes.shape({
            id: PropTypes.string.isRequired,
            conversationJid: PropTypes.string.isRequired,
            sender: PropTypes.string.isRequired,
            body: PropTypes.string.isRequired,
            sentTime: PropTypes.number.isRequired
          })
        ).isRequired
      })
    ),
    referenceTime: PropTypes.number,
    selectedConversation: PropTypes.shape({
      isGroup: PropTypes.bool.isRequired,
      jid: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      email: PropTypes.string,//.isRequired,
      avatar: PropTypes.string,
      occupants: PropTypes.arrayOf(PropTypes.string).isRequired,
    }),
  }

  static defaultProps = {
    availableUsers: [],
    currentUserId: null,
    groupedMessages: [],
    selectedConversation: null,
    referenceTime: new Date().getTime(),
  }

  state = {
    showConversationInfo: false,
    inviting: false,
    members: [],
    membersTemp: null,
    online: true,
    connecting: false,
    moreBtnEl: null,
    progress: {
      loadQueue: null
    },
  }

  onUpdateGroup = async (contacts) => {
    this.setState(Object.assign({}, this.state, { inviting: false }));
    const { selectedConversation } = this.props;
    if (contacts && contacts.length > 0) {
      if (selectedConversation.isGroup) {
        await Promise.all(contacts.map(contact => (
          xmpp.addMember(selectedConversation.jid, contact.jid, selectedConversation.curJid)
        )));
        this.refreshRoomMembers();
      } else {
        const roomId = uuid() + GROUP_CHAT_DOMAIN;
        const db = await getDb();
        if (!contacts.filter(item => item.jid === selectedConversation.jid).length) {
          const other = await db.contacts.findOne().where('jid').eq(selectedConversation.jid).exec();
          contacts.unshift(other);
        }
        if (!contacts.filter(item => item.jid === selectedConversation.curJid).length) {
          const owner = await db.contacts.findOne().where('jid').eq(selectedConversation.curJid).exec();
          contacts.unshift(owner);
        }
        const names = contacts.map(item => item.name);
        const chatName = names.slice(0, names.length - 1).join(', ') + ' & ' + names[names.length - 1];
        const { onGroupConversationCompleted } = this.props;
        onGroupConversationCompleted({ contacts, roomId, name: chatName, curJid: selectedConversation.curJid });
      }
    }
  }

  componentWillMount() {
  }
  componentDidMount() {
    this.refreshRoomMembers();
    this.getEmailContacts();
    window.addEventListener("online", this.onLine);
    window.addEventListener("offline", this.offLine);
  }
  componentWillUnmount() {
    window.removeEventListener("online", this.onLine);
    window.removeEventListener("offline", this.offLine);
  }

  getEmailContacts = async () => {
    let configDirPath = AppEnv.getConfigDirPath();
    let dbpath = path.join(configDirPath, 'edisonmail.db');
    const sqldb = sqlite(dbpath);
    const stmt = sqldb.prepare('SELECT * FROM contactName where sendToCount > 1  and recvFromCount >= 1');
    let emailContacts = stmt.all();
    sqldb.close();
    const chatAccounts = AppEnv.config.get('chatAccounts') || {};
    const email = Object.keys(chatAccounts)[0];
    let accessToken = await keyMannager.getAccessTokenByEmail(email);
    // let { err, res } = await checkToken(accessToken);
    // if (err || !res || res.resultCode !== 1) {
    await refreshChatAccountTokens()
    accessToken = await keyMannager.getAccessTokenByEmail(email);
    // }
    const emails = emailContacts.map(contact => contact.email);
    queryProfile({ accessToken, emails }, (err, res) => {
      if (!res) {
        console.log('fail to login to queryProfile');
        return;
      }
      if (isJsonStr(res)) {
        res = JSON.parse(res);
      }
      emailContacts = emailContacts.map((contact, index) => {
        contact = Object.assign(contact, res.data ? res.data.users[index] : {})
        if (contact.userId) {
          contact.jid = contact.userId + '@im.edison.tech'
        } else {
          contact.jid = contact.email.replace('@', '^at^') + '@im.edison.tech'
        }
        contact.curJid = this.getCurJidByAccountId(contact.accountId, chatAccounts);
        return contact;
      });
      emailContacts = emailContacts.filter(contact => !!contact.curJid);
      const state = Object.assign({}, this.state, { emailContacts });
      this.setState(state);
    })
  }

  getCurJidByAccountId(aid, chatAccounts) {
    const contact = AccountStore.accountForId(aid);
    const chatAcc = contact ? chatAccounts[contact.emailAddress] : null;
    return chatAcc ? chatAcc.userId + '@im.edison.tech' : null;
  }

  onLine = () => {
    // connect to chat server
    if (!this.props.chat_online) {
      this.reconnect();
    }
    const progress = Object.assign({}, this.state.progress, {offline:false});
    this.setState({
      online: true,
      progress,
    })
  }

  offLine = () => {
    const progress = Object.assign({}, this.state.progress, {offline:true, failed:true});
    this.setState({
      online: false,
      progress,
    })
  }

  componentWillReceiveProps = (nextProps) => {
    if (nextProps.selectedConversation
      && this.props.selectedConversation
      && nextProps.selectedConversation.jid !== this.props.selectedConversation.jid ||
      nextProps.selectedConversation && !this.props.selectedConversation) {
      this.refreshRoomMembers(nextProps);
      this.getNotifications(nextProps);
    }
  }
  getNotifications = () => {
    const { selectedConversation: conversation } = this.props;
    if (conversation && conversation.isGroup) {
      let notifications = chatModel.chatStorage.notifications || {};
      let jid = conversation.jid;
      notifications = notifications[jid] || [];
      setTimeout(() => {
        chatModel.chatStorage.notifications = chatModel.chatStorage.notifications || {}
        delete chatModel.chatStorage.notifications[jid];
        saveToLocalStorage();
      }, 3600000);

      return notifications;
    }
  }

  refreshRoomMembers = async (nextProps) => {
    const { selectedConversation: conversation } = (nextProps || this.props);
    if (conversation && conversation.isGroup) {
      let state = Object.assign({}, this.state, { loadingMembers: true });
      this.setState(state);
      const members = await this.getRoomMembers(nextProps);
      state = Object.assign({}, this.state, { loadingMembers: false });
      this.setState(state);
      if (conversation.update && members && members.length > 0) {
        conversation.update({
          $set: {
            roomMembers: members
          }
        })
      }
      for (let member of members) {
        const jid = member.jid.bare || member.jid;
        const nicknames = chatModel.chatStorage.nicknames;
        member.nickname = nicknames[jid] || '';
      };
      if (!this.state.members || !this.state.members.length || members && members.length) {
        const state = Object.assign({}, this.state, { members });
        this.setState(state);
      }
    }
  }

  getRoomMembers = async (nextProps) => {
    const { selectedConversation: conversation } = (nextProps || this.props);
    if (conversation && conversation.isGroup) {
      const result = await xmpp.getRoomMembers(conversation.jid, null, conversation.curJid);
      if (result && result.mucAdmin) {
        return result.mucAdmin.items;
      } else {
        return [];
      }
    }
    return [];
  }

  saveRoomMembersForTemp = (members) => {
    this.setState({ membersTemp: members })
  }

  toggleInvite = (moreBtnEl) => {
    this.setState({ inviting: !this.state.inviting, moreBtnEl });
  }

  onDragOver = (event) => {
    const state = Object.assign({}, this.state, { dragover: true });
    this.setState(state);
  }

  onDragEnd = (event) => {
    const state = Object.assign({}, this.state, { dragover: false });
    this.setState(state);
  }

  onDrop = (event) => {
    let tranFiles = event.dataTransfer.files,
      files = [];
    for (let i = 0; i < tranFiles.length; i++) {
      files.push(tranFiles[i].path);
    }
    const state = Object.assign({}, this.state, { dragover: false });
    this.setState(state);
    this.sendFile(files);
  }

  sendFile(files) {
    const { selectedConversation } = this.props;
    const onMessageSubmitted = this.props.sendMessage;
    const atIndex = selectedConversation.jid.indexOf('@');

    let jidLocal = selectedConversation.jid.slice(0, atIndex);

    files.map((file, index) => sendFileMessage(file, index, this, ' '));
  }

  createRoom = () => {
    const members = this.state.membersTemp;
    if (members && members.length) {
      const { onGroupConversationCompleted, onPrivateConversationCompleted } = this.props;
      if (members.length > 4 && onGroupConversationCompleted) {
        const roomId = uuid() + GROUP_CHAT_DOMAIN;
        const names = members.map(item => item.name);
        const chatName = names.slice(0, 3).join(', ') + ' & ' + `${names.length - 3} others`;
        onGroupConversationCompleted({ contacts: members, roomId, name: chatName, curJid: members[0].curJid });
      }
      else if (members.length > 1 && onGroupConversationCompleted) {
        const roomId = uuid() + GROUP_CHAT_DOMAIN;
        const names = members.map(item => item.name);
        const chatName = names.slice(0, names.length - 1).join(', ') + ' & ' + names[names.length - 1];
        onGroupConversationCompleted({ contacts: members, roomId, name: chatName, curJid: members[0].curJid });
      }
      else if (members.length == 1 && onPrivateConversationCompleted) {
        onPrivateConversationCompleted(members[0]);
      }
    }
  }

  removeMember = member => {
    const conversation = this.props.selectedConversation;
    if (member.affiliation === 'owner') {
      alert('you can not remove the owner of the group chat!');
      return;
    }
    const jid = typeof member.jid === 'object' ? member.jid.bare : member.jid;
    xmpp.leaveRoom(conversation.jid, jid);
    if (jid == conversation.curJid) {
      (getDb()).then(db => {
        db.conversations.findOne(conversation.jid).exec().then(conv => {
          conv.remove()
        }).catch((error) => { })
      });
      this.props.deselectConversation();
    } else {
      this.refreshRoomMembers();
    }
  };

  editMemberProfile = member => {
    const state = Object.assign({}, this.state, { editingMember: member });
    this.setState(state);
  }

  exitMemberProfile = async member => {
    const db = await getDb();
    const jid = member.jid.bare || member.jid;
    const nicknames = chatModel.chatStorage.nicknames;
    // const contact = await db.contacts.findOne().where('jid').eq(jid).exec();
    if (nicknames[jid] != member.nickname) {
      nicknames[jid] = member.nickname;
      saveToLocalStorage();
    }
    const state = Object.assign({}, this.state, { editingMember: null });
    this.setState(state);
  }

  reconnect = () => {
    registerLoginChatAccounts();
  }

  loadQueue = null;
  loading = false;
  loadIndex = 0;

  queueLoadMessage = (loadConfig) => {
    // console.log('dbg*** queueLoadMessage: ', loadConfig);
    this.loadQueue = this.loadQueue || [];
    this.loadQueue.push(loadConfig);
    if (!this.loading) {
      this.loadMessage();
    }
  };

  retryLoadMessage = () => {
    // console.log('dbg*** retryLoadMessage');
    const progress = Object.assign({}, this.state.progress, { failed: false });
    const state = Object.assign({}, this.state, { progress });
    this.setState(state);
    // here setTimeout is necessary, because setState is asynchronous,
    // otherwise progress.failed will be set to true in this.loadMessage again
    setTimeout(() => {
      this.loadMessage();
    })
  };

  cancelLoadMessage = () => {
    const loadConfig = this.loadQueue[this.loadIndex];
    if (loadConfig && loadConfig.request && loadConfig.request.abort) {
      // console.log('dbg*** cancelLoadMessage: ', loadConfig.request);
      loadConfig.request.abort();
    }
    this.loadQueue = null;
    this.loadIndex = 0;
    this.loading = false;
    const progress = { loadQueue: this.loadQueue };
    const state = Object.assign({}, this.state, { progress });
    this.setState(state);
    clearInterval(this.loadTimer);
  }

  loadMessage = () => {
    this.loading = true;
    const loadConfig = this.loadQueue[this.loadIndex];
    const { msgBody, filepath } = loadConfig;
    const progress = Object.assign({}, this.state.progress, { loadQueue: this.loadQueue, loadIndex: this.loadIndex, percent: 0 });
    const state = Object.assign({}, this.state, { progress });
    this.setState(state);

    const loadCallback = (...args) => {
      const loadConfig = this.loadQueue[this.loadIndex];
      // console.log('dbg*** loadCallback: ', loadConfig);
      this.loadIndex++;
      if (this.loadIndex === this.loadQueue.length) {
        const progress = Object.assign({}, this.state.progress, { loadQueue: this.loadQueue, loadIndex: this.loadIndex });
        const state = Object.assign({}, this.state, { progress });
        this.setState(state);
        this.loading = false;
        clearInterval(this.loadTimer);
      } else {
        this.loadMessage();
      }
      if (loadConfig.type === 'upload') {
        const onMessageSubmitted = this.props.sendMessage;
        const [err, _, myKey, size] = args;
        const conversation = loadConfig.conversation;
        const messageId = loadConfig.messageId;
        let body = loadConfig.msgBody;
        body.type = FILE_TYPE.OTHER_FILE;
        body.isUploading = false;
        body.mediaObjectId = myKey;
        // console.log('dbg*** before onMessageSubmitted body: ', body);
        body = JSON.stringify(body);
        if (err) {
          console.error(`${conversation.name}:\nfile(${filepath}) transfer failed because error: ${err}`);
          const message = {
            id: messageId,
            conversationJid: conversation.jid,
            body,
            sender: conversation.curJid,
            sentTime: (new Date()).getTime() + chatModel.diffTime,
            status: MESSAGE_STATUS_UPLOAD_FAILED,
          };
          chatModel.store.dispatch(beginStoringMessage(message));
          chatModel.store.dispatch(updateSelectedConversation(conversation));
          return;
        } else {
          onMessageSubmitted(conversation, body, messageId, false);
        }
      }
    }

    const loadProgressCallback = progress => {
      const {loaded, total} = progress;
      // console.log('dbg*** loadProgressCallback: ', loaded, total);
      const percent = Math.floor(+loaded*100.0/(+total));
      progress = Object.assign({}, this.state.progress, { percent });
      const state = Object.assign({}, this.state, { progress });
      this.setState(state);
    }
    // console.log('dbg*** loadMessage: ', loadConfig, msgBody);
    if ( loadConfig.type === 'upload') {
      const conversation = loadConfig.conversation;
      const atIndex = conversation.jid.indexOf('@');
      let jidLocal = conversation.jid.slice(0, atIndex);
      loadConfig.request = uploadFile(jidLocal, null, loadConfig.filepath, loadCallback, loadProgressCallback);
    } else if (msgBody.timeSend || msgBody.path && msgBody.path.match(/^file:\/\//)) {
      // the file is an image and it has been downloaded to local while the message was received
      let imgpath = msgBody.path.replace('file://', '');
      fs.copyFileSync(imgpath, filepath);
      loadCallback();
    } else if (!msgBody.mediaObjectId.match(/^https?:\/\//)) {
      // the file is on aws
      loadConfig.request = downloadFile(msgBody.aes, msgBody.mediaObjectId, filepath, loadCallback, loadProgressCallback);
    } else {
      // the file is a link to the web outside aws
      let request;
      if (msgBody.mediaObjectId.match(/^https/)) {
        request = https;
      } else {
        request = http;
      }
      request.get(msgBody.mediaObjectId, function (res) {
        var imgData = '';
        res.setEncoding('binary');
        res.on('data', function (chunk) {
          imgData += chunk;
        });
        res.on('end', function () {
          fs.writeFile(filepath, imgData, 'binary', function (err) {
            if (err) {
              console.log('down fail');
            } else {
              console.log('down success');
            }
            loadCallback();
          });
        });
      });
    }

    if (this.loadTimer) {
      clearInterval(this.loadTimer);
    }
    this.loadTimer = setInterval(() => {
      const loadConfig = this.loadQueue[this.loadIndex];
      if (loadConfig && loadConfig.request && loadConfig.request.failed) {
        const progress = Object.assign({}, this.state.progress, {failed:true});
        const state = Object.assign({}, this.state, {progress});
        this.setState(state);
      }
    }, 10000);
  }

  render() {
    const { showConversationInfo, inviting, members } = this.state;
    const {
      deselectConversation,
      sendMessage,
      availableUsers,
      groupedMessages,
      selectedConversation,
      referenceTime,
      contacts
    } = this.props;
    groupedMessages.map(group => group.messages.map(message => {
      members.map(member => {
        const jid = member.jid.bare || member.jid;
        if (jid === message.sender) {
          message.senderNickname = member.nickname || message.senderNickname;
        }
      });
    }));
    const currentUserId = selectedConversation && selectedConversation.curJid ? selectedConversation.curJid : NEW_CONVERSATION;

    const topBarProps = {
      onBackPressed: () => {
        deselectConversation();
        this.setState({ showConversationInfo: false });
      },
      onInfoPressed: () =>
        this.setState({ showConversationInfo: !this.state.showConversationInfo }),
      toggleInvite: this.toggleInvite,
      availableUsers,
      infoActive: showConversationInfo,
      selectedConversation,
      inviting: this.state.inviting
    };
    const messagesProps = {
      currentUserId,
      groupedMessages,
      referenceTime,
      selectedConversation,
      onMessageSubmitted: sendMessage,
      queueLoadMessage: this.queueLoadMessage,
    };
    const notifications = this.getNotifications() || [];
    const notificationsProps = {
      notifications,
    };
    const sendBarProps = {
      onMessageSubmitted: sendMessage,
      selectedConversation,
      queueLoadMessage: this.queueLoadMessage,
    };
    const infoProps = {
      selectedConversation,
      deselectConversation: this.props.deselectConversation,
      toggleInvite: this.toggleInvite,
      members: this.state.members,
      loadingMembers: this.state.loadingMembers,
      getRoomMembers: this.getRoomMembers,
      refreshRoomMembers: this.refreshRoomMembers,
      removeMember: this.removeMember,
      editMemberProfile: this.editMemberProfile,
      exitMemberProfile: this.exitMemberProfile,
    };
    const contactsSet = {};
    contacts.forEach(contact => {
      contactsSet[contact.email] = 1;
      return
    });
    let allContacts = contacts.slice();
    this.state.emailContacts && this.state.emailContacts.forEach(contact => {
      if (contactsSet[contact.email]) {
        return;
      } else {
        contactsSet[contact.email] = 1;
        allContacts.push(contact);
      }
    });

    const newConversationProps = {
      contacts: allContacts,
      saveRoomMembersForTemp: this.saveRoomMembersForTemp,
      deselectConversation,
      createRoom: this.createRoom
    }

    return (
      <div className="panel"
        onDragOverCapture={this.onDragOver}
        onDragEnd={this.onDragEnd}
        onMouseLeave={this.onDragEnd}
        onDrop={this.onDrop}
      >
        {selectedConversation ?
          <div className="chat">
            <div className="splitPanel">
              {
                selectedConversation.jid === NEW_CONVERSATION ? (
                  <div className="chatPanel">
                    <NewConversationTopBar {...newConversationProps} />
                  </div>
                ) : (
                    <div className="chatPanel">
                      <MessagesTopBar {...topBarProps} />
                      <ProgressBar progress={this.state.progress} onCancel={this.cancelLoadMessage} onRetry={this.retryLoadMessage}/>
                      <Messages {...messagesProps} sendBarProps={sendBarProps} />
                      <Notifications {...notificationsProps} sendBarProps={sendBarProps} />
                      {this.state.dragover && (
                        <div id="message-dragdrop-override"></div>
                      )}
                      <div>
                        <MessagesSendBar {...sendBarProps} />
                      </div>
                    </div>
                  )
              }
              <Divider type="vertical" />
              <CSSTransitionGroup
                transitionName="transition-slide"
                transitionLeaveTimeout={250}
                transitionEnterTimeout={250}
              >
                {showConversationInfo && selectedConversation.jid !== NEW_CONVERSATION && (
                  <div className="infoPanel">
                    <ConversationInfo {...infoProps} />
                  </div>
                )}
              </CSSTransitionGroup>
            </div>
          </div> :
          <div className="unselectedHint">
            <span>
              <RetinaImg name={`EmptyChat.png`} mode={RetinaImg.Mode.ContentPreserve} />
            </span>
          </div>
        }
        {(!this.state.online || !this.props.chat_online) && (
          <div className="network-offline">
            {this.state.online ? (
              this.props.isAuthenticating ? (
                <div>
                  <RetinaImg name={'no-network.svg'}
                    style={{ width: 15 }}
                    isIcon
                    mode={RetinaImg.Mode.ContentIsMask} />
                  <span>Your computer appears to be offline. Edison Mail is trying to reconnect. </span>
                  <span className="reconnect" onClick={this.reconnect}>Reconnect Now</span>
                </div>
              ) : (
                  <span className="reconnect" onClick={this.reconnect}>Reconnect Now</span>
                )
            ) : (<div>
              <RetinaImg name={'no-network.svg'}
                style={{ width: 15 }}
                isIcon
                mode={RetinaImg.Mode.ContentIsMask} />
              <span>Your computer appears to be offline.</span>
            </div>)}
          </div>
        )}
        {inviting && selectedConversation.jid !== NEW_CONVERSATION && (
          <FixedPopover {...{
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
          }}>
            <InviteGroupChatList contacts={allContacts} groupMode={true} onUpdateGroup={this.onUpdateGroup} />
          </FixedPopover>
        )}
        {
          (this.state.editingMember) ? (
            <MemberProfile conversation={selectedConversation} exitMemberProfile={this.exitMemberProfile} member={this.state.editingMember} onPrivateConversationCompleted={this.props.onPrivateConversationCompleted}>
            </MemberProfile>
          ) : null
        }
      </div>
    );
  }
}
