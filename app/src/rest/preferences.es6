import axios from 'axios';
import RESTResult from './result-data-format';
import { AccountStore, Constant } from 'mailspring-exports';

const { EdisonPlatformType } = Constant;

export default class Preferences {
  constructor(host) {
    this.host = host;
  }

  async getAllPreferences() {
    const url = `${this.host}/api/charge/user/preference/list`;
    const syncAccount = AccountStore.syncAccount();
    if (!syncAccount) {
      return new RESTResult(false, 'sync account is unexpected');
    }

    const token = syncAccount.settings.edison_token;
    if (!token) {
      return new RESTResult(false, 'sync account has no token');
    }
    const commonConfigVersion = AppEnv.config.get('commonSettingsVersion');
    const macConfigVersion = AppEnv.config.get('macSettingsVersion');
    const postData = [
      { platform: EdisonPlatformType.COMMON, version: commonConfigVersion },
      { platform: EdisonPlatformType.MAC, version: macConfigVersion },
    ];

    try {
      const { data } = await axios.post(url, postData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const configList = (data.data || []).filter(
        conf =>
          conf.changed &&
          [EdisonPlatformType.COMMON, EdisonPlatformType.MAC].includes(conf.platform)
      );
      return new RESTResult(data.code === 0, data.message, configList);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async getListTypePreference(configKey) {
    const url = `${this.host}/api/charge/user/subPreference/list`;
    const syncAccount = AccountStore.syncAccount();
    if (!syncAccount) {
      return new RESTResult(false, 'sync account is unexpected');
    }

    const token = syncAccount.settings.edison_token;
    if (!token) {
      return new RESTResult(false, 'sync account has no token');
    }
    const configSchema = AppEnv.config.getSchema(configKey);
    const platform = configSchema.syncToServerCommonKey
      ? EdisonPlatformType.COMMON
      : EdisonPlatformType.MAC;
    const configKeyInServer = configSchema.syncToServerCommonKey
      ? configSchema.syncToServerCommonKey
      : configKey.replace(/\./g, '_');
    const version = AppEnv.config.getConfigUpdateTime(configKey);
    const postData = {
      platform: platform,
      key: configKeyInServer,
      version: version,
    };
    try {
      const { data } = await axios.post(url, postData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return new RESTResult(data.code === 0, data.message, data.data);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async getStringTypePreference(configKey) {
    const url = `${this.host}/api/charge/user/preference/fetch`;
    const syncAccount = AccountStore.syncAccount();
    if (!syncAccount) {
      return new RESTResult(false, 'sync account is unexpected');
    }

    const token = syncAccount.settings.edison_token;
    if (!token) {
      return new RESTResult(false, 'sync account has no token');
    }
    const configSchema = AppEnv.config.getSchema(configKey);
    const platform = configSchema.syncToServerCommonKey
      ? EdisonPlatformType.COMMON
      : EdisonPlatformType.MAC;
    const configKeyInServer = configSchema.syncToServerCommonKey
      ? configSchema.syncToServerCommonKey
      : configKey.replace(/\./g, '_');

    const postData = {
      platform: platform,
      key: configKeyInServer,
    };

    try {
      const { data } = await axios.post(url, postData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return new RESTResult(data.code === 0, data.message, data.data);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async getListTypeSubPreference(configKey, subId) {
    const url = `${this.host}/api/charge/user/subPreference/fetch`;
    const syncAccount = AccountStore.syncAccount();
    if (!syncAccount) {
      return new RESTResult(false, 'sync account is unexpected');
    }

    const token = syncAccount.settings.edison_token;
    if (!token) {
      return new RESTResult(false, 'sync account has no token');
    }
    if (!subId) {
      return new RESTResult(false, 'subId is unexpected');
    }
    const configSchema = AppEnv.config.getSchema(configKey);
    const platform = configSchema.syncToServerCommonKey
      ? EdisonPlatformType.COMMON
      : EdisonPlatformType.MAC;
    const configKeyInServer = configSchema.syncToServerCommonKey
      ? configSchema.syncToServerCommonKey
      : configKey.replace(/\./g, '_');

    const postData = {
      platform: platform,
      key: configKeyInServer,
      subId,
    };

    try {
      const { data } = await axios.post(url, postData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      return new RESTResult(data.code === 0, data.message, data.data);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async updateStringPreferences(configKey, value) {
    const url = `${this.host}/api/charge/user/preference/update`;
    const syncAccount = AccountStore.syncAccount();
    if (!syncAccount) {
      return new RESTResult(false, 'sync account is unexpected');
    }

    const token = syncAccount.settings.edison_token;
    if (!token) {
      return new RESTResult(false, 'sync account has no token');
    }
    const configSchema = AppEnv.config.getSchema(configKey);
    const platform = configSchema.syncToServerCommonKey
      ? EdisonPlatformType.COMMON
      : EdisonPlatformType.MAC;
    const configKeyInServer = configSchema.syncToServerCommonKey
      ? configSchema.syncToServerCommonKey
      : configKey.replace(/\./g, '_');
    const tsClientCurrent = new Date().getTime();
    const tsClientUpdate = AppEnv.config.getConfigUpdateTime(configKey);
    const postData = {
      preferences: [
        {
          platform,
          key: configKeyInServer,
          value: value,
          tsClientUpdate: tsClientUpdate,
        },
      ],
      tsClientCurrent: tsClientCurrent,
    };

    try {
      const { data } = await axios.post(url, postData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const resultData = data.data ? data.data[0] : {};
      return new RESTResult(data.code === 0, data.message, resultData);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async updateListPreferences(configKey, { update = [], remove = [] }) {
    const url = `${this.host}/api/charge/user/subPreference/update`;
    const syncAccount = AccountStore.syncAccount();
    if (!syncAccount) {
      return new RESTResult(false, 'sync account is unexpected');
    }

    const token = syncAccount.settings.edison_token;
    if (!token) {
      return new RESTResult(false, 'sync account has no token');
    }
    if (!update.length && !remove.length) {
      return;
    }
    const configSchema = AppEnv.config.getSchema(configKey);
    const platform = configSchema.syncToServerCommonKey
      ? EdisonPlatformType.COMMON
      : EdisonPlatformType.MAC;
    const configKeyInServer = configSchema.syncToServerCommonKey
      ? configSchema.syncToServerCommonKey
      : configKey.replace(/\./g, '_');
    const tsClientCurrent = new Date().getTime();
    const postData = {
      platform: platform,
      key: configKeyInServer,
      tsClientCurrent: tsClientCurrent,
      update: update,
      remove: remove,
    };

    try {
      const { data } = await axios.post(url, postData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return new RESTResult(data.code === 0, data.message, data.data);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }

  async deletePreferences(configKeys) {
    const url = `${this.host}/api/charge/user/preference/delete`;
    const syncAccount = AccountStore.syncAccount();
    if (!syncAccount) {
      return new RESTResult(false, 'sync account is unexpected');
    }

    const token = syncAccount.settings.edison_token;
    if (!token) {
      return new RESTResult(false, 'sync account has no token');
    }
    const configKeyList = Array.isArray(configKeys) ? configKeys : [configKeys];
    const preferences = configKeyList.map(configKey => {
      const configSchema = AppEnv.config.getSchema(configKey);
      const platform = configSchema.syncToServerCommonKey
        ? EdisonPlatformType.COMMON
        : EdisonPlatformType.MAC;
      const configKeyInServer = configSchema.syncToServerCommonKey
        ? configSchema.syncToServerCommonKey
        : configKey.replace(/\./g, '_');
      const tsClientUpdate = AppEnv.config.getConfigUpdateTime(configKey);
      return {
        platform: platform,
        key: configKeyInServer,
        tsClientUpdate: tsClientUpdate,
      };
    });

    const tsClientCurrent = new Date().getTime();
    const postData = {
      preferences: preferences,
      tsClientCurrent: tsClientCurrent,
    };

    try {
      const { data } = await axios.post(url, postData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      return new RESTResult(data.code === 0, data.message, data.data);
    } catch (error) {
      return new RESTResult(false, error.message);
    }
  }
}
