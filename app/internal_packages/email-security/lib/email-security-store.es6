import path from 'path';
import crypto from 'crypto';
import MailspringStore from 'mailspring-store';
import {
  ContactStore,
  AccountStore,
  DatabaseStore,
  Thread,
  SearchQueryParser,
  Constant,
} from 'mailspring-exports';
import EmailSecurityActions from './email-security-actions';
import * as a8 from 'a8';

const spamCheckFailedCountThreshhold = 1;
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
      this.headers[header].value.push(...value);
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
class EmailInfo extends A8Base {
  constructor(message, imapHeaders = null) {
    super();
    this.owner = EmailInfo.parseOwner(message);
    this.body = (message && message.body) || '';
    this.identity =
      message && message.id
        ? crypto
            .createHash('md5')
            .update(message.id)
            .digest('hex')
        : '';
    this.imapHeaders = imapHeaders ? imapHeaders : new Headers(message);
  }
  static parseOwner(message) {
    const account = AccountStore.accountForId(message.accountId);
    if (account && account.emailAddress) {
      return account.emailAddress;
    }
    return '';
  }
  getOwner() {
    return this.owner;
  }
  getIdentity() {
    return this.identity;
  }
  getBody() {
    return this.body;
  }
  getImapHeaders() {
    return this.imapHeaders;
  }
  toA8Model() {
    return {
      owner: this.getOwner(),
      identity: this.getIdentity(),
      body: this.body,
      imapHeaders: this.getImapHeaders().toA8Model(),
    };
  }
}
class A8 extends A8Base {
  static parseMessage(message, { onComplete, onError } = {}) {
    return new A8(message, { onComplete, onError });
  }
  static getDomainsFormMessage(message) {
    const ret = [];
    if (message && Array.isArray(message.from) && message.from[0]) {
      const email = message.from[0].email || '';
      if (email.includes('@')) {
        const splits = email.split('@');
        if (splits.length === 2) {
          const domains = splits[1].split('.');
          if (domains.length >= 2) {
            for (let i = 0; i < domains.length - 1; i++) {
              ret.push(domains.slice(i).join('.'));
            }
          }
        }
      }
    }
    return ret;
  }
  static getLinkedInQueryParam(message, organization = '') {
    const ret = { organization, source: 'domain', title: '' };
    if (message) {
      const account = AccountStore.accountForId(message.accountId);
      if (account) {
        ret.owner = account.emailAddress;
      }
      if (Array.isArray(message.from) && message.from[0]) {
        ret.email = message.from[0].email || '';
        ret.name = message.from[0].name || '';
      }
    }
    return ret;
  }
  constructor(message, { onComplete = () => {}, onError = () => {} } = {}) {
    super();
    this.headers = new Headers(message);
    this.extraCheckInfo = null;
    this.emailInfo = new EmailInfo(message, this.headers);
    this.emailAddress = message.from && message.from[0] ? message.from[0].email : '';
    this.replyTo = message.replyTo && message.replyTo[0] ? message.replyTo[0].email : '';
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
      extraCheckInfo: Object.assign({}, this.getExtraCheckInfo()),
      emailInfo: this.emailInfo.toA8Model(),
      emailAddress: this.emailAddress,
      replyTo: this.replyTo,
    };
  }
}
class EmailSecurityStore extends MailspringStore {
  constructor() {
    super();
    this._init();
    this._registerListeners();
  }
  _init() {
    this.numAccounts = (AccountStore.accounts() || []).length;
    a8.init({ workingDir: path.join(AppEnv.getConfigDirPath(), 'a8-js') });
  }
  _registerListeners() {
    this.listenTo(AccountStore, this._onAccountsChange);
    this.listenTo(EmailSecurityActions.checkHeader, this.checkHeader);
    this.listenTo(EmailSecurityActions.checkEmail, this.checkEmail);
    this.listenTo(EmailSecurityActions.spamAndSMTPCheck, this.spamAndSMTPCheck);
    this.listenTo(EmailSecurityActions.fetchSenderInfo, this.fetchSenderInfo);
    this.listenTo(EmailSecurityActions.fetchSenderEmails, this.fetchSenderEmails);
  }
  _onAccountsChange = () => {
    const numAccounts = (AccountStore.accounts() || []).length;
    if (numAccounts !== this.numAccounts) {
      this.trigger();
    }
  };
  _callA8Action = (
    method,
    {
      message,
      organization = '',
      onComplete,
      onError,
      maxWaitSeconds,
      onSpamProgress,
      onSMTPProgress,
    } = {}
  ) => {
    if (message) {
      const onFailed = err => {
        if (onError) {
          onError({ id: message.id, error: err });
        }
      };
      const onSuccess = data => {
        if (onComplete) {
          onComplete({ id: message.id, data });
        }
      };
      if (method === 'fetchOrganizationInfo') {
        const domains = A8.getDomainsFormMessage(message);
        if (domains.length > 0) {
          a8.fetchOrganizationInfo({
            domains,
            onComplete: onSuccess,
            onError: onFailed,
            maxWaitSeconds: 90,
          });
        }
        return;
      }
      if (method === 'fetchLinkedInProfile') {
        const queryParam = A8.getLinkedInQueryParam(message, organization);
        a8.fetchLinkedInProfile({
          queryParam,
          onComplete: onSuccess,
          onError: onFailed,
          maxWaitSeconds: 90,
        });
        return;
      }

      const spamResult = { isSuspicious: false, failedCount: 0 };
      const onSpamData = data => {
        if (data && data.data && data.data.code === a8.RemoteCheckReturnCodes.RemoteCheck.Failed) {
          spamResult.failedCount++;
          if (spamResult.failedCount > spamCheckFailedCountThreshhold) {
            spamResult.isSuspicious = true;
          }
        }
        if (onSpamProgress) {
          onSpamProgress({ id: message.id, data: Object.assign({}, data, spamResult) });
        }
      };
      const smtpResult = { isSuspicious: false };
      const onSMTPData = data => {
        if (data && data.data && data.data.code !== a8.RemoteCheckReturnCodes.SMTPCheck.Success) {
          smtpResult.isSuspicious = true;
        }
        if (onSMTPProgress) {
          onSMTPProgress({ id: message.id, data: Object.assign({}, data, smtpResult) });
        }
      };
      const onA8DataReady = data => {
        if (data) {
          const a8Model = data.toA8Model();
          if (method === 'checkHeader') {
            a8.checkHeader({
              headers: a8Model.headers,
              extraCheckInfo: a8Model.extraCheckInfo,
              onComplete: onSuccess,
              onError: onFailed,
            });
          } else if (method === 'checkEmail') {
            console.warn(`checkEmail`, a8Model);
            // a8Model.emailInfo.body = '';
            a8.checkEmail({
              emailInfo: a8Model.emailInfo,
              extraCheckInfo: a8Model.extraCheckInfo,
              onComplete: onSuccess,
              onError: onFailed,
              maxWaitSeconds,
            });
          } else if (method === 'spamCheck') {
            a8.spamCheck({
              emailAddress: a8Model.emailAddress,
              replyTo: a8Model.replyTo,
              onSMTPServerCheckProgress: onSMTPData,
              onSpamCheckProgress: onSpamData,
              onError: onFailed,
              maxWaitSeconds: 90,
            });
          }
        }
      };
      A8.parseMessage(message, { onComplete: onA8DataReady, onError: onFailed });
    }
  };
  checkEmail = ({ message, onComplete, onError, maxWaitSeconds } = {}) => {
    this._callA8Action('checkEmail', { message, onComplete, onError });
  };
  checkHeader = ({ message, onComplete, onError } = {}) => {
    this._callA8Action('checkHeader', { message, onComplete, onError });
  };
  spamAndSMTPCheck = ({ message, onError, onSpamProgress, onSMTPProgress } = {}) => {
    this._callA8Action('spamCheck', { message, onError, onSpamProgress, onSMTPProgress });
  };
  fetchSenderInfo = ({ message, onError, onData } = {}) => {
    let organizationInfo = null;
    const orgInfoScore = orgInfo => {
      let ret = 0;
      if (orgInfo.homepage.length > 0) {
        ret = 1;
        if (orgInfo.description.length > 0) {
          ret += 3;
        }
        if (orgInfo.facebookUrl.length > 0) {
          ret++;
        }
        if (orgInfo.twitterUrl.length > 0) {
          ret++;
        }
        if (orgInfo.profileImageUrl.length > 0) {
          ret += 2;
        }
        if (orgInfo.linkedinUrl.length > 0) {
          ret++;
        }
      }
      return ret;
    };
    const onOrganizationInfo = info => {
      organizationInfo = info.data;
      if (onData) {
        onData({ id: info.id, data: { organizationInfo, userInfo: null } });
      }
      let domain = '';
      let highestOrgScore = 0;
      let orgName = '';
      if (organizationInfo) {
        Object.values(organizationInfo).forEach(org => {
          if (org && org.domain.length > 0) {
            const currentScore = orgInfoScore(org);
            if (currentScore > highestOrgScore) {
              highestOrgScore = currentScore;
              domain = org.domain;
              orgName = org.name;
            } else if (currentScore === highestOrgScore && org.domain.length > domain.length) {
              domain = org.domain;
              orgName = org.name;
            }
          }
        });
      }
      if (domain.length > 0) {
        organizationInfo[domain].inUse = true;
      }
      const onUserInfo = info => {
        if (onData) {
          onData({ id: info.id, data: { organizationInfo, userInfo: info.data } });
        }
      };
      this._callA8Action('fetchLinkedInProfile', {
        message,
        organization: orgName,
        onError,
        onComplete: onUserInfo,
      });
    };
    this._callA8Action('fetchOrganizationInfo', {
      message,
      onError,
      onComplete: onOrganizationInfo,
    });
  };

  fetchSenderEmails = ({ message, onError, onComplete } = {}) => {
    const onFailed = err => {
      if (onError) {
        onError({ id: message.id, error: err });
      }
    };
    const onSuccess = data => {
      if (onComplete) {
        onComplete({ id: message.id, data });
      }
    };
    if (message) {
      let email = '';
      if (message.from[0]) {
        email = message.from[0].email;
      } else if (message.replyTo[0]) {
        email = message.replyTo[0].email;
      }
      let parsedQuery;
      let dbQuery = DatabaseStore.findAll(Thread);
      try {
        parsedQuery = SearchQueryParser.parse(`from: ${email}`);
        dbQuery = dbQuery.structuredSearch({ query: parsedQuery, accountIds: [] });
      } catch (e) {
        onFailed(`Failed to parse 'from: ${email}'`);
      }
      dbQuery
        .background()
        .setQueryType(Constant.QUERY_TYPE.SEARCH_PERSPECTIVE)
        .where({ state: 0 })
        .order(Thread.attributes.lastMessageTimestamp.descending())
        .limit(50)
        .then(result => {
          onSuccess(result);
        }, onFailed);
    }
  };
}

module.exports = new EmailSecurityStore();
