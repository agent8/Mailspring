import axios from 'axios';
import RESTResult from './result-data-format';
import { AccountStore, Constant } from 'mailspring-exports';

const { EdisonPlatformType, generateServerConfigKey } = Constant;

export default class Preferences {
  constructor(host) {
    this.host = host;
  }

  _handleReqError(error, aid) {
    const stateCode = error && error.response && error.response.status;
    if (stateCode && stateCode === 401) {
      // Token missed or expired or invalid
      setTimeout(() => {
        // wait for config change finish
        const { EdisonAccountRest } = require('./index');
        const syncAccount = AccountStore.syncAccount();
        if (syncAccount && syncAccount.id) {
          EdisonAccountRest.register(aid);
        }
      }, 3000);
    }
  }

  _generatePostInfo = configKey => {
    const configSchema = AppEnv.config.getSchema(configKey);
    const platform = configSchema.syncToServerCommonKey
      ? EdisonPlatformType.COMMON
      : EdisonPlatformType.MAC;
    const configKeyInServer = configSchema.syncToServerCommonKey
      ? configSchema.syncToServerCommonKey
      : generateServerConfigKey(configKey);
    const version = AppEnv.config.getConfigUpdateTime(configKey);
    return {
      platform: platform,
      key: configKeyInServer,
      version: version,
    };
  };

  _postCommonFunc = async (url, body) => {
    const syncAccount = AccountStore.syncAccount();
    if (!syncAccount) {
      throw new Error('sync account is unexpected');
    }
    const token = syncAccount.settings.edison_token;
    if (!token) {
      throw new Error('sync account has no token');
    }

    try {
      const { data } = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return data;
    } catch (error) {
      this._handleReqError(error, syncAccount.id);
      throw error;
    }
  };

  async getAllPreferences() {
    const url = `${this.host}/api/charge/user/preference/list`;
    const commonConfigVersion = AppEnv.config.get('commonSettingsVersion');
    const macConfigVersion = AppEnv.config.get('macSettingsVersion');
    const postData = [
      { platform: EdisonPlatformType.COMMON, version: commonConfigVersion },
      { platform: EdisonPlatformType.MAC, version: macConfigVersion },
    ];

    try {
      const data = await this._postCommonFunc(url, postData);
      const configList = (data.data || []).filter(
        conf =>
          conf.changed &&
          [EdisonPlatformType.COMMON, EdisonPlatformType.MAC].includes(conf.platform)
      );
      return new RESTResult(data.code === 0, data.message, configList);
    } catch (error) {
      const state = error && error.response && error.response.status;
      switch (state) {
        case 304:
          // no change in server with this version
          return new RESTResult(true, 'setting is nochange');
        case 404:
          // the setting in server is empty
          return new RESTResult(true, 'setting is empty', []);
        default:
          return new RESTResult(false, error.message);
      }
    }
  }

  async getStringTypePreference(configKey) {
    const url = `${this.host}/api/charge/user/preference/fetch`;
    const { platform, key } = this._generatePostInfo(configKey);
    const postData = { platform, key };

    try {
      const data = await this._postCommonFunc(url, postData);
      return new RESTResult(data.code === 0, data.message, data.data);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async getListTypePreference(configKey) {
    const url = `${this.host}/api/charge/user/subPreference/list`;
    const postData = this._generatePostInfo(configKey);

    try {
      const data = await this._postCommonFunc(url, postData);
      return new RESTResult(data.code === 0, data.message, data.data);
    } catch (error) {
      const state = error && error.response && error.response.status;
      switch (state) {
        case 304:
          // no change in server with this version
          return new RESTResult(true, 'setting is nochange');
        case 404:
          // the setting in server is empty
          return new RESTResult(true, 'setting is empty', {
            ...postData,
            list: [],
          });
        default:
          return new RESTResult(false, error.message);
      }
    }
  }

  async getListTypeSubPreference(configKey, subId) {
    const url = `${this.host}/api/charge/user/subPreference/fetch`;
    if (!subId) {
      return new RESTResult(false, 'subId is unexpected');
    }
    const { platform, key } = this._generatePostInfo(configKey);
    const postData = { platform, key, subId };

    try {
      const data = await this._postCommonFunc(url, postData);
      return new RESTResult(data.code === 0, data.message, data.data);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async getFullListTypePreferenceByServerKey({ serverKey, platform }) {
    const url = `${this.host}/api/charge/user/subPreference/list`;
    const subUrl = `${this.host}/api/charge/user/subPreference/fetch`;
    const postData = { platform, key: serverKey, version: 0 };
    try {
      const data = await this._postCommonFunc(url, postData);
      if (!data || data.code !== 0 || !data.data || !data.data.list) {
        return new RESTResult(false, 'data in server is empty');
      }
      const value = [];
      const subDataList = data.data.list;
      for (const subData of subDataList) {
        if (!subData.longFlag) {
          value.push(subData);
        } else {
          const data = await this._postCommonFunc(subUrl, {
            platform,
            key: serverKey,
            subId: subData.subId,
          });
          value.push({ ...subData, value: data.data.value });
        }
      }
      return new RESTResult(true, 'success', value);
    } catch (error) {
      const state = error && error.response && error.response.status;
      switch (state) {
        case 404:
          // the setting in server is empty
          return new RESTResult(true, 'setting is empty', []);
        default:
          return new RESTResult(false, error.message);
      }
    }
  }

  async updateStringPreferences(configKey, value) {
    const url = `${this.host}/api/charge/user/preference/update`;
    const { platform, key, version } = this._generatePostInfo(configKey);
    const postData = {
      preferences: [{ platform, key, value, tsClientUpdate: version }],
      tsClientCurrent: new Date().getTime(),
    };

    try {
      const data = await this._postCommonFunc(url, postData);
      const resultData = data.data ? data.data[0] : {};
      return new RESTResult(data.code === 0, data.message, resultData);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async updateListPreferences(configKey, { update = [], remove = [] }) {
    const url = `${this.host}/api/charge/user/subPreference/update`;
    if (!update.length && !remove.length) {
      return new RESTResult(true, 'there is no need to update', {});
    }
    const { platform, key } = this._generatePostInfo(configKey);
    const postData = { platform, key, tsClientCurrent: new Date().getTime(), update, remove };

    try {
      const data = await this._postCommonFunc(url, postData);
      return new RESTResult(data.code === 0, data.message, data.data);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async deletePreferences(configKeys) {
    const url = `${this.host}/api/charge/user/preference/delete`;
    const configKeyList = Array.isArray(configKeys) ? configKeys : [configKeys];
    const preferences = configKeyList.map(configKey => {
      const { platform, key, version } = this._generatePostInfo(configKey);
      return { platform, key, tsClientUpdate: version };
    });
    const postData = {
      preferences: preferences,
      tsClientCurrent: new Date().getTime(),
    };

    try {
      const data = await this._postCommonFunc(url, postData);
      return new RESTResult(data.code === 0, data.message, data.data);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }
}
