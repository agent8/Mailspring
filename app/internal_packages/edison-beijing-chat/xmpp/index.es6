import Stanza, { Client } from '../../../src/xmpp/stanza.io';
import EventEmitter3 from 'eventemitter3';
import { Observable } from 'rxjs/Observable';

/**
 * The interval between requests to join rooms
 */
const JOIN_INTERVAL = 5;
export class Xmpp extends EventEmitter3 {
  tmpData = {};
  xmppMap = {};
  init(credentials) {
    let jid = credentials.jid;
    if (jid.indexOf('/') > 0) {
      jid = jid.substring(0, jid.indexOf('/'));
    }
    let xmpp = this.xmppMap[jid];
    if (!xmpp) {
      xmpp = new XmppEx();
      this.xmppMap[jid] = xmpp;
      xmpp.on('disconnected', () => {
        this.emit('disconnected', { curJid: xmpp.connectedJid });
      });
    } else {
      if (xmpp.client) {
        if (xmpp.connectState < 1) {
          xmpp.retryTimes = 0;
        }
        xmpp._log(`xmpp session:init`);
        return;
      }
    }
    xmpp.init(credentials);
    xmpp.client.on('*', (name, data) => {
      if (
        window.localStorage.enabledXmppLog &&
        (name == 'raw:outgoing' || name == 'raw:incoming')
      ) {
        console.log('onrawdata', xmpp.getTime(), xmpp.client.ts, xmpp.connectedJid, name, data);
        return;
      }
      if (name == 'auth:failed') {
        xmpp._warn('auth:failed');
        this.emit(name, { curJid: xmpp.connectedJid });
        this.removeXmpp(xmpp.connectedJid);
        return;
      }
      if (data && typeof data != 'string') {
        data.curJid = xmpp.connectedJid;
      }
      if (name != 'disconnected') {
        this.emit(name, data);
      }
    });
    // xmpp.client.on('memberschange', (data) => {
    //   this.emit(name, data);
    // });
  }
  connect(jid) {
    let xmpp = this.getXmpp(jid);
    return xmpp.connect();
  }
  removeXmpp(jid) {
    if (jid && jid.indexOf('/') > 0) {
      jid = jid.substring(0, jid.indexOf('/'));
    }
    let xmpp = this.xmppMap[jid];
    if (xmpp) {
      if (xmpp.client) {
        xmpp.client.disconnect();
        xmpp.pingState = false;
        xmpp.connectedJid = null;
      }
      this.xmppMap[jid] = null;
    }
  }
  getXmpp(jid) {
    if (jid && jid.indexOf('/') > 0) {
      jid = jid.substring(0, jid.indexOf('/'));
    }
    if (jid) {
      return this.xmppMap[jid];
    } else {
      console.error('jid is null');
      return null;
    }
  }
  async enableCarbons(curJid) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.enableCarbons();
  }
  async getRoster(curJid) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.getRoster();
  }
  async getE2ee(user, curJid) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.getE2ee(user);
  }
  async setE2ee(user, curJid) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.setE2ee(user);
  }
  async setRoomName(room, opts, curJid) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.setRoomName(room, opts);
  }
  async setNickName(room, nick, curJid) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.setNickName(room, nick);
  }
  async addMember(room, jid, curJid) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.addMember(room, jid);
  }
  async leaveRoom(room, jid, curJid) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.leaveRoom(room, jid);
  }
  async destroyRoom(room, reason, curJid) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.destroyRoom(room, reason);
  }
  async createRoom(room, opts, curJid) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.createRoom(room, opts);
  }
  async getRoomMembers(room, ver, curJid) {
    let xmpp = this.getXmpp(curJid);
    if (!xmpp) {
      console.warn(
        `the xmpp connection of ${curJid} is not exist, maybe you just delete this account.`
      );
      return {
        mucAdmin: {
          items: [],
        },
      };
    }
    return xmpp.getRoomMembers(room, ver);
  }
  async getRoomList(ver, curJid) {
    let xmpp = this.getXmpp(curJid);
    const result = xmpp.getRoomList(ver);
    return result;
  }
  async block(jid, curJid) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.block(jid);
  }
  async unblock(jid, curJid) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.unblock(jid);
  }
  async getBlocked(ver, curJid) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.getBlocked(ver);
  }
  async joinRooms(curJid, ...roomJids) {
    let xmpp = this.getXmpp(curJid);
    return xmpp.joinRooms(...roomJids);
  }
  async pullMessage(ts, curJid) {
    let xmpp = this.getXmpp(curJid);
    return new Promise((resolve, reject) => {
      xmpp.pullMessage(ts, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }
  sendMessage(message, curJid) {
    let xmpp = this.getXmpp(curJid);
    if (!xmpp) {
      console.warn('xmpp is null', curJid);
      return;
    }
    xmpp.sendMessage(message);
  }
}

/**
 * A class that interfaces with the Quickblox REST API
 * @extends EventEmitter3
 */
class XmppEx extends EventEmitter3 {
  client = null;
  credentials = null;
  connectedJid = null;
  retryTimes = 0;
  timeoutCount = 0;
  /**
   * 0,未连接
   * 1,正在连接
   * 2,成功
   * -1,失败
   */
  connectState = 0;
  pingState = false;
  /**
   * 上次发送数据时间
   */
  lastSendTs = 0;

  /**
   * Initializes the QuickBlox instance's credentials.
   * @param {Object} credentials The xmpp credentials, consisting of an jid (string), password
   *                             (string), transport (string), wsURL (string), and boshURL (string)
   * @throws {Error}             Throws an error if the credentials are do not pass validation
   */
  init = credentials => {
    if (this.client) {
      return;
    }

    validateCredentials(credentials);
    this.credentials = credentials;
    this.connectedJid = credentials.jid;
    this.retryTimes = 0;
    this.client = Stanza.createClient(credentials);
    this.client.on('session:started', data => {
      this.retryTimes = 0;
      this.timeoutCount = 0;
      this.connectState = 2;
      this.lastTs = 0;
      this.emit('session:started', data);
      this.client.sendPresence();
    });
    this.client.on('session:prebind', bind => {
      if (!window.edisonChatServerDiffTime) {
        window.edisonChatServerDiffTime = parseInt(
          parseInt(bind.serverTimestamp) -
            (new Date().getTime() - parseInt(bind.timestamp)) / 2 -
            parseInt(bind.timestamp)
        );
        this._log(
          'xmpp session:difftime:' + edisonChatServerDiffTime,
          `jid: ${this.connectedJid},state: ${this.connectState},retyTimes: ${
            this.retryTimes
          },ts: ${this.getTime()}`
        );
      }
    });
    this.client.on('disconnected', () => {
      if (this.connectState == 1) {
        this.emit('socket:closed');
      }
      this._log(`xmpp session:disconnected`);
      this.connectState = -1;
      if (this.connectedJid && this.retryTimes < 10) {
        let timespan = 1000 + (this.retryTimes % 5) * 2000;
        setTimeout(() => {
          this._log('xmpp session:retry');
          this.connect(this);
        }, timespan);
      } else if (this.connectedJid) {
        if (this.retryTimes == 10) {
          this._warn('xmpp session:disconnected.emit');
          this.emit('disconnected');
        }
        setTimeout(() => {
          this._log('xmpp session:retry.1');
          this.connect(this);
        }, 180000);
      }
    });
    this.client.on('request:timeout', () => {
      this.timeoutCount++;
      if (this.timeoutCount == 3) {
        this._log('xmpp session:timeout');
        this.client.disconnect();
      }
    });
  };

  ping = () => {
    if (this.connectState == 2) {
      if (new Date().getTime() - this.lastSendTs > 20000) {
        this.client.ping('im.edison.tech');
      }
    }
    if (this.pingState) {
      setTimeout(() => this.ping(), 25000 + Math.random() * 10000);
    }
  };
  getTime() {
    return `${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()}`;
  }
  /**
   * Connects to the xmpp service. Requires the instance to be initialized.
   * @throws  {Error}             Throws an error if the instance has not been initialized
   * @returns {Promise.<Object>}  Returns a promise that resolves a JID object
   */
  connect = xmppEx => {
    let self = xmppEx;
    if (!self) {
      self = this;
    }
    if (self.client === null) {
      self._warn('Init this instance by calling init(credentials) before trying to connect');
      throw Error('Init this instance by calling init(credentials) before trying to connect');
    }
    if (self.connectState > 0) {
      self._log('xmpp session:connecting');
      return;
    }
    self.connectState = 1;
    xmpp.tmpData[self.connectedJid.split('@')[0] + '_tmp_message_state'] = true;
    if (!self.pingState) {
      self.pingState = true;
      setTimeout(self.ping.bind(self), 25000 + Math.random() * 10000);
    }
    self._log('xmpp session:connecting');
    self.retryTimes++;
    let isComplete = false;
    return new Promise((resolve, reject) => {
      const success = jid => {
        if (!isComplete) {
          self._log('xmpp session:success');
          self.connectState = 2;
          self.timeoutCount = 0;
          isComplete = true;
          removeListeners();
          resolve(jid);
        }
      };
      const failure = () => {
        if (!isComplete) {
          self._warn('xmpp session:failed');
          self.connectState = -1;
          self.timeoutCount = 0;
          isComplete = true;
          removeListeners();
          reject(self.connectedJid);
        }
      };
      const closed = () => {
        if (!isComplete) {
          self._log('xmpp session:closed');
          self.connectState = -1;
          self.timeoutCount = 0;
          isComplete = true;
          removeListeners();
          reject('xmpp session:closed');
        }
      };
      setTimeout(() => {
        if (!isComplete) {
          self.connectState = -1;
          removeListeners();
          if (self.client) {
            self.client.disconnect();
          }
          reject('Connection timeout');
        }
      }, 15000);
      const removeListeners = () => {
        self.removeListener('session:started', success);
        self.removeListener('auth:failed', failure);
        self.removeListener('socket:closed', closed);
      };
      removeListeners();
      self.on('session:started', success);
      self.on('auth:failed', failure);
      self.on('socket:closed', closed);
      self.client.connect();
    });
  };

  _log = msg => {
    if (window.localStorage.enabledXmppLog) {
      console.log(
        msg,
        `jid: ${this.connectedJid},ts: ${this.client.ts},state: ${this.connectState},timeoutConut:${
          this.timeoutCount
        },retyTimes: ${this.retryTimes},time: ${this.getTime()}`
      );
    }
  };
  _warn = msg => {
    this._log(msg);
    AppEnv.logWarning(
      `${msg}: jid: ${this.connectedJid},state: ${this.connectState},timeoutConut:${
        this.timeoutCount
      },retyTimes: ${this.retryTimes},ts: ${this.client.ts},time: ${this.getTime()}`
    );
  };
  /**
   * Enables carbons
   * @throws  {Error}             Throws an error if the client is not connected
   * @returns {Promise.<Object>}
   */
  async enableCarbons() {
    if (!this.requireConnection()) {
      return;
    }
    return this.client.enableCarbons();
  }

  /**
   * Retrieves the user's roster from the XMPP Server
   * @throws  {Error}               Throws an error if the client is not connected
   * @returns {Promise.<Object>}
   */
  async getRoster() {
    if (!this.requireConnection()) {
      return;
    }
    return this.client.getRoster();
  }

  async getE2ee(user) {
    //yazzxx
    if (!this.requireConnection()) {
      return;
    }
    return this.client.getE2ee(user);
  }
  async setE2ee(user) {
    //yazzxx
    if (!this.requireConnection()) {
      return;
    }
    return this.client.setE2ee(user);
  }

  //------------------room start
  /**
   *
   * @param room
   * @param opts { name:'room name', subject:'subject', description:'description'}
   */
  async setRoomName(room, opts) {
    if (!this.requireConnection()) {
      return;
    }
    return this.client.setRoomName(room, opts);
  }
  async setNickName(room, nick) {
    if (!this.requireConnection()) {
      return;
    }
    return this.client.setNickName(room, nick);
  }
  async addMember(room, jid) {
    if (!this.requireConnection()) {
      return;
    }
    return this.client.addMember(room, jid);
  }
  async leaveRoom(room, jid) {
    if (!this.requireConnection()) {
      return;
    }
    return this.client.leaveRoom(room, jid);
  }
  async destroyRoom(room, reason) {
    if (!this.requireConnection()) {
      return;
    }
    return this.client.destroyRoom(room, { reason: reason });
  }
  /**
   *
   * @param room
   * @param opts
   * {
   *    type:'create',
   *    name:'yazz_test',
   *    subject:'yazz test',
   *    description:'description',
   *    members:{
   *        jid:['100004@im.edison.tech','100007@im.edison.tech','1000@im.edison.tech']
   *    }
   * }
   */
  async createRoom(room, opts) {
    if (!this.requireConnection()) {
      return;
    }
    return this.client.createRoom(room, opts);
  }
  async getRoomMembers(room, ver) {
    if (!this.requireConnection()) {
      return;
    }
    try {
      const members = await this.client.getRoomMembers(room, {
        ver: ver,
        items: [
          {
            affiliation: 'member',
          },
        ],
      });
      this.emit('receive:members', members);
      return members;
    } catch (err) {
      console.warn('getRoomMembers failed, maybe you are not this room member', err);
      const emptyEmebers = {
        mucAdmin: {
          items: [],
        },
      };
      this.emit('receive:members', emptyEmebers);
      return emptyEmebers;
    }
  }
  async getRoomList(ver) {
    if (!this.requireConnection()) {
      return;
    }
    return this.client.getRoomList(ver);
  }

  //----------------------room end

  //----------------------block start
  async block(jid) {
    if (!this.requireConnection()) {
      return;
    }
    return this.client.block(jid);
  }
  async unblock(jid) {
    if (!this.requireConnection()) {
      return;
    }
    return this.client.unblock(jid);
  }
  async getBlocked(ver) {
    if (!this.requireConnection()) {
      return;
    }
    return this.client.getBlocked(ver);
  }
  //----------------------block end

  /**
   * Joins the rooms with the provided Jids. Requires connection to server.
   * @param   {...string} roomJids  The jids of the rooms to join
   * @throws  {Error}               Throws an error if the client is not connected or if no jids are
   *                                provided
   * @returns {Promise.<string[]>}  The array of room jids that were successfully joined
   */
  async joinRooms(...roomJids) {
    if (!this.requireConnection()) {
      return;
    }
    if (roomJids.length === 0) {
      console.warn('At least 1 room jid is required');
    }
    const self = this;
    const incomplete = new Set(roomJids);
    return new Promise((resolve, reject) => {
      const onComplete = data => {
        const {
          from: { bare: joinedMuc },
        } = data;
        incomplete.delete(joinedMuc);
        if (incomplete.size === 0) {
          self.removeListener('muc:available', onComplete);
          resolve(roomJids);
        }
      };
      setTimeout(() => {
        if (incomplete.size > 0) {
          const successful = roomJids.filter(jid => !incomplete.has(jid));
          const failed = Array.from(incomplete);
          self.removeListener('muc:available', onComplete);
          reject({ successful, failed });
        }
      }, 2000 + JOIN_INTERVAL * roomJids.length); // 5 second timeout from the last attempt
      self.on('muc:available', onComplete);

      // Space requests 10ms apart to avoid congestion
      Observable.from(roomJids)
        .zip(Observable.interval(JOIN_INTERVAL), jid => jid)
        .subscribe(jid => this.client.joinRoom(jid));
    });
  }
  lastTs = 0;
  async pullMessage(ts, cb) {
    if (!this.requireConnection() || this.lastTs == ts) {
      return;
    }
    this.lastTs = ts;
    this.client.pullMessage(ts, cb); //yazz test
  }
  /**
   * Sends a message to the connected xmpp server
   * @param   {Object}  message   The message to be sent
   * @throws  {Error}             Throws an error if the client is not connected
   */
  sendMessage(message) {
    if (!this.requireConnection()) {
      return;
    }
    const finalMessage = Object.assign({}, message, {
      from: this.connectedJid,
      requestReceipt: true,
    });
    this.client.sendMessage(finalMessage);
  }

  requireConnection() {
    if (this.connectState != 2 || !(this.client instanceof Client)) {
      console.warn('Xmpp not connected.', 'connectState:' + this.connectState);
      return false;
    }
    this.lastSendTs = new Date().getTime();
    return true;
  }
}

/**
 * Validates Xmpp credentials.
 * @param   {Object} credentials  The xmpp credentials, consisting of an jid (string), password
 *                                (string), transport (string), wsURL (string), and boshURL (string)
 * @throws  {Error}               Throws an error if the provided credentials object is not
 *                                properly formatted
 */
export const validateCredentials = credentials => {
  if (typeof credentials !== 'object') {
    throw Error('Credentials must be an object');
  }

  const problems = [];
  const { jid, password, transport, wsURL, boshURL } = credentials;
  if (typeof jid !== 'string') {
    problems.push("jid of type 'string' is required");
  }
  if (typeof password !== 'string') {
    problems.push("password of type 'string' is required");
  }
  const transports = ['bosh', 'websocket', 'old-websocket'];
  if (transports.indexOf(transport) < 0) {
    problems.push(`transport must be one of ${transports.join(', ')}`);
  }
  if (transport === 'bosh' && typeof boshURL !== 'string') {
    problems.push("boshURL of type 'string' is required");
  } else if (
    (transport === 'websocket' || transport === 'old-websocket') &&
    typeof wsURL !== 'string'
  ) {
    problems.push("wsURL of type 'string' is required");
  }

  if (problems.length > 0) {
    throw Error(`Invalid credentials: ${problems.join(', ')}`);
  }
};

const xmpp = new Xmpp();
window.xmpp = xmpp;

export default xmpp;