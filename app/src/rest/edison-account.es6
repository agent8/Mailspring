import axios from 'axios';
import { AccountStore } from 'mailspring-exports';
import RESTResult from './result-data-format';
import { getOSInfo } from '../system-utils';
export default class EdisonAccount {
  constructor(host) {
    this.host = host;
  }

  async checkAccounts(aids = []) {
    const url = `${this.host}/account/check`;
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
        if (data.data && data.data.includes(a.emailAddress)) {
          checkedAccountIds.push(a.id);
        }
      });
      return new RESTResult(data.code === 0, data.message, checkedAccountIds);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async checkAccount(aid) {
    const url = `${this.host}/account/check`;
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
      const isChecked = data.data && data.data.includes(account.emailAddress) ? true : false;
      return new RESTResult(data.code === 0, data.message, isChecked);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }
}
