import fs from 'fs'
import { Observable } from 'rxjs/Observable';
import { replace } from 'react-router-redux';
import xmpp from '../xmpp';
import getDb from '../db';
import chatModel from '../store/model';
import { saveGroupMessages } from '../utils/db-utils';

import {
  MESSAGE_STATUS_FILE_UPLOADING,
  MESSAGE_STATUS_SENDING,
  MESSAGE_STATUS_DELIVERED,
  MESSAGE_STATUS_RECEIVED,
} from '../db/schemas/message';
import { postNotification } from '../utils/electron';
import {
  BEGIN_SEND_MESSAGE,
  RECEIVE_CHAT,
  RECEIVE_GROUPCHAT,
  MESSAGE_SENT,
  RECEIVE_PRIVATE_MESSAGE,
  RECEIVE_GROUP_MESSAGE,
  SENDING_MESSAGE,
  SUCCESS_SEND_MESSAGE,
  CREATE_PRIVATE_CONVERSATION,
  CREATE_GROUP_CONVERSATION,
  SHOW_CONVERSATION_NOTIFICATION,
  GO_PREV_CONVERSATION,
  GO_NEXT_CONVERSATION,
  receivePrivateMessage,
  receiveGroupMessage,
  receiptSent,
  successfullySentMessage,
  newMessage,
  sendingMessage,
  selectConversation,
  showConversationNotification,
} from '../actions/chat';
import {
  UPDATE_SELECTED_CONVERSATION,
  beginStoringConversations,
} from '../actions/db/conversation';
import {
  retrieveSelectedConversationMessages,
} from '../actions/db/message';
import { isJsonString } from '../utils/stringUtils';
import { encryptByAES, decryptByAES, encryptByAESFile, decryptByAESFile, generateAESKey } from '../utils/aes';
import { encrypte, decrypte } from '../utils/rsa';
import { getPriKey, getDeviceId } from '../utils/e2ee';
import { downloadFile } from '../utils/awss3';

const downloadAndTagImageFileInMessage = (aes, payload) => {
  let body;
  if (aes) {
    body = decryptByAES(aes, payload.payload);
  } else {
    body = payload.body;
  }
  let msgBody = JSON.parse(body);
  if (msgBody.mediaObjectId && msgBody.mediaObjectId.match(/^https?:\/\//)) {
    // a img link
    msgBody.path = msgBody.mediaObjectId;
  } else if (msgBody.mediaObjectId && msgBody.mediaObjectId.match(/\.(jpeg|jpg|gif|png|bmp)(\.encrypted)?$/)) {
    // image file on aws
    let name = msgBody.mediaObjectId;
    name = name.split('/')[1]
    name = name.replace(/\.encrypted$/, '');
    let path = AppEnv.getConfigDirPath();
    let downpath = path + '/download/';
    if (!fs.existsSync(downpath)) {
      fs.mkdirSync(downpath);
    }
    path = downpath + name;
    msgBody.path = 'file://' + path;
    downloadFile(aes, msgBody.mediaObjectId, path);
  }
  if (aes) {
    msgBody.aes = aes;
  }
  payload.body = JSON.stringify(msgBody);
  return;
}

export const receiptSentEpic = action$ =>
  action$.ofType(MESSAGE_SENT)
    .filter(({ payload }) => payload.receipt && !payload.body)
    .map(({ payload }) => receiptSent(payload.id));

export const successSendMessageEpic = action$ =>
  action$.ofType(MESSAGE_SENT)
    .filter(({ payload }) => !payload.receipt && payload.body)
    .map(({ payload }) => successfullySentMessage(payload));

export const sendMessageEpic = action$ =>
  action$.ofType(BEGIN_SEND_MESSAGE)
    .mergeMap(
      ({ payload }) => Observable.fromPromise(getDb())
        .map(db => ({ db, payload })),
    )//yazzzzz
    .mergeMap(({ db, payload }) => {
      if (payload.conversation.isGroup) {//yazz 区分群聊和非群聊
        let occupants = payload.conversation.occupants;
        return Observable.fromPromise(db.e2ees.find({ jid: { $in: occupants } }).exec())
          .map(e2ees => {
            let devices = [];
            if (e2ees && e2ees.length == occupants.length) {
              e2ees.forEach((e2ee => {
                let device = {};
                device.dk = JSON.parse(e2ee.devices);
                device.jid = e2ee.jid;
                devices.push(device);
              }));
              console.log(devices)
            }
            payload.devices = devices;//e2ee.devices;
            return { db, payload };
          });
      } else {
        return Observable.fromPromise(db.e2ees.findOne(payload.conversation.jid).exec())
          .map(e2ee => {
            if (e2ee) {
              payload.devices = e2ee.devices;
            }
            return { db, payload };
          });
      }
    })
    .mergeMap(({ db, payload }) => {
      return Observable.fromPromise(db.e2ees.findOne(payload.conversation.curJid).exec())
        .map(e2ee => {
          if (e2ee) {
            payload.selfDevices = e2ee.devices;
          }
          return { payload };
        });
    })
    .mergeMap(({ payload }) => {
      return Observable.fromPromise(getDeviceId()).map((deviceId) => {
        return { payload, deviceId };
      });
    })
    .map(({ payload: { conversation, body, id, devices, selfDevices, isUploading, updating }, deviceId }) => {
      let ediEncrypted;
      if (devices) {
        ediEncrypted = getEncrypted(conversation.jid, body, devices, selfDevices, conversation.curJid, deviceId);
      }
      if (ediEncrypted) {
        return ({
          id,
          ediEncrypted: ediEncrypted,
          to: conversation.jid,
          type: conversation.isGroup ? 'groupchat' : 'chat',
          isUploading,
          curJid: conversation.curJid,
          updating
        });
      } else {
        return ({
          id,
          body: body,
          to: conversation.jid,
          type: conversation.isGroup ? 'groupchat' : 'chat',
          isUploading,
          curJid: conversation.curJid,
          updating
        });
      }
    })
    // .map(({ payload: { conversation, body, id } }) => {
    //   return ({
    //     id,
    //     body,
    //     to: conversation.jid,
    //     type: conversation.isGroup ? 'groupchat' : 'chat'
    //   })
    // })
    .map(message => {
      const action = sendingMessage(message);
      let payload = message;
      if (!payload.isUploading) {
        let body = payload.body;
        if (typeof body === 'string') {
          try {
            body = JSON.parse(body);
            delete body.localFile;
            payload = Object.assign({}, payload);
            payload.body = JSON.stringify(body);
          } catch (e) {
          }
        }
        xmpp.sendMessage(payload, payload.curJid);
      }
      return action;
    })

export const newTempMessageEpic = (action$, { getState }) =>
  action$.ofType(SENDING_MESSAGE)//yazzz2
    .mergeMap((payload) => {
      return Observable.fromPromise(getPriKey()).map(({ deviceId, priKey }) => {
        return { payload: payload.payload, deviceId, priKey };
      });
    })
    .map(({ payload, deviceId, priKey }) => {
      const curJid = payload.curJid;
      const curJidLocal = curJid ? curJid.split('@')[0] : '';
      if (payload.ediEncrypted) {
        let keys = payload.ediEncrypted.header.key;//JSON.parse(msg.body);
        let text = getAes(keys, curJidLocal, deviceId);
        if (text) {
          let aes = decrypte(text, priKey);//window.localStorage.priKey);
          payload.body = decryptByAES(aes, payload.ediEncrypted.payload);
        }
      }
      const message = {
        id: payload.id,
        conversationJid: payload.to,
        sender: curJid,
        body: payload.body,// || payload.ediEncrypted,//yazzz3
        sentTime: (new Date()).getTime(),
        status: payload.isUploading ? MESSAGE_STATUS_FILE_UPLOADING : MESSAGE_STATUS_SENDING,
      };
      if (payload.updating) {
        message.updateTime = (new Date()).getTime()
      } else {
        message.sentTime = (new Date()).getTime()
      }
      return message;
    })
    .map(newPayload => newMessage(newPayload));
const getAes = (keys, curJid, deviceId) => {
  if (keys) {
    let text;
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      if (key.uid == curJid
        && key.rid == deviceId) {
        text = key.text;
        break;
      }
    }
    ;
    return text;
  }
};
export const convertSentMessageEpic = action$ =>
  action$.ofType(SUCCESS_SEND_MESSAGE)
    .map(({ payload }) => ({
      id: payload.id,
      conversationJid: payload.to.bare,
      sender: payload.from.bare,
      body: payload.body,
      sentTime: (new Date()).getTime(),
      status: MESSAGE_STATUS_DELIVERED,
    }))
    .delay(500) // need this delay to combat super fast network
    .map(newPayload => newMessage(newPayload));

export const updateSentMessageConversationEpic = (action$, { getState }) =>
  action$.ofType(SUCCESS_SEND_MESSAGE)
    .mergeMap(({ payload: message }) =>
      Observable.fromPromise(getDb())
        .map(db => ({ db, message })),
    )
    .mergeMap(({ db, message }) =>
      Observable.fromPromise(db.conversations.findOne(message.to.bare).exec())
        .map(conversation => {
          let conv = conversation;
          if (!conversation) {
            const { chat: { selectedConversation } } = getState();
            conv = selectedConversation;
          }
          let content = message.body;
          if (isJsonString(message.body)) {
            content = JSON.parse(message.body).content;
          }
          return Object.assign({}, JSON.parse(JSON.stringify(conv)), {
            lastMessageTime: (new Date()).getTime(),
            lastMessageText: content,
            lastMessageSender: message.from.bare,
            _rev: undefined,
          });
        }),
    )
    .map(conversation => beginStoringConversations([conversation]));

export const receivePrivateMessageEpic = action$ =>
  action$.ofType(RECEIVE_CHAT)
    .mergeMap((payload) => {
      return Observable.fromPromise(getPriKey()).map(({ deviceId, priKey }) => {
        return { payload: payload.payload, deviceId, priKey };
      });
    })
    .filter(({ payload, deviceId, priKey }) => {
      if (payload.payload) {
        let jidLocal = payload.curJid.substring(0, payload.curJid.indexOf('@'));
        let keys = payload.keys;//JSON.parse(msg.body);
        if (keys[jidLocal]
          && keys[jidLocal][deviceId]) {
          let text = keys[jidLocal][deviceId];
          if (text) {
            let aes = decrypte(text, priKey); //window.localStorage.priKey);
            downloadAndTagImageFileInMessage(aes, payload);
          }
        }
      } else {
        downloadAndTagImageFileInMessage(null, payload);
      }
      return payload.body;
    })
    // get the latest name for display
    .mergeMap(
      ({ payload }) => Observable.fromPromise(getDb())
        .map(db => ({ db, payload })),
    )
    .mergeMap(({ db, payload }) => {
      return Observable.fromPromise(db.contacts.findOne(payload.from.bare).exec())
        .map(contact => {
          if (contact) {
            payload.from.local = contact.name;
          }
          return { payload };
        });
    })
    .map(({ payload }) => receivePrivateMessage(payload));

export const receiveGroupMessageEpic = action$ =>
  action$.ofType(RECEIVE_GROUPCHAT)
    .mergeMap((payload) => {
      return Observable.fromPromise(getPriKey()).map(({ deviceId, priKey }) => {
        return { payload: payload.payload, deviceId, priKey };
      });
    })
    .filter(({ payload, deviceId, priKey }) => {
      if (payload.payload) {
        let jidLocal = payload.curJid.substring(0, payload.curJid.indexOf('@'));
        let keys = payload.keys;//JSON.parse(msg.body);
        if (keys[jidLocal]
          && keys[jidLocal][deviceId]) {
          let text = keys[jidLocal][deviceId];
          if (text) {
            let aes = decrypte(text, priKey);//window.localStorage.priKey);
            downloadAndTagImageFileInMessage(aes, payload);
          }
        }
      } else {
        downloadAndTagImageFileInMessage(null, payload);
      }
      return payload.body;
    })
    .map(({ payload }) => receiveGroupMessage(payload));

export const convertReceivedMessageEpic = (action$, { getState }) =>
  action$.ofType(RECEIVE_PRIVATE_MESSAGE, RECEIVE_GROUP_MESSAGE)
    .map(({ type, payload }) => {
      const { timeSend } = JSON.parse(payload.body);
      let sender = payload.from.bare;
      // if groupchat, display the sender name
      if (type === RECEIVE_GROUP_MESSAGE) {
        const reduxStore = getState();
        // If the sender is your self
        if (payload.from.resource === reduxStore.auth.currentUser.local) {
          sender = reduxStore.auth.currentUser.bare
        } else {
          sender = payload.from.resource + '@im.edison.tech';
        }
      }
      return {
        id: payload.id,
        conversationJid: payload.from.bare,
        sender: sender,
        body: payload.body,
        sentTime: (new Date(timeSend)).getTime(),
        status: MESSAGE_STATUS_RECEIVED,
      };
    })
    .map(newPayload => newMessage(newPayload));

export const updateMessageConversationEpic = (action$, { getState }) =>
  action$.ofType(RECEIVE_PRIVATE_MESSAGE, RECEIVE_GROUP_MESSAGE)
    .mergeMap(({ type, payload }) => {
      let beAt = false;
      let name = payload.from.local;
      // if group chat, get the room name and whether you are '@'
      if (type === RECEIVE_GROUP_MESSAGE) {
        const { room: { rooms }, auth } = getState();
        const body = JSON.parse(payload.body);
        beAt = !body.atJids || body.atJids.indexOf(auth.currentUser.bare) === -1 ? false : true;
        if (rooms[payload.from.bare]) {
          name = rooms[payload.from.bare];
        } else {
          return Observable.fromPromise(xmpp.getRoomList())
            .map(({ discoItems: { items } }) => {
              if (items) {
                for (const item of items) {
                  if (payload.from.local === item.jid.local) {
                    return { type, payload, name: item.name, beAt };
                  }
                }
              }
              return { type, payload, name, beAt };
            });
        }
      }
      return [{ type, payload, name, beAt }];
    })
    .map(({ type, payload, name, beAt }) => {
      let at = false;
      const { content, timeSend } = JSON.parse(payload.body);
      // if not current conversation, unreadMessages + 1
      let unreadMessages = 0;
      const { chat: { selectedConversation } } = getState();
      if (!selectedConversation || selectedConversation.jid !== payload.from.bare) {
        unreadMessages = 1;
        at = beAt;
      }
      return {
        jid: payload.from.bare,
        curJid: payload.curJid,
        name: name,
        isGroup: type === RECEIVE_GROUP_MESSAGE ? true : false,
        unreadMessages: unreadMessages,
        occupants: [
          payload.from.bare,
          payload.to.bare,
        ],
        lastMessageTime: (new Date(timeSend)).getTime(),
        lastMessageText: content,
        lastMessageSender: payload.from.bare,
        at
      };
    })
    .map(conversation => beginStoringConversations([conversation]));

export const beginRetrievingMessagesEpic = action$ =>
  action$.ofType(UPDATE_SELECTED_CONVERSATION)
    .map(({ payload: { jid } }) => {
      if (chatModel.conversationJid != jid) {
        saveGroupMessages(chatModel.groupedMessages);
      }
      chatModel.conversationJid = jid;
      return retrieveSelectedConversationMessages(jid);

    });

export const conversationCreatedEpic = action$ =>
  action$.ofType(CREATE_PRIVATE_CONVERSATION, CREATE_GROUP_CONVERSATION)
    .map(() => replace('/chat'));

// TODO: Handle group conversations
export const triggerNotificationEpic = action$ =>
  action$.ofType(RECEIVE_PRIVATE_MESSAGE, RECEIVE_GROUP_MESSAGE)
    .map(({ payload: { from: { bare: conversationJid, local: title }, body } }) => {
      const { content } = JSON.parse(body);
      return showConversationNotification(conversationJid, title, content);
    });

export const showConversationNotificationEpic = (action$, { getState }) =>
  action$.ofType(SHOW_CONVERSATION_NOTIFICATION)
    .map(({ payload: { conversationJid, title, body } }) => ({
      jid: conversationJid,
      notification: postNotification(title, body),
    }))
    .filter(({ notification }) => notification !== null)
    .mergeMap(({ jid, notification }) =>
      Observable.fromEvent(notification, 'click')
        .take(1)
        .filter(() => {
          const { chat: { selectedConversation } } = getState();
          return !selectedConversation || selectedConversation.jid !== jid;
        })
        .map(() => selectConversation(jid)),
    );

export const goPrevConversationEpic = (action$, { getState }) =>
  action$.ofType(GO_PREV_CONVERSATION)
    .filter(() => !!getState().auth.currentUser)
    .map(() => {
      const { chat: { selectedConversation, conversations } } = getState();
      const jid = selectedConversation ? selectedConversation.jid : null;
      const jids = conversations.map(conv => conv.jid);
      const selectedIndex = jids.indexOf(jid);
      return { jids, selectedIndex };
    })
    .filter(({ jids, selectedIndex }) => jids.length > 1 && selectedIndex > 0)
    .map(({ jids, selectedIndex }) => selectConversation(jids[selectedIndex - 1]));

export const goNextConversationEpic = (action$, { getState }) =>
  action$.ofType(GO_NEXT_CONVERSATION)
    .filter(() => !!getState().auth.currentUser)
    .map(() => {
      const { chat: { selectedConversation, conversations } } = getState();
      const jid = selectedConversation ? selectedConversation.jid : null;
      const jids = conversations.map(conv => conv.jid);
      const selectedIndex = jids.indexOf(jid);
      return { jids, selectedIndex };
    })
    .filter(({ jids }) => jids.length > 0)
    .filter(({ jids, selectedIndex }) => selectedIndex === -1 || selectedIndex < jids.length - 1)
    .map(({ jids, selectedIndex }) => selectConversation(jids[selectedIndex + 1]));

const getEncrypted = (jid, body, devices, selfDevices, curJid, deviceId) => {
  let aeskey = generateAESKey();
  let uid = jid.substring(0, jid.indexOf('@'));//new JID(jid).local;//.substring(0,jid.indexOf('@'));
  let selfDk = JSON.parse(selfDevices);
  let dk = [];

  let keys = [];
  if (typeof devices == "string") {
    dk = JSON.parse(devices);
    keys = addKeys(uid, dk, aeskey, keys);
    if (keys.length > 0) {
      keys = addKeys(curJid, selfDk, aeskey, keys);
    }
  } else {
    devices.forEach(device => {
      keys = addKeys(device.jid, device.dk, aeskey, keys);
    });
  }

  //对称加密body
  if (keys.length > 0) {
    //keys = addKeys(window.localStorage.jidLocal, selfDk, aeskey, keys);
    let ediEncrypted = {
      header: {
        sid: deviceId,
        key: keys,
      },
      payload: encryptByAES(aeskey, body),
    };
    return ediEncrypted;

  }
  return false;
};
const addKeys = (jid, dk, aeskey, keys) => {
  for (let i in dk) {
    let did = dk[i];
    if (!did.key || did.key.length < 10) {
      continue;
    }
    let uid = jid;
    if (jid.indexOf('@') > 0) {
      uid = jid.substring(0, jid.indexOf('@'));
    }
    let key = {
      uid: uid,
      rid: did.id,
      text: encrypte(did.key, aeskey),
    };
    keys.push(key);
  }
  return keys;
};
