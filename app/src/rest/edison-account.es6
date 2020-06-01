import axios from 'axios';
import crypto from 'crypto';
import { AccountStore, Constant, Actions } from 'mailspring-exports';
import RESTResult from './result-data-format';
import { getOSInfo } from '../system-utils';
import KeyManager from '../key-manager';

const { OAuthList } = Constant;

const aesEncode = data => {
  const password = 'effa43461f128bee';
  const algorithm = 'aes-128-ecb';
  const cipher = crypto.createCipheriv(algorithm, password, null);
  let encrypted = cipher.update(data, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

export default class EdisonAccount {
  constructor(host) {
    this.host = host;
  }

  async checkAccounts(aids = []) {
    const url = `${this.host}/account/queryMainAccounts`;
    const accounts = AccountStore.accounts();
    const checkAccount = (accounts || []).filter(a => aids.includes(a.id));
    if (checkAccount.length <= 0) {
      return new RESTResult(false, 'accountIds is unexpected');
    }
    const postParams = checkAccount.map(a => {
      const postData = {
        emailAddress: a.emailAddress,
        host: a.settings.imap_host,
      };
      if (a.name) {
        postData['username'] = a.name;
      }
      return postData;
    });
    try {
      const { data } = await axios.post(url, postParams);
      const checkedAccountIds = [];
      checkAccount.forEach(a => {
        if (data.data && data.data.includes(`${a.emailAddress}:${a.settings.imap_host}`)) {
          checkedAccountIds.push(a.id);
        }
      });
      return new RESTResult(data.code === 0, data.message, checkedAccountIds);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async checkAccount(aid) {
    const url = `${this.host}/account/queryMainAccounts`;
    const account = AccountStore.accountForId(aid);
    if (!account) {
      return new RESTResult(false, 'accountId is unexpected');
    }
    const postData = {
      emailAddress: account.emailAddress,
      host: account.settings.imap_host,
    };
    if (account.name) {
      postData['username'] = account.name;
    }
    try {
      const { data } = await axios.post(url, [postData]);
      const isChecked =
        data.data && data.data.includes(`${account.emailAddress}:${account.settings.imap_host}`)
          ? true
          : false;
      return new RESTResult(data.code === 0, data.message, isChecked);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async register(aid) {
    const url = `${this.host}/account/register`;
    const account = AccountStore.accountForId(aid);
    if (!account) {
      return new RESTResult(false, 'accountId is unexpected');
    }
    const { hostname, release } = getOSInfo();
    const supportId = AppEnv.config.get('core.support.id');
    const device = {
      id: supportId,
      name: hostname,
      platform: process.platform === 'darwin' ? 'mac' : process.platform,
      model: release,
      screenType: 'computer',
      pushToken: 'string',
    };
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
    if (account.provider.endsWith('-exchange')) {
      emailAccount['type'] = 'exchange';
      emailAccount['incoming'] = {
        ...emailAccount['incoming'],
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
      }
      return new RESTResult(data.code === 0, data.message);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async deleteAccount(aid) {
    const url = `${this.host}/account/me`;
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
      return new RESTResult(data.code === 0, data.message, data.data);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async setPasswordByAccount(aid, password) {
    const url = `${this.host}/account/password`;
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
      return new RESTResult(data.code === 0, data.message);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }
}
