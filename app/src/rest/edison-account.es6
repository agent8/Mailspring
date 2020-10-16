import axios from 'axios';
import crypto from 'crypto';
import { AccountStore, Constant, Actions } from 'mailspring-exports';
import RESTResult from './result-data-format';
import { getOSInfo } from '../system-utils';
import KeyManager from '../key-manager';

const { OAuthList } = Constant;
const supportId = AppEnv.config.get('core.support.id');

function getDeviceInfo() {
  const { hostname, release } = getOSInfo();
  const appInstallDate = new Date(AppEnv.config.get('identity.createdAt'));
  const appInstalledAtInMs = appInstallDate.getTime();
  const timezoneOffset = new Date().getTimezoneOffset() * 60 * 1000;
  const appVersion = AppEnv.getVersion();
  const buildVersion = AppEnv.getBuildVersion();
  return {
    id: supportId,
    name: hostname,
    platform: process.platform === 'darwin' ? 'mac' : process.platform,
    model: release,
    screenType: 'computer',
    pushToken: 'string',
    timeZoneOffsetInMs: timezoneOffset,
    appInstalledAtInMs: appInstalledAtInMs,
    appUpdatedAtInMs: 0,
    appVersion: `${appVersion}(${buildVersion})`,
  };
}

const aesEncode = data => {
  const password = 'effa43461f128bee';
  const algorithm = 'aes-128-ecb';
  const cipher = crypto.createCipheriv(algorithm, password, null);
  let encrypted = cipher.update(data, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

const ResCodes = {
  Deleted: 10002,
  EmailValid: 10003,
  AccountValid: 10004,
};

export default class EdisonAccount {
  constructor(host) {
    this.host = host;
  }

  _handleResCode(code, account) {
    if (code === 0) {
      return;
    }
    if (code === ResCodes.Deleted) {
      Actions.deletedEdisonAccountOnOtherDevice(account.emailAddress);
    }
  }

  _handleReqError(error, aid) {
    const stateCode = error && error.response && error.response.status;
    if (stateCode && stateCode === 401) {
      // Token missed or expired or invalid
      const syncAccount = AccountStore.syncAccount();
      if (syncAccount && syncAccount.id) {
        this.register(syncAccount.id);
      }
    }
  }

  async checkAccounts(aids = []) {
    const url = `${this.host}/api/charge/account/queryMainAccounts`;
    const accounts = AccountStore.accounts();
    const checkAccount = (accounts || []).filter(a => aids.includes(a.id));
    if (checkAccount.length <= 0) {
      return new RESTResult(false, 'accountIds is unexpected');
    }
    const postParams = checkAccount.map(a => {
      const isExchange = AccountStore.isExchangeAccount(a);
      const host = isExchange ? a.settings.ews_host : a.settings.imap_host;
      const postData = {
        emailAddress: a.emailAddress,
        host: host,
      };
      if (a.name) {
        postData['username'] = a.name;
      }
      return postData;
    });
    try {
      const { data } = await axios.post(url, postParams);
      let checkedAccountIds = [];
      if (data.data && data.data.length) {
        checkedAccountIds = data.data;
      }

      return new RESTResult(data.code === 0, data.message, checkedAccountIds);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async checkAccount(aid) {
    const url = `${this.host}/api/charge/account/queryMainAccounts`;
    const account = AccountStore.accountForId(aid);
    if (!account) {
      return new RESTResult(false, 'accountId is unexpected');
    }
    const isExchange = AccountStore.isExchangeAccount(account);
    const host = isExchange ? account.settings.ews_host : account.settings.imap_host;
    const postData = {
      emailAddress: account.emailAddress,
      host: host,
    };
    if (account.name) {
      postData['username'] = account.name;
    }
    try {
      const { data } = await axios.post(url, [postData]);
      const isChecked = data.data && data.data.length ? true : false;
      return new RESTResult(data.code === 0, data.message, isChecked);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async register(aid) {
    const url = `${this.host}/api/charge/account/register`;
    const account = AccountStore.accountForId(aid);
    if (!account) {
      return new RESTResult(false, 'accountId is unexpected');
    }
    const device = getDeviceInfo();
    const emailAccount = {
      name: account.name,
      emailAddress: account.emailAddress,
      provider: account.provider,
      incoming: {
        username: account.settings.imap_username,
        host: account.settings.imap_host,
        port: account.settings.imap_port,
        ssl: account.settings.imap_security && account.settings.imap_security !== 'none',
      },
    };
    if (OAuthList.includes(account.provider)) {
      emailAccount['type'] = 'oauth';
      emailAccount['oauthClientId'] = account.settings.refresh_client_id;
      emailAccount['incoming'] = {
        username: account.settings.imap_username,
        password: aesEncode(await KeyManager.getPassword(`${account.emailAddress}-refresh-token`)),
      };
    } else {
      emailAccount['type'] = 'imap';
      emailAccount['incoming'] = {
        ...emailAccount['incoming'],
        password: aesEncode(await KeyManager.getPassword(`${account.emailAddress}-imap`)),
      };
      emailAccount['outgoing'] = {
        username: account.settings.smtp_username,
        password: aesEncode(await KeyManager.getPassword(`${account.emailAddress}-smtp`)),
        host: account.settings.smtp_host,
        port: account.settings.smtp_port,
        ssl: account.settings.smtp_security && account.settings.smtp_security !== 'none',
      };
    }
    if (AccountStore.isExchangeAccount(account)) {
      emailAccount['type'] = 'exchange';
      emailAccount['incoming'] = {
        ...emailAccount['incoming'],
        username: account.settings.ews_username,
        host: account.settings.ews_host,
        // To do
        domain: null,
      };
    }

    const postData = {
      device,
      emailAccount,
    };

    try {
      const { data } = await axios.post(url, postData);
      if (data.code === 0 && data.data) {
        const newAccount = {
          ...account,
          settings: {
            ...account.settings,
            edisonId: data.data.edisonId,
            edison_token: data.data.token,
          },
        };
        Actions.updateAccount(aid, newAccount);
        AccountStore.loginSyncAccount(aid);
      }
      this._handleResCode(data.code, account);
      return new RESTResult(data.code === 0, data.message);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async deleteAccount(aid) {
    const url = `${this.host}/api/charge/account/me`;
    const account = AccountStore.accountForId(aid);
    if (!account) {
      return new RESTResult(false, 'accountId is unexpected');
    }
    const token = account.settings.edison_token;
    if (!token) {
      return new RESTResult(false, 'this account has no token');
    }
    try {
      const res = await axios({
        url,
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = res.data;
      if (data.code === 0) {
        AccountStore.logoutSyncAccount(aid);
      }
      this._handleResCode(data.code, account);
      return new RESTResult(data.code === 0, data.message, data.data);
    } catch (error) {
      this._handleReqError(error, aid);
      return new RESTResult(false, error.message);
    }
  }

  async setPasswordByAccount(aid, password) {
    const url = `${this.host}/api/charge/account/password`;
    const account = AccountStore.accountForId(aid);
    if (!account) {
      return new RESTResult(false, 'accountId is unexpected');
    }
    const token = account.settings.edison_token;
    if (!token) {
      return new RESTResult(false, 'this account has no token');
    }
    const postData = {
      emailAddress: account.emailAddress,
      password: password,
    };
    try {
      const { data } = await axios.post(url, postData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      this._handleResCode(data.code, account);
      return new RESTResult(data.code === 0, data.message);
    } catch (error) {
      this._handleReqError(error, aid);
      return new RESTResult(false, error.message);
    }
  }

  async loginWithPassword(aid, password) {
    const url = `${this.host}/api/charge/account/login`;
    const account = AccountStore.accountForId(aid);
    if (!account) {
      return new RESTResult(false, 'accountId is unexpected');
    }
    if (!password) {
      return new RESTResult(false, 'password is unexpected');
    }
    const device = getDeviceInfo();
    const postData = {
      emailAddress: account.emailAddress,
      password: password,
      device,
    };
    try {
      const { data } = await axios.post(url, postData);
      if (data.code === 0 && data.data) {
        const newAccount = {
          ...account,
          settings: {
            ...account.settings,
            edisonId: data.data.edisonId,
            edison_token: data.data.token,
          },
        };
        Actions.updateAccount(aid, newAccount);
      }
      this._handleResCode(data.code, account);
      return new RESTResult(data.code === 0, data.message);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async devicesList(aid) {
    const url = `${this.host}/api/charge/account/devices`;
    const account = AccountStore.accountForId(aid);
    if (!account) {
      return new RESTResult(false, 'accountId is unexpected');
    }
    const token = account.settings.edison_token;
    if (!token) {
      return new RESTResult(false, 'this account has no token');
    }

    try {
      const { data } = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      this._handleResCode(data.code, account);
      return new RESTResult(data.code === 0, data.message, data.data);
    } catch (error) {
      this._handleReqError(error, aid);
      return new RESTResult(false, error.message);
    }
  }

  async logoutDevice(aid, deviceId) {
    const url = `${this.host}/api/charge/account/device/logout`;
    const account = AccountStore.accountForId(aid);
    if (!account) {
      return new RESTResult(false, 'accountId is unexpected');
    }
    const token = account.settings.edison_token;
    if (!token) {
      return new RESTResult(false, 'this account has no token');
    }
    if (!deviceId) {
      return new RESTResult(false, 'deviceId is unexpected');
    }
    const postData = {
      deviceId: deviceId,
    };
    let message;
    try {
      const { data } = await axios.post(url, postData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      this._handleResCode(data.code, account);
      message = data.message;
    } catch (error) {
      if (deviceId !== supportId) {
        this._handleReqError(error, aid);
      }
      message = error.message;
    }
    if (deviceId === supportId) {
      AccountStore.logoutSyncAccount(aid);
    }
    return new RESTResult(true, message);
  }

  async UpdateDevice(aid, name) {
    const url = `${this.host}/api/charge/account/device/update`;
    const account = AccountStore.accountForId(aid);
    if (!account) {
      return new RESTResult(false, 'accountId is unexpected');
    }
    const token = account.settings.edison_token;
    if (!token) {
      return new RESTResult(false, 'this account has no token');
    }

    const device = getDeviceInfo();
    if (name) {
      device.name = name;
    }

    try {
      const { data } = await axios.post(url, device, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      this._handleResCode(data.code, account);
      return new RESTResult(data.code === 0, data.message);
    } catch (error) {
      this._handleReqError(error, aid);
      return new RESTResult(false, error.message);
    }
  }

  async subAccounts() {
    const url = `${this.host}/api/charge/user/subAccounts`;
    const syncAccount = AccountStore.syncAccount();
    if (!syncAccount) {
      return new RESTResult(false, 'sync account is unexpected');
    }

    const token = syncAccount.settings.edison_token;
    if (!token) {
      return new RESTResult(false, 'sync account has no token');
    }

    const accounts = AccountStore.accounts();
    const subAccounts = accounts.filter(a => a.id !== syncAccount.id);
    const postData = subAccounts.map(a => {
      const isExchange = AccountStore.isExchangeAccount(a);
      const host = isExchange ? a.settings.ews_host : a.settings.imap_host;
      const postData = {
        host: host,
      };
      if (a.emailAddress) {
        postData['emailAddress'] = a.emailAddress;
      }
      if (a.name) {
        postData['username'] = a.name;
      }
      return postData;
    });

    try {
      const { data } = await axios.post(url, postData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      this._handleResCode(data.code, account);
      return new RESTResult(data.code === 0, data.message);
    } catch (error) {
      this._handleReqError(error, syncAccount.id);
      return new RESTResult(false, error.message);
    }
  }
}
