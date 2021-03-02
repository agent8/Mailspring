import path from 'path';
import MailspringStore from 'mailspring-store';
import { ContactStore, Message } from 'mailspring-exports';
import a8 from 'a8';

class A8Base {
  toA8Model() {
    //noop
  }
}
class Headers extends A8Base {
  constructor(message) {
    super();
    this.message = message;
    this.headers = {};
    this._parseMessage();
  }
  _parseMessage = () => {
    if (Array.isArray(this.message.from) && this.message.from.length > 0) {
      this._setField('From', this.message.from[0].email);
    }
    if (this.message.sender) {
      this._setField('Sender', this.message.sender.email);
    }
    if (Array.isArray(this.message.to) && this.message.to.length > 0) {
      const emails = this.message.to.map(contact => contact.email);
      this._appendField('To', emails);
    }
    if (Array.isArray(this.message.bcc) && this.message.bcc.length > 0) {
      const emails = this.message.bcc.map(contact => contact.email);
      this._appendField('To', emails);
    }
    if (Array.isArray(this.message.cc) && this.message.cc.length > 0) {
      const emails = this.message.cc.map(contact => contact.email);
      this._appendField('To', emails);
    }
    if (Array.isArray(this.message.replyTo) && this.message.replyTo.length > 0) {
      const emails = this.message.replyTo.map(contact => contact.email);
      this._setField('Reply-To', emails);
    }
    if (typeof this.message.returnPath === 'string' && this.message.returnPath.length > 0) {
      this._setField('Return-Path', this.message.returnPath);
    }
    if (typeof this.message.dkimSignature === 'string' && this.message.dkimSignature.length > 0) {
      this._setField('DKIM-Signature', this.message.dkimSignature);
    }
    if (
      typeof this.message.authenticationResults === 'string' &&
      this.message.authenticationResults.length > 0
    ) {
      this._setField('Authentication-Results', this.message.authenticationResults);
    }
    if (typeof this.message.arcSeal === 'string' && this.message.arcSeal.length > 0) {
      this._setField('ARC-Seal', this.message.arcSeal);
    }
    if (
      typeof this.message.arcMessageSignature === 'string' &&
      this.message.arcMessageSignature.length > 0
    ) {
      this._setField('ARC-Message-Signature', this.message.arcMessageSignature);
    }
    if (
      typeof this.message.arcAuthenticationResults === 'string' &&
      this.message.arcAuthenticationResults.length > 0
    ) {
      this._setField('ARC-Authentication-Results', this.message.arcAuthenticationResults);
    }
    if (
      typeof this.message.arcMessageSignature === 'string' &&
      this.message.arcMessageSignature.length > 0
    ) {
      this._appendField('ARC-Message-Signature', this.message.arcMessageSignature);
    }
    if (Array.isArray(this.message.received) && this.message.received.length > 0) {
      this._appendField('Received', this.message.received);
    }
  };

  GetValue(field) {
    if (this.headers[field]) {
      return this.headers[field].value;
    }
    return null;
  }
  Get(field) {
    return this.headers[field];
  }
  _setField(header, value) {
    if (typeof value === 'string') {
      this.headers[header] = { type: 0, header, value };
    } else {
      this.headers[header] = { type: 1, header, value };
    }
  }
  _appendField(header, value) {
    if (!this.headers[header]) {
      this.headers[header] = { header };
    }
    this.headers[header].type = 1;
    if (!Array.isArray(this.headers[header].value)) {
      const prev = this.headers[header].value;
      this.headers[header].value = [];
      if (prev) {
        this.headers[header].value.push(prev);
      }
    }
    if (Array.isArray(value)) {
      this.headers[header].value.concat(...value);
    } else {
      this.headers[header].value.push(value);
    }
  }
  toA8Model() {
    const ret = [];
    Object.keys(this.headers).forEach(key => {
      ret.push(Object.assign({ header: key }, this.headers[key]));
    });
    return ret;
  }
}
class A8 extends A8Base {
  static parseMessage(message, { onComplete = () => {}, onError = () => {} } = {}) {
    return new A8(message, ({ onComplete = () => {}, onError = () => {} } = {}));
  }
  constructor(message, { onComplete = () => {}, onError = () => {} } = {}) {
    super();
    this.headers = new Headers(message);
    this.extraCheckInfo = null;
    this.emailInfo = { owner: message.from[0].email, body: message.body };
    this.queryExtraCheckInfo(message, { onComplete, onError });
  }
  queryExtraCheckInfo(message, { onComplete, onError }) {
    if (message && Array.isArray(message.from) && message.from[0])
      ContactStore.getContactTypeForAllAccount(message.from[0].email).then(ret => {
        this.extraCheckInfo = ret;
        onComplete(this);
      }, onError);
  }
  getHeaders() {
    return this.headers;
  }
  getExtraCheckInfo() {
    return (
      this.extraCheckInfo || { isStrange: false, isColleague: false, isWellKnownProvider: false }
    );
  }
  toA8Model() {
    return {
      headers: this.getHeaders().toA8Model(),
      extraCheckInfo: this.getExtraCheckInfo(),
      emailInfo: this.emailInfo,
    };
  }
}
class A8Store extends MailspringStore {
  constructor() {
    super();
    a8.init({ workingDir: path.join(AppEnv.getConfigDirPath(), 'a8-js') });
  }
  checkHeaders({ message, onComplete, onError } = {}) {
    if (message) {
      const onA8DataReady = data => {
        if (data) {
          const a8Model = data.toA8Model();
          a8.checkHeaders({
            headers: a8Model.headers,
            extraCheckInfo: a8Model.extraCheckInfo,
            onOk: onComplete,
            onError,
          });
        }
      };
      A8.parseMessage(message, { onComplete: onA8DataReady, onError });
    }
  }
}

module.exports = new A8Store();
