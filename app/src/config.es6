/*
 * decaffeinate suggestions:
 * DS104: Avoid inline assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let app, errorLogger, webContentsId;
let _ = require('underscore');
_ = Object.assign(_, require('./config-utils'));
const { remote } = require('electron');
const { Emitter } = require('event-kit');
const crypto = require('crypto');
const {
  UpdateSettingCode,
  UpdateToServerSimpleSettingTypes,
  UpdateToServerComplexSettingTypes,
  EdisonPlatformType,
  EdisonPreferencesType,
  generateServerConfigKey,
} = require('./constant');

if (process.type === 'renderer') {
  app = remote.getGlobal('application');
  webContentsId = remote.getCurrentWebContents().id;
  ({ errorLogger } = AppEnv);
} else {
  app = global.application;
  webContentsId = null;
  ({ errorLogger } = global);
}

// Essential: Used to access all of N1's configuration details.
//
// An instance of this class is always available as the `AppEnv.config` global.
//
// ## Getting and setting config settings.
//
// ```coffee
// # Note that with no value set, ::get returns the setting's default value.
// AppEnv.config.get('my-package.myKey') # -> 'defaultValue'
//
// AppEnv.config.set('my-package.myKey', 'value')
// AppEnv.config.get('my-package.myKey') # -> 'value'
// ```
//
// You may want to watch for changes. Use {::observe} to catch changes to the setting.
//
// ```coffee
// AppEnv.config.set('my-package.myKey', 'value')
// AppEnv.config.observe 'my-package.myKey', (newValue) ->
//   # `observe` calls immediately and every time the value is changed
//   console.log 'My configuration changed:', newValue
// ```
//
// If you want a notification only when the value changes, use {::onDidChange}.
//
// ```coffee
// AppEnv.config.onDidChange 'my-package.myKey', ({newValue, oldValue}) ->
//   console.log 'My configuration changed:', newValue, oldValue
// ```
//
// ### Value Coercion
//
// Config settings each have a type specified by way of a
// [schema](json-schema.org). For example we might an integer setting that only
// allows integers greater than `0`:
//
// ```coffee
// # When no value has been set, `::get` returns the setting's default value
// AppEnv.config.get('my-package.anInt') # -> 12
//
// # The string will be coerced to the integer 123
// AppEnv.config.set('my-package.anInt', '123')
// AppEnv.config.get('my-package.anInt') # -> 123
//
// # The string will be coerced to an integer, but it must be greater than 0, so is set to 1
// AppEnv.config.set('my-package.anInt', '-20')
// AppEnv.config.get('my-package.anInt') # -> 1
// ```
//
// ## Defining settings for your package
//
// Define a schema under a `config` key in your package main.
//
// ```coffee
// module.exports =
//   # Your config schema
//   config:
//     someInt:
//       type: 'integer'
//       default: 23
//       minimum: 1
//
//   activate: (state) -> # ...
//   # ...
// ```
//
// ## Config Schemas
//
// We use [json schema](http://json-schema.org) which allows you to define your value's
// default, the type it should be, etc. A simple example:
//
// ```coffee
// # We want to provide an `enableThing`, and a `thingVolume`
// config:
//   enableThing:
//     type: 'boolean'
//     default: false
//   thingVolume:
//     type: 'integer'
//     default: 5
//     minimum: 1
//     maximum: 11
// ```
//
// The type keyword allows for type coercion and validation. If a `thingVolume` is
// set to a string `'10'`, it will be coerced into an integer.
//
// ```coffee
// AppEnv.config.set('my-package.thingVolume', '10')
// AppEnv.config.get('my-package.thingVolume') # -> 10
//
// # It respects the min / max
// AppEnv.config.set('my-package.thingVolume', '400')
// AppEnv.config.get('my-package.thingVolume') # -> 11
//
// # If it cannot be coerced, the value will not be set
// AppEnv.config.set('my-package.thingVolume', 'cats')
// AppEnv.config.get('my-package.thingVolume') # -> 11
// ```
//
// ### Supported Types
//
// The `type` keyword can be a string with any one of the following. You can also
// chain them by specifying multiple in an an array. For example
//
// ```coffee
// config:
//   someSetting:
//     type: ['boolean', 'integer']
//     default: 5
//
// # Then
// AppEnv.config.set('my-package.someSetting', 'true')
// AppEnv.config.get('my-package.someSetting') # -> true
//
// AppEnv.config.set('my-package.someSetting', '12')
// AppEnv.config.get('my-package.someSetting') # -> 12
// ```
//
// #### string
//
// Values must be a string.
//
// ```coffee
// config:
//   someSetting:
//     type: 'string'
//     default: 'hello'
// ```
//
// #### integer
//
// Values will be coerced into integer. Supports the (optional) `minimum` and
// `maximum` keys.
//
//   ```coffee
//   config:
//     someSetting:
//       type: 'integer'
//       default: 5
//       minimum: 1
//       maximum: 11
//   ```
//
// #### number
//
// Values will be coerced into a number, including real numbers. Supports the
// (optional) `minimum` and `maximum` keys.
//
// ```coffee
// config:
//   someSetting:
//     type: 'number'
//     default: 5.3
//     minimum: 1.5
//     maximum: 11.5
// ```
//
// #### boolean
//
// Values will be coerced into a Boolean. `'true'` and `'false'` will be coerced into
// a boolean. Numbers, arrays, objects, and anything else will not be coerced.
//
// ```coffee
// config:
//   someSetting:
//     type: 'boolean'
//     default: false
// ```
//
// #### array
//
// Value must be an Array. The types of the values can be specified by a
// subschema in the `items` key.
//
// ```coffee
// config:
//   someSetting:
//     type: 'array'
//     default: [1, 2, 3]
//     items:
//       type: 'integer'
//       minimum: 1.5
//       maximum: 11.5
// ```
//
// #### object
//
// Value must be an object. This allows you to nest config options. Sub options
// must be under a `properties key`
//
// ```coffee
// config:
//   someSetting:
//     type: 'object'
//     properties:
//       myChildIntOption:
//         type: 'integer'
//         minimum: 1.5
//         maximum: 11.5
// ```
//
// ### Other Supported Keys
//
// #### enum
//
// All types support an `enum` key. The enum key lets you specify all values
// that the config setting can possibly be. `enum` _must_ be an array of values
// of your specified type. Schema:
//
// ```coffee
// config:
//   someSetting:
//     type: 'integer'
//     default: 4
//     enum: [2, 4, 6, 8]
// ```
//
// Usage:
//
// ```coffee
// AppEnv.config.set('my-package.someSetting', '2')
// AppEnv.config.get('my-package.someSetting') # -> 2
//
// # will not set values outside of the enum values
// AppEnv.config.set('my-package.someSetting', '3')
// AppEnv.config.get('my-package.someSetting') # -> 2
//
// # If it cannot be coerced, the value will not be set
// AppEnv.config.set('my-package.someSetting', '4')
// AppEnv.config.get('my-package.someSetting') # -> 4
// ```
//
// #### title and description
//
// The settings view will use the `title` and `description` keys to display your
// config setting in a readable way. By default the settings view humanizes your
// config key, so `someSetting` becomes `Some Setting`. In some cases, this is
// confusing for users, and a more descriptive title is useful.
//
// Descriptions will be displayed below the title in the settings view.
//
// ```coffee
// config:
//   someSetting:
//     title: 'Setting Magnitude'
//     description: 'This will affect the blah and the other blah'
//     type: 'integer'
//     default: 4
// ```
//
// __Note__: You should strive to be so clear in your naming of the setting that
// you do not need to specify a title or description!
//
// ## Best practices
//
// * Don't depend on (or write to) configuration keys outside of your keypath.
//
class Config {
  static schemaEnforcers = {};

  static addSchemaEnforcer(typeName, enforcerFunction) {
    if (this.schemaEnforcers[typeName] == null) {
      this.schemaEnforcers[typeName] = [];
    }
    this.schemaEnforcers[typeName].push(enforcerFunction);
  }

  static addSchemaEnforcers(filters) {
    for (var typeName in filters) {
      var functions = filters[typeName];
      for (let name in functions) {
        const enforcerFunction = functions[name];
        this.addSchemaEnforcer(typeName, enforcerFunction);
      }
    }
  }

  static executeSchemaEnforcers(keyPath, value, schema) {
    let error = null;
    let types = schema.type;
    if (!Array.isArray(types)) {
      types = [types];
    }
    for (let type of types) {
      try {
        // ignore unexist type
        if (!this.schemaEnforcers[type]) {
          continue;
        }
        const enforcerFunctions = this.schemaEnforcers[type].concat(this.schemaEnforcers['*']);
        for (let enforcer of enforcerFunctions) {
          // At some point in one's life, one must call upon an enforcer.
          value = enforcer.call(this, keyPath, value, schema);
        }
        error = null;
        break;
      } catch (e) {
        error = e;
      }
    }

    if (error != null) {
      throw error;
    }
    return value;
  }

  // Created during initialization, available as `AppEnv.config`
  constructor() {
    this.emitter = new Emitter();
    this.schema = {
      type: 'object',
      properties: {},
    };

    this.settings = {};
    this.defaultSettings = {};
    this.transactDepth = 0;
    this.serverKeyMap = new Map();

    if (process.type === 'renderer') {
      const { ipcRenderer } = require('electron');
      // If new Config() has already been called, unmount it's listener when
      // we attach ourselves. This is only done during specs, Config is a singleton.
      ipcRenderer.removeAllListeners('on-config-reloaded');
      ipcRenderer.on('on-config-reloaded', () => {
        this.load();
      });
    }
  }

  cloneForErrorLog() {
    const ret = JSON.parse(
      JSON.stringify({
        settings: this.settings,
        defaultSettings: this.defaultSettings,
        schema: this.schema,
      })
    );
    const hash = str => {
      return crypto
        .createHash('sha256')
        .update(str)
        .digest('hex');
    };
    const stripAccountData = account => {
      const sensitveData = [
        'emailAddress',
        'label',
        'name',
        'access_token',
        'ews_password',
        'ews_username',
        'imap_username',
        'smtp_username',
        'imap_password',
        'smtp_password',
      ];
      const ret = {};

      for (let key in account) {
        if (key !== 'aliases' && key !== 'settings' && !sensitveData.includes(key)) {
          ret[key] = account[key];
        } else if (key === 'aliases') {
          ret.aliases = [];
          account.aliases.forEach(alias => {
            ret.aliases.push(hash(alias));
          });
        } else if (key === 'settings') {
          ret.settings = {};
          for (let settingKey in account.settings) {
            if (sensitveData.includes(settingKey)) {
              ret.settings[settingKey] = hash(account.settings[settingKey]);
            } else {
              ret.settings[settingKey] = account.settings[settingKey];
            }
          }
        } else {
          ret[key] = hash(account[key]);
        }
      }
      return ret;
    };
    if (ret.settings && Array.isArray(ret.settings.accounts)) {
      ret.settings.accounts = ret.settings.accounts.map(account => {
        return stripAccountData(account);
      });
    }
    if (ret.settings && ret.settings.defaultSignatures) {
      const tmp = {};
      for (let key in ret.settings.defaultSignatures) {
        tmp[hash(key)] = ret.settings.defaultSignatures[key];
      }
      ret.settings.defaultSignatures = tmp;
    }
    if (ret.settings && ret.settings.signatures) {
      for (let key in ret.settings.signatures) {
        const tmp = ret.settings.signatures[key];
        if (tmp.body) {
          tmp.body = hash(tmp.body);
        }
        if (tmp.title) {
          tmp.title = hash(tmp.title);
        }
        if (tmp.data) {
          if (tmp.data.title) {
            tmp.data.title = hash(tmp.data.title);
          }
          if (tmp.data.templateName) {
            tmp.data.templateName = hash(tmp.data.templateName);
          }
        }
        ret.settings.signatures[key] = tmp;
      }
    }
    return ret;
  }

  _logError(prefix, error) {
    error.message = `${prefix}: ${error.message}`;
    console.error(error.message);
    errorLogger.reportError(error);
  }

  load() {
    this.updateSettings(this.getRawValues());
  }

  /*
    Section: Config Subscription
    */

  // Essential: Add a listener for changes to a given key path. This is different
  // than {::onDidChange} in that it will immediately call your callback with the
  // current value of the config entry.
  //
  // ### Examples
  //
  // You might want to be notified when the themes change. We'll watch
  // `core.themes` for changes
  //
  // ```coffee
  // AppEnv.config.observe 'core.themes', (value) ->
  //   # do stuff with value
  // ```
  //
  // * `keyPath` {String} name of the key to observe
  // * `callback` {Function} to call when the value of the key changes.
  //   * `value` the new value of the key
  //
  // Returns a {Disposable} with the following keys on which you can call
  // `.dispose()` to unsubscribe.
  observe(keyPath, callback) {
    callback(this.get(keyPath));
    return this.onDidChangeKeyPath(keyPath, event => callback(event.newValue));
  }

  // Essential: Add a listener for changes to a given key path. If `keyPath` is
  // not specified, your callback will be called on changes to any key.
  //
  // * `keyPath` (optional) {String} name of the key to observe.
  // * `callback` {Function} to call when the value of the key changes.
  //   * `event` {Object}
  //     * `newValue` the new value of the key
  //     * `oldValue` the prior value of the key.
  //     * `keyPath` the keyPath of the changed key
  //
  // Returns a {Disposable} with the following keys on which you can call
  // `.dispose()` to unsubscribe.
  onDidChange() {
    let callback, keyPath;
    if (arguments.length === 1) {
      [callback] = arguments;
    } else if (arguments.length === 2) {
      [keyPath, callback] = arguments;
    }
    return this.onDidChangeKeyPath(keyPath, callback);
  }

  /*
    Section: Managing Settings
    */

  // Essential: Retrieves the setting for the given key.
  //
  // ### Examples
  //
  // You might want to know what themes are enabled, so check `core.themes`
  //
  // ```coffee
  // AppEnv.config.get('core.themes')
  // ```
  //
  // * `keyPath` The {String} name of the key to retrieve.
  //
  // Returns the value from N1's default settings, the user's configuration
  // file in the type specified by the configuration schema.
  get(keyPath) {
    return this.getRawValue(keyPath);
  }

  // Essential: Sets the value for a configuration setting.
  //
  // This value is stored in N1's internal configuration file.
  //
  // ### Examples
  //
  // You might want to change the themes programmatically:
  //
  // ```coffee
  // AppEnv.config.set('core.themes', ['ui-light', 'my-custom-theme'])
  // ```
  //
  // * `keyPath` The {String} name of the key.
  // * `value` The value of the setting. Passing `undefined` will revert the
  //   setting to the default value.
  //
  // Returns a {Boolean}
  // * `true` if the value was set.
  // * `false` if the value was not able to be coerced to the type specified in the setting's schema.
  set(keyPath, value, silent) {
    if (value === undefined) {
      value = _.valueForKeyPath(this.defaultSettings, keyPath);
    } else {
      try {
        value = this.makeValueConformToSchema(keyPath, value);
      } catch (e) {
        this._logError(`Failed to set keyPath: ${keyPath} = ${value}`, e);
        return false;
      }
    }

    // Ensure that we never send anything but plain javascript objects through
    // remote. Specifically, we don't want to serialize and send function bodies
    // across the IPC bridge.
    if (_.isObject(value)) {
      value = JSON.parse(JSON.stringify(value));
    }

    this.setRawValue(keyPath, value, silent);
    if (
      process.type === 'renderer' &&
      AppEnv &&
      AppEnv.trackingEvent &&
      typeof AppEnv.trackingEvent === 'function'
    ) {
      AppEnv.trackingEvent('Preferences-Config-Set', { keyPath: `${keyPath}:${value}`, value });
    }
    return true;
  }

  _bulkSet = async setList => {
    const commonSetList = [];
    const changeTimeList = [];
    const options = {};
    let ipcNotif = false;
    for (const item of setList) {
      let value = item.value;
      const { type, notifyNative, mergeServerToLocal } = this.getSchema(item.key);
      // special config should use special func
      if (UpdateToServerComplexSettingTypes.includes(type)) {
        if (mergeServerToLocal && typeof mergeServerToLocal === 'function') {
          value = await mergeServerToLocal(item.value);
        } else {
          value = null;
        }
      } else if (UpdateToServerSimpleSettingTypes.includes(type)) {
        const itemLastChangeTimeInLocal = this.getConfigUpdateTime(item.key);
        if (itemLastChangeTimeInLocal && itemLastChangeTimeInLocal > item.tsClientUpdate) {
          // if local change is later then server,
          // should sync local change to server.
          continue;
        }
        if (value === undefined) {
          value = _.valueForKeyPath(this.defaultSettings, item.key);
        } else {
          try {
            value = this.makeValueConformToSchema(item.key, value);
          } catch (e) {
            value = null;
          }
        }
      }
      if (value !== undefined && value !== null) {
        commonSetList.push({
          keyPath: item.key,
          value,
        });
        changeTimeList.push({
          keyPath: item.key,
          time: item.tsClientUpdate,
        });
      }

      if (notifyNative) {
        // should notify native this config is changed
        if (!ipcNotif) {
          ipcNotif = true;
        }
        options[item.key.replace(/\./g, '_')] = value;
      }
    }

    if (commonSetList.length) {
      app.configPersistenceManager.bulkSetRawValue(commonSetList, webContentsId);
    }
    if (changeTimeList.length) {
      app.configPersistenceManager.bulkSetChangeTimeValue(changeTimeList);
    }

    if (ipcNotif) {
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('client-config', options);
    }

    this.load();
  };

  // Essential: Restore the setting at `keyPath` to its default value.
  //
  // * `keyPath` The {String} name of the key.
  // * `options` (optional) {Object}
  unset(keyPath) {
    this.set(keyPath, _.valueForKeyPath(this.defaultSettings, keyPath));
  }

  // Extended: Retrieve the schema for a specific key path. The schema will tell
  // you what type the keyPath expects, and other metadata about the config
  // option.
  //
  // * `keyPath` The {String} name of the key.
  //
  // Returns an {Object} eg. `{type: 'integer', default: 23, minimum: 1}`.
  // Returns `null` when the keyPath has no schema specified.
  getSchema(keyPath) {
    const keys = splitKeyPath(keyPath);
    let { schema } = this;
    for (let key of keys) {
      if (schema == null) {
        break;
      }
      schema = schema.properties != null ? schema.properties[key] : undefined;
    }
    return schema;
  }

  _getConfigKeyByServerKey(platform, key) {
    const keyMap = this.serverKeyMap.get(platform);
    if (!keyMap) {
      return '';
    }
    const syncToServerCommonKey = keyMap.get(key);
    if (syncToServerCommonKey) {
      const theSchema = this.getSchema(syncToServerCommonKey);
      if (theSchema) {
        return syncToServerCommonKey;
      }
    }
    console.log(`This server setting key can not be recognized: ${key}`);
    return '';
  }

  _updateServerKeyMap() {
    const serverCommonKeyMap = new Map();
    const serverMacKeyMap = new Map();
    function traversingObj(obj, parentKey) {
      Object.keys(obj).forEach(key => {
        const nowObj = obj[key] || {};
        const nowKey = `${parentKey ? parentKey + '.' : ''}${key}`;
        if (nowObj.syncToServerCommonKey) {
          serverCommonKeyMap.set(nowObj.syncToServerCommonKey, nowKey);
        }
        serverMacKeyMap.set(generateServerConfigKey(nowKey), nowKey);
        if (nowObj.type === 'object') {
          traversingObj(nowObj.properties, nowKey);
        }
      });
    }

    traversingObj(this.schema.properties);
    const serverKeyMap = new Map();
    serverKeyMap.set(EdisonPlatformType.COMMON, serverCommonKeyMap);
    serverKeyMap.set(EdisonPlatformType.MAC, serverMacKeyMap);
    this.serverKeyMap = serverKeyMap;
  }

  getConfigUpdateTime(keyPath) {
    const value = app.configPersistenceManager.getChangeTimeValue(keyPath);
    if (typeof value !== 'number') {
      return 0;
    }
    return value;
  }

  setConfigUpdateTime(keyPath, changeTime) {
    app.configPersistenceManager.setChangeTimeValue(keyPath, changeTime);
  }

  syncAllPreferencesFromServer = async () => {
    const syncAccountId = this.get('edisonAccountId');
    if (!syncAccountId) {
      return;
    }
    if (this._onSyncPreferencesFromServer) {
      return;
    }
    this._onSyncPreferencesFromServer = true;
    const { PreferencesRest } = require('./rest');
    const setting = await PreferencesRest.getAllPreferences();
    if (!setting.successful) {
      this._onSyncPreferencesFromServer = false;
      this._logError('Sync all setting from server fail', new Error(setting.message));
      return;
    }
    const { data } = setting;
    if (!Array.isArray(data) || !data.length) {
      this._onSyncPreferencesFromServer = false;
      return;
    }
    const configList = [];
    let commonConfigVersion = 0;
    let macConfigVersion = 0;
    data.forEach(platformSetting => {
      if (platformSetting.changed && platformSetting.list && platformSetting.list.length) {
        configList.push(...platformSetting.list);
        if (platformSetting.platform === EdisonPlatformType.MAC) {
          macConfigVersion = platformSetting.version;
        }
        if (platformSetting.platform === EdisonPlatformType.COMMON) {
          commonConfigVersion = platformSetting.version;
        }
      }
    });
    if (!configList.length) {
      this._onSyncPreferencesFromServer = false;
      return;
    }
    try {
      await this._syncPreferencesFromServer(configList);
      await this._singleSyncSignatureOfMobile();
      if (commonConfigVersion) {
        this.set('commonSettingsVersion', commonConfigVersion);
      }
      if (macConfigVersion) {
        this.set('macSettingsVersion', macConfigVersion);
      }
    } catch (err) {
      this._logError('Sync setting from server fail', err);
    }
    this._onSyncPreferencesFromServer = false;
  };

  syncAllPreferencesToServer = async () => {
    const syncAccountId = this.get('edisonAccountId');
    if (!syncAccountId) {
      return;
    }
    if (this._onSyncPreferencesToServer) {
      return;
    }
    this._onSyncPreferencesToServer = true;
    const { PreferencesRest } = require('./rest');
    const setting = await PreferencesRest.getFullPreferences();
    if (!setting.successful) {
      this._onSyncPreferencesToServer = false;
      this._logError('Sync all setting from server fail', new Error(setting.message));
      return;
    }
    const { data } = setting;
    if (!Array.isArray(data)) {
      this._onSyncPreferencesToServer = false;
      return;
    }
    const commonConfigVersionMap = new Map();
    const macConfigVersionMap = new Map();
    data.forEach(platformSetting => {
      if (platformSetting.list && platformSetting.list.length) {
        platformSetting.list.forEach(setting => {
          if (platformSetting.platform === EdisonPlatformType.COMMON) {
            commonConfigVersionMap.set(setting.key, setting.tsClientUpdate);
          }
          if (platformSetting.platform === EdisonPlatformType.MAC) {
            macConfigVersionMap.set(setting.key, setting.tsClientUpdate);
          }
        });
      }
    });

    const shouldSyncToServerList = [];
    const shouldSyncToServer = (obj, parentKey) => {
      Object.keys(obj).forEach(key => {
        const nowObj = obj[key] || {};
        const nowKey = `${parentKey ? parentKey + '.' : ''}${key}`;
        if (nowObj.type === 'object') {
          shouldSyncToServer(nowObj.properties, nowKey);
        }
        if (!nowObj.syncToServer) {
          return;
        }
        const configUpdateTime = this.getConfigUpdateTime(nowKey);
        if (!configUpdateTime) {
          return;
        }
        let serverUpdateTime = 0;
        if (nowObj.syncToServerCommonKey) {
          serverUpdateTime = commonConfigVersionMap.get(nowObj.syncToServerCommonKey) || 0;
        } else {
          serverUpdateTime = macConfigVersionMap.get(generateServerConfigKey(nowKey)) || 0;
        }
        if (configUpdateTime > serverUpdateTime) {
          shouldSyncToServerList.push(nowKey);
        }
      });
    };

    shouldSyncToServer(this.schema.properties);
    for (const keyPath of shouldSyncToServerList) {
      await this._syncSettingToServer(keyPath, this.get(keyPath));
    }

    this._onSyncPreferencesToServer = false;
  };

  clearSyncPreferencesVersion = () => {
    this.set('commonSettingsVersion', 0);
    this.set('macSettingsVersion', 0);
  };

  _syncPreferencesFromServer = async configList => {
    const serverData = await this._handlePreferencesFromServer(configList);
    await this._bulkSet(serverData);
  };

  _handlePreferencesFromServer = async configList => {
    if (process.type !== 'renderer') {
      return;
    }
    const changeList = [];
    for (const conf of configList) {
      const configKey = this._getConfigKeyByServerKey(conf.platform, conf.key);
      if (!configKey) {
        continue;
      }
      let value = null;
      if (conf.longFlag) {
        if (conf.type === EdisonPreferencesType.STRING) {
          value = await this._getLongStrPreferencesValue(conf);
        } else if (conf.type === EdisonPreferencesType.LIST) {
          value = await this._getLongListPreferencesValue(conf);
        }
      } else {
        value = conf.value;
      }
      if (value !== null) {
        const { syncToServer } = this.getSchema(configKey);
        if (syncToServer) {
          changeList.push({
            key: configKey,
            type: conf.type,
            value,
            tsClientUpdate: conf.tsClientUpdate,
          });
        }
      }
    }
    return changeList;
  };

  _getLongStrPreferencesValue = async conf => {
    const { PreferencesRest } = require('./rest');
    const configKey = this._getConfigKeyByServerKey(conf.platform, conf.key);
    if (!configKey) {
      return;
    }
    const result = await PreferencesRest.getStringTypePreference(configKey);
    if (result.successful) {
      const { data } = result;
      if (conf.platform !== data.platform) {
        this._logError(
          'Sync setting syncToServerCommonKey key has error',
          new Error(`the setting platform in server is ${conf.platform}`)
        );
        return;
      } else {
        return data.value;
      }
    } else {
      this._logError('Sync setting from server fail', new Error(result.message));
    }
  };

  _getLongListPreferencesValue = async conf => {
    const { PreferencesRest } = require('./rest');
    const configKey = this._getConfigKeyByServerKey(conf.platform, conf.key);
    if (!configKey) {
      return null;
    }
    const result = await PreferencesRest.getListTypePreference(configKey);
    if (result.successful) {
      const { data } = result;
      if (!data || !data.list) {
        // no change in server with this version
        return null;
      } else if (conf.platform !== data.platform) {
        this._logError(
          'Sync setting syncToServerCommonKey key has error',
          new Error(`the setting platform in server is ${conf.platform}`)
        );
        return null;
      } else {
        const value = [];
        const subDataList = data.list;
        for (const subData of subDataList) {
          if (!subData.longFlag) {
            value.push(subData);
          } else {
            const subDataInServer = await PreferencesRest.getListTypeSubPreference(
              configKey,
              subData.subId
            );
            if (subDataInServer.successful) {
              value.push({ ...subData, value: subDataInServer.data.value });
            } else {
              this._logError('Sync setting from server fail', new Error(subDataInServer.message));
            }
          }
        }
        return value;
      }
    } else {
      this._logError('Sync setting from server fail', new Error(result.message));
      return null;
    }
  };

  _singleSyncSignatureOfMobile = async () => {
    // sync sig from ios and mac, but only sync sig to mac
    const sigKeyInCommonServer = 'signature';
    const sigConfigKey = 'signatures';
    const { PreferencesRest } = require('./rest');
    const commonSigListResult = await PreferencesRest.getFullListTypePreferenceByServerKey({
      serverKey: sigKeyInCommonServer,
      platform: EdisonPlatformType.COMMON,
    });
    if (!commonSigListResult.successful) {
      throw new Error(commonSigListResult.message);
    }
    if (commonSigListResult.data && commonSigListResult.data.length) {
      const commonSigList = commonSigListResult.data.map(sig => ({
        subId: sig.value,
        tsClientUpdate: sig.tsClientUpdate,
        platform: EdisonPlatformType.COMMON,
      }));
      const { mergeServerToLocal } = this.getSchema(sigConfigKey);
      if (mergeServerToLocal && typeof mergeServerToLocal === 'function') {
        const value = await mergeServerToLocal(commonSigList);
        this.set(sigConfigKey, value, true);
      }
    }
  };

  _syncSettingToServer = async (keyPath, value) => {
    const syncAccountId = this.get('edisonAccountId');
    if (syncAccountId) {
      // should sync the change to server
      const configSchema = this.getSchema(keyPath);
      try {
        if (UpdateToServerSimpleSettingTypes.includes(configSchema.type)) {
          await this._syncSimpleSettingToServer(keyPath, value);
        } else if (UpdateToServerComplexSettingTypes.includes(configSchema.type)) {
          await this._syncComplexSettingToServer(keyPath, value);
        }
      } catch (error) {
        this._logError('Sync setting to server fail', error);
      }
    }
  };

  _syncSimpleSettingToServer = async (keyPath, value) => {
    if (process.type !== 'renderer') {
      return;
    }
    const { PreferencesRest } = require('./rest');
    const result = await PreferencesRest.updateStringPreferences(keyPath, value);
    if (result.successful) {
      const { data } = result;
      if (data.code === UpdateSettingCode.Success) {
        // success, pass
      } else if (data.code === UpdateSettingCode.Conflict) {
        const version = this.getConfigUpdateTime(keyPath);
        const createConfigList = [
          {
            key: data.key,
            platform: data.platform,
            longFlag: true,
            type: EdisonPreferencesType.STRING,
            tsClientUpdate: version,
          },
        ];
        this._syncPreferencesFromServer(createConfigList);
      }
    } else {
      this._logError('Sync setting to server fail', new Error(result.message));
    }
  };

  _syncComplexSettingToServer = async (keyPath, value) => {
    if (process.type !== 'renderer') {
      return;
    }
    const { PreferencesRest } = require('./rest');
    const { mergeLocalToServer } = this.getSchema(keyPath);
    if (mergeLocalToServer && typeof mergeLocalToServer === 'function') {
      const { update = [], remove = [], callback = () => {} } =
        (await mergeLocalToServer(value)) || {};
      const result = await PreferencesRest.updateListPreferences(keyPath, { update, remove });
      if (result.successful) {
        const { data } = result;
        const { removeResults = [], updateResults = [] } = data;
        const resultList = [...removeResults, ...updateResults];
        if (resultList.some(subResult => subResult.code === UpdateSettingCode.Conflict)) {
          const version = this.getConfigUpdateTime(keyPath);
          const createConfigList = [
            {
              key: data.key,
              platform: data.platform,
              longFlag: true,
              type: EdisonPreferencesType.LIST,
              tsClientUpdate: version,
            },
          ];
          this._syncPreferencesFromServer(createConfigList);
        } else {
          if (callback && typeof callback === 'function') {
            callback();
          }
        }
      } else {
        this._logError('Sync setting to server fail', new Error(result.message));
      }
    }
  };

  // Extended: Suppress calls to handler functions registered with {::onDidChange}
  // and {::observe} for the duration of `callback`. After `callback` executes,
  // handlers will be called once if the value for their key-path has changed.
  //
  // * `callback` {Function} to execute while suppressing calls to handlers.
  transact(callback) {
    this.transactDepth++;
    try {
      return callback();
    } finally {
      this.transactDepth--;
      this.emitChangeEvent();
    }
  }

  /*
    Section: Internal methods used by core
    */

  pushAtKeyPath(keyPath, value) {
    const arrayValue = this.get(keyPath) || [];
    if (!(arrayValue instanceof Array)) {
      throw new Error(
        `Config.pushAtKeyPath is intended for array values. Value ${JSON.stringify(
          arrayValue
        )} is not an array.`
      );
    }
    const result = arrayValue.push(value);
    this.set(keyPath, arrayValue);
    return result;
  }

  unshiftAtKeyPath(keyPath, value) {
    const arrayValue = this.get(keyPath) || [];
    if (!(arrayValue instanceof Array)) {
      throw new Error(
        `Config.unshiftAtKeyPath is intended for array values. Value ${JSON.stringify(
          arrayValue
        )} is not an array.`
      );
    }
    const result = arrayValue.unshift(value);
    this.set(keyPath, arrayValue);
    return result;
  }

  removeAtKeyPath(keyPath, value) {
    const arrayValue = this.get(keyPath) || [];
    if (!(arrayValue instanceof Array)) {
      throw new Error(
        `Config.removeAtKeyPath is intended for array values. Value ${JSON.stringify(
          arrayValue
        )} is not an array.`
      );
    }
    const result = _.remove(arrayValue, value);
    this.set(keyPath, arrayValue);
    return result;
  }

  setSchema(keyPath, schema) {
    if (!isPlainObject(schema)) {
      throw new Error(`Error loading schema for ${keyPath}: schemas can only be objects!`);
    }

    // eslint-disable-next-line no-constant-condition
    if (!typeof (schema.type != null)) {
      throw new Error(
        `Error loading schema for ${keyPath}: schema objects must have a type attribute`
      );
    }

    let rootSchema = this.schema;
    if (keyPath) {
      for (let key of splitKeyPath(keyPath)) {
        rootSchema.type = 'object';
        if (rootSchema.properties == null) {
          rootSchema.properties = {};
        }
        const { properties } = rootSchema;
        if (properties[key] == null) {
          properties[key] = {};
        }
        rootSchema = properties[key];
      }
    }

    Object.assign(rootSchema, schema);
    this.setDefaults(keyPath, this.extractDefaultsFromSchema(schema));
    this.resetSettingsForSchemaChange();
    this._updateServerKeyMap();
  }

  /*
    Section: Private methods managing global settings
    */

  updateSettings = newSettings => {
    if (!newSettings || _.isEmpty(newSettings)) {
      throw new Error(`Tried to update settings with false-y value: ${newSettings}`);
    }
    this.settings = newSettings;
    this.emitChangeEvent();
  };

  getRawValue(keyPath) {
    let value = _.valueForKeyPath(this.settings, keyPath);
    const defaultValue = _.valueForKeyPath(this.defaultSettings, keyPath);

    if (value != null) {
      value = this.deepClone(value);
      if (isPlainObject(value) && isPlainObject(defaultValue)) {
        _.defaults(value, defaultValue);
      }
    } else {
      value = this.deepClone(defaultValue);
    }

    return value;
  }

  onDidChangeKeyPath(keyPath, callback) {
    let oldValue = this.get(keyPath);
    return this.emitter.on('did-change', () => {
      const newValue = this.get(keyPath);

      if (!_.isEqual(oldValue, newValue)) {
        const event = { oldValue, newValue };
        oldValue = newValue;
        callback(event);
      }
    });
  }

  isSubKeyPath(keyPath, subKeyPath) {
    if (keyPath == null || subKeyPath == null) {
      return false;
    }
    const pathSubTokens = splitKeyPath(subKeyPath);
    const pathTokens = splitKeyPath(keyPath).slice(0, pathSubTokens.length);
    return _.isEqual(pathTokens, pathSubTokens);
  }

  setRawDefault(keyPath, value) {
    _.setValueForKeyPath(this.defaultSettings, keyPath, value);
    this.emitChangeEvent();
  }

  setDefaults(keyPath, defaults) {
    if (defaults != null && isPlainObject(defaults)) {
      const keys = splitKeyPath(keyPath);
      for (let key in defaults) {
        const childValue = defaults[key];
        if (!Object.prototype.hasOwnProperty.call(defaults, key)) {
          continue;
        }
        this.setDefaults(keys.concat([key]).join('.'), childValue);
      }
    } else {
      try {
        defaults = this.makeValueConformToSchema(keyPath, defaults);
        this.setRawDefault(keyPath, defaults);
      } catch (e) {
        this._logError(
          `Failed to set keypath to default: ${keyPath} = ${JSON.stringify(defaults)}`,
          e
        );
      }
    }
  }

  deepClone(object) {
    if (_.isArray(object)) {
      return object.map(value => this.deepClone(value));
    } else if (isPlainObject(object)) {
      return _.mapObject(object, value => this.deepClone(value));
    } else {
      return object;
    }
  }

  extractDefaultsFromSchema(schema) {
    if (schema.default != null) {
      return schema.default;
    } else if (
      schema.type === 'object' &&
      schema.properties != null &&
      isPlainObject(schema.properties)
    ) {
      const defaults = {};
      const properties = schema.properties || {};
      for (let key in properties) {
        const value = properties[key];
        defaults[key] = this.extractDefaultsFromSchema(value);
      }
      return defaults;
    }
  }

  makeValueConformToSchema(keyPath, value) {
    let schema = this.getSchema(keyPath);
    if (schema) {
      value = this.constructor.executeSchemaEnforcers(keyPath, value, schema);
    }
    return value;
  }

  // When the schema is changed / added, there may be values set in the config
  // that do not conform to the schema. This reset will make them conform.
  resetSettingsForSchemaChange() {
    return this.transact(() => {
      let settings = this.getRawValues();
      settings = this.makeValueConformToSchema(null, settings);
      if (!settings || _.isEmpty(settings)) {
        throw new Error('settings is falsey or empty');
      }
      app.configPersistenceManager.setShouldSyncToNativeConfigs(
        this.getShouldSyncToNativeConfigs()
      );
      app.configPersistenceManager.setSettings(settings, webContentsId);
    });
  }

  emitChangeEvent() {
    if (!(this.transactDepth > 0)) {
      this.emitter.emit('did-change');
    }
  }

  getRawValues() {
    try {
      const result = JSON.parse(app.configPersistenceManager.getRawValuesString());
      if (!result || _.isEmpty(result)) {
        throw new Error('settings is falsey or empty');
      }
      return result;
    } catch (error) {
      this._logError('Failed to parse response from getRawValuesString', error);
      throw error;
    }
  }

  setRawValue(keyPath, value, silent = false) {
    app.configPersistenceManager.setRawValue(keyPath, value, webContentsId);
    this.setConfigUpdateTime(keyPath, new Date().getTime());
    const configSchema = this.getSchema(keyPath);
    if (process.type === 'renderer' && !silent && configSchema && configSchema.syncToServer) {
      this._syncSettingToServer(keyPath, value);
    }
    if (configSchema && configSchema.notifyNative) {
      // should notify native this config is changed
      const { ipcRenderer } = require('electron');
      const options = {};
      options[keyPath.replace(/\./g, '_')] = value;
      ipcRenderer.send('client-config', options);
    }
    this.load();
  }
  getShouldSyncToNativeConfigs = () => {
    const options = [];
    const findNotifyNativeConfig = (schemaList, parentKeyPath) => {
      Object.keys(schemaList).forEach(key => {
        const schema = schemaList[key];
        const keyPath = `${parentKeyPath ? parentKeyPath + '.' : ''}${key}`;
        if (schema.notifyNative) {
          options.push(keyPath);
          return;
        }
        // if schema.notifyNative is true and schema has properties
        // skip the properties find
        if (schema.properties) {
          findNotifyNativeConfig(schema.properties, keyPath);
        }
      });
    };
    findNotifyNativeConfig(this.schema.properties);
    return options;
  };
}

// Base schema enforcers. These will coerce raw input into the specified type,
// and will throw an error when the value cannot be coerced. Throwing the error
// will indicate that the value should not be set.
//
// Enforcers are run from most specific to least. For a schema with type
// `integer`, all the enforcers for the `integer` type will be run first, in
// order of specification. Then the `*` enforcers will be run, in order of
// specification.
Config.addSchemaEnforcers({
  integer: {
    coerce(keyPath, value, schema) {
      value = parseInt(value, 10);
      if (isNaN(value) || !isFinite(value)) {
        throw new Error(
          `Validation failed at ${keyPath}, ${JSON.stringify(value)} cannot be coerced into an int`
        );
      }
      return value;
    },
  },

  number: {
    coerce(keyPath, value, schema) {
      value = parseFloat(value);
      if (isNaN(value) || !isFinite(value)) {
        throw new Error(
          `Validation failed at ${keyPath}, ${JSON.stringify(
            value
          )} cannot be coerced into a number`
        );
      }
      return value;
    },
  },

  boolean: {
    coerce(keyPath, value, schema) {
      switch (typeof value) {
        case 'string':
          if (value.toLowerCase() === 'true') {
            return true;
          } else if (value.toLowerCase() === 'false') {
            return false;
          } else {
            throw new Error(
              `Validation failed at ${keyPath}, ${JSON.stringify(
                value
              )} must be a boolean or the string 'true' or 'false'`
            );
          }
        case 'boolean':
          return value;
        default:
          throw new Error(
            `Validation failed at ${keyPath}, ${JSON.stringify(
              value
            )} must be a boolean or the string 'true' or 'false'`
          );
      }
    },
  },

  string: {
    validate(keyPath, value, schema) {
      if (typeof value !== 'string') {
        throw new Error(
          `Validation failed at ${keyPath}, ${JSON.stringify(value)} must be a string`
        );
      }
      return value;
    },
  },

  null: {
    // null sort of isnt supported. It will just unset in this case
    coerce(keyPath, value, schema) {
      if (![undefined, null].includes(value)) {
        throw new Error(`Validation failed at ${keyPath}, ${JSON.stringify(value)} must be null`);
      }
      return value;
    },
  },

  object: {
    coerce(keyPath, value, schema) {
      if (!isPlainObject(value)) {
        throw new Error(
          `Validation failed at ${keyPath}, ${JSON.stringify(value)} must be an object`
        );
      }
      if (schema.properties == null) {
        return value;
      }

      const newValue = {};
      for (let prop in value) {
        const propValue = value[prop];
        const childSchema = schema.properties[prop];
        if (childSchema != null) {
          try {
            newValue[prop] = this.executeSchemaEnforcers(
              `${keyPath}.${prop}`,
              propValue,
              childSchema
            );
          } catch (error) {
            console.warn(`Error setting item in object: ${error.message}`);
          }
        } else {
          // Just pass through un-schema'd values
          newValue[prop] = propValue;
        }
      }

      return newValue;
    },
  },

  array: {
    coerce(keyPath, value, schema) {
      if (!Array.isArray(value)) {
        throw new Error(
          `Validation failed at ${keyPath}, ${JSON.stringify(value)} must be an array`
        );
      }
      const itemSchema = schema.items;
      if (itemSchema != null) {
        const newValue = [];
        for (let item of value) {
          try {
            newValue.push(this.executeSchemaEnforcers(keyPath, item, itemSchema));
          } catch (error) {
            console.warn(`Error setting item in array: ${error.message}`);
          }
        }
        return newValue;
      } else {
        return value;
      }
    },
  },

  '*': {
    coerceMinimumAndMaximum(keyPath, value, schema) {
      if (typeof value !== 'number') {
        return value;
      }
      if (schema.minimum != null && typeof schema.minimum === 'number') {
        value = Math.max(value, schema.minimum);
      }
      if (schema.maximum != null && typeof schema.maximum === 'number') {
        value = Math.min(value, schema.maximum);
      }
      return value;
    },

    validateEnum(keyPath, value, schema) {
      const possibleValues = schema.enum;
      if (possibleValues == null || !Array.isArray(possibleValues) || !possibleValues.length) {
        return value;
      }

      for (let possibleValue of possibleValues) {
        // Using `isEqual` for possibility of placing enums on array and object schemas
        if (_.isEqual(possibleValue, value)) {
          return value;
        }
      }

      throw new Error(
        `Validation failed at ${keyPath}, ${JSON.stringify(value)} is not one of ${JSON.stringify(
          possibleValues
        )}`
      );
    },
  },
});

var isPlainObject = value =>
  _.isObject(value) && !_.isArray(value) && !_.isFunction(value) && !_.isString(value);

var splitKeyPath = function(keyPath) {
  if (keyPath == null) {
    return [];
  }
  let startIndex = 0;
  const keyPathArray = [];
  for (let i = 0; i < keyPath.length; i++) {
    const char = keyPath[i];
    if (char === '.' && (i === 0 || keyPath[i - 1] !== '\\')) {
      keyPathArray.push(keyPath.substring(startIndex, i));
      startIndex = i + 1;
    }
  }
  keyPathArray.push(keyPath.substr(startIndex, keyPath.length));
  return keyPathArray;
};

const withoutEmptyObjects = function(object) {
  let resultObject = undefined;
  if (isPlainObject(object)) {
    for (let key in object) {
      const value = object[key];
      // eslint-disable-next-line no-unused-vars
      const newValue = withoutEmptyObjects(value);
      if (newValue != null) {
        if (resultObject == null) {
          resultObject = {};
        }
        resultObject[key] = newValue;
      }
    }
  } else {
    resultObject = object;
  }
  return resultObject;
};

module.exports = Config;
