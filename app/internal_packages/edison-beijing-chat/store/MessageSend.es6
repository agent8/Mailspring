import { FILE_TYPE, MESSAGE_TYPE } from '../utils/filetypes';
import xmpp from '../xmpp';
import {
  MESSAGE_STATUS_FILE_UPLOADING,
  MESSAGE_STATUS_SENDING,
  MESSAGE_STATUS_DELIVERED,
} from '../model/Message';
import uuid from 'uuid/v4';
import { MessageStore, E2eeStore, RoomStore } from 'chat-exports';
import { encryptByAES, decryptByAES, generateAESKey } from '../utils/aes';
import { encrypte, decrypte } from '../utils/rsa';
import { getDeviceId } from '../utils/e2ee';

class MessageSend {
  sendMessage = async (body, conversation, messageId, updating, aes) => {
    const { curJid, jid, isGroup } = conversation;
    const from = curJid, to = jid;
    messageId = messageId || uuid();
    let dbMessageId;
    if (messageId.indexOf('$') < 0) {
      dbMessageId = messageId + '$' + from;
    } else {
      dbMessageId = messageId;
    }
    const strBody = JSON.stringify(body);
    const dbMsg = await MessageStore.getMessageById(dbMessageId);
    const sentTime = updating ? dbMsg && dbMsg.sentTime : new Date().getTime() + window.edisonChatServerDiffTime;
    const msg = {
      body: strBody,
      conversationJid: to,
      sender: from,
      sentTime,
      status: MESSAGE_STATUS_SENDING,
      id: `${messageId}$${to}`
    };
    MessageStore.saveMessagesAndRefresh([msg]);
    let message = {
      id: messageId,
      to,
      type: isGroup ? MESSAGE_TYPE.GROUP : MESSAGE_TYPE.CHAT
    };
    let devices = await this.getDevices(from, to, isGroup);
    if (devices && devices.length > 0) {
      const deviceId = await getDeviceId();
      const ediEncrypted = this.getEncrypted(strBody, devices, deviceId, aes);
      if (ediEncrypted) {
        message.ediEncrypted = ediEncrypted;
      }
    }
    if (!message.ediEncrypted) {
      message.body = strBody;
    }
    console.log('occupants.message', message);
    xmpp.sendMessage(message, from);
  };

  getDevices = async (from, to, isGroup) => {
    let devices = [];
    if (isGroup) {
      const occupants = await RoomStore.getConversationOccupants(to, from);
      const e2ees = await E2eeStore.find(occupants);
      console.log('occupants', occupants, e2ees);
      if (e2ees && e2ees.length == occupants.length) {
        e2ees.forEach((e2ee => {
          let device = {};
          device.dk = e2ee.devices;
          device.jid = e2ee.jid;
          devices.push(device);
        }));
      }
    } else {
      let e2ee = await E2eeStore.findOne(to);
      if (e2ee) {
        devices.push({ dk: e2ee.devices, jid: to });
        e2ee = await E2eeStore.findOne(from);
        if (e2ee) {
          devices.push({ dk: e2ee.devices, jid: from });
        }
      }
    }
    return devices;

  };

  getAESKey = async (conversation) => {
    const { curJid, jid, isGroup } = conversation;
    let devices = await this.getDevices(curJid, jid, isGroup);
    if (devices && devices.length > 0) {
      let aeskey = generateAESKey();
      let keys = this.addKeys(devices, aeskey);
      if (keys && keys.length > 0) {
        return aeskey;
      }
    }
    return null;
  }

  getEncrypted = (body, devices, deviceId, aes) => {
    let aeskey = aes;
    if (!aeskey) { aeskey = generateAESKey(); }
    let keys = this.addKeys(devices, aeskey);
    //对称加密body
    if (keys && keys.length > 0) {
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

  addKeys = (dks, aeskey) => {
    let keys = [];
    for (let j in dks) {
      let device = dks[j];
      let jid = device.jid;
      let uid = jid.split('@')[0];
      let dk = device.dk;
      for (let i in dk) {
        let did = dk[i];
        if (!did.key || did.key.length < 10) {
          continue;
        }
        let key = {
          uid: uid,
          rid: did.id,
          text: encrypte(did.key, aeskey),
        };
        keys.push(key);
      }
    }
    return keys;
  };
}
module.exports = new MessageSend();
