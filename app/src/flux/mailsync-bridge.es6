import path from 'path';
import fs from 'fs';
import { ipcRenderer, remote } from 'electron';
import _ from 'underscore';

import Task from './tasks/task';
import SetObservableRangeTask from './models/set-observable-range-task';
import TaskQueue from './stores/task-queue';
import IdentityStore from './stores/identity-store';

// import Thread from './models/thread';
import Account from './models/account';
import AccountStore from './stores/account-store';
import DatabaseStore from './stores/database-store';
import OnlineStatusStore from './stores/online-status-store';
import DatabaseChangeRecord from './stores/database-change-record';
import DatabaseObjectRegistry from '../registries/database-object-registry';
import MailsyncProcess from '../mailsync-process';
import KeyManager from '../key-manager';
import Actions from './actions';
import Utils from './models/utils';
import AnalyzeDBTask from './tasks/analyze-db-task';

const MAX_CRASH_HISTORY = 10;

const VERBOSE_UNTIL_KEY = 'core.sync.verboseUntil';

const MAX_ANALYZE_INTERVAL = 30 * 24 * 60 * 60 * 1000;
const ANALYZE_CHECK_INTERVAL = 60 * 60 * 1000;

/*
This class keeps track of how often Mailsync workers crash. If a mailsync
worker exits more than 5 times in <5 minutes, we consider it "too many failures"
and won't relaunch it until:

- the user restarts the app, clearing the history
- the user changes the account's settings (updating password, etc.)
- the user explicitly says "Try Again" in the UI

*/
class CrashTracker {
  constructor() {
    this._timestamps = {};
    this._tooManyFailures = {};
  }

  forgetCrashes(fullAccountJSON) {
    const key = this._keyFor(fullAccountJSON);
    delete this._timestamps[key];
    delete this._tooManyFailures[key];
  }

  tailClientLog(accountId) {
    let log = '';
    const logfile = `mailsync-${accountId}.log`;
    try {
      const logpath = path.join(AppEnv.getConfigDirPath(), logfile);
      const { size } = fs.statSync(logpath);
      const tailSize = Math.min(1200, size);
      const buffer = new Buffer(tailSize);
      const fd = fs.openSync(logpath, 'r');
      fs.readSync(fd, buffer, 0, tailSize, size - tailSize);
      log = buffer.toString('UTF8');
      log = log.substr(log.indexOf('\n') + 1);
    } catch (logErr) {
      console.warn(`Could not append ${logfile} to mailsync exception report: ${logErr}`);
    }
    return log;
  }

  recordClientCrash(fullAccountJSON, { code, error, signal }) {
    this._appendCrashToHistory(fullAccountJSON);

    // We now let crashpad do this, because Sentry was losing it's mind.
  }

  _keyFor({ id, settings }) {
    return JSON.stringify({ id, settings });
  }

  _appendCrashToHistory(fullAccountJSON) {
    const key = this._keyFor(fullAccountJSON);
    console.log(`mailsync crashed for account: ${key}`);
    AppEnv.debugLog(`mailsync crashed for account: ${key}`);
    this._timestamps[key] = this._timestamps[key] || [];
    if (this._timestamps[key].unshift(Date.now()) > MAX_CRASH_HISTORY) {
      this._timestamps[key].length = MAX_CRASH_HISTORY;
    }

    // has the client crashed more than 5 times in the last 5 minutes?
    // If so, do not restart. We'll mark that the account is not syncing.
    if (
      this._timestamps[key].length >= 5 &&
      Date.now() - this._timestamps[key][4] < 5 * 60 * 1000
    ) {
      this._tooManyFailures[key] = true;
    }
  }

  tooManyFailures(fullAccountJSON) {
    const key = this._keyFor(fullAccountJSON);
    return this._tooManyFailures[key];
  }
}

export default class MailsyncBridge {
  constructor() {
    if (!AppEnv.isMainWindow() || AppEnv.inSpecMode()) {
      ipcRenderer.on('mailsync-bridge-message', this._onIncomingRebroadcastMessage);
      return;
    }

    Actions.queueTask.listen(this._onQueueTask, this);
    Actions.queueTasks.listen(this._onQueueTasks, this);
    Actions.cancelTask.listen(this._onCancelTask, this);
    Actions.fetchBodies.listen(this._onFetchBodies, this);
    Actions.syncFolders.listen(this._onSyncFolders, this);
    Actions.setObservableRange.listen(this._onSetObservableRange, this);
    Actions.debugFakeNativeMessage.listen(this.fakeEmit, this);
    ipcRenderer.on('thread-new-window', this._onNewWindowOpened);
    ipcRenderer.on('thread-close-window', this._onNewWindowClose);

    this._crashTracker = new CrashTracker();
    this._clients = {};
    this._setObservableRangeTimer = {};
    this._cachedSetObservableRangeTask = {};
    // Store threads that are opened in seperate window
    this._additionalObservableThreads = {};
    this._analyzeDBTimer = null;


    if (AppEnv.isMainWindow()) {
      Actions.analyzeDB.listen(this.analyzeDataBase, this);
      this._analyzeDBTimer = setTimeout(this.analyzeDataBase, 5000);
    }

    AccountStore.listen(this.ensureClients, this);
    OnlineStatusStore.listen(this._onOnlineStatusChanged, this);

    AppEnv.onBeforeUnload(this._onBeforeUnload);
    AppEnv.onReadyToUnload(this._onReadyToUnload);

    process.nextTick(() => {
      console.log('constructor launching clients');
      this.ensureClients('constructor');
    });
  }

  // Public

  openLogs() {
    const { configDirPath } = AppEnv.getLoadSettings();
    const configDirItem = path.join(configDirPath, 'config.json');
    require('electron').shell.showItemInFolder(configDirItem); // eslint-disable-line
  }

  toggleVerboseLogging() {
    const { configDirPath } = AppEnv.getLoadSettings();
    let message = 'Thank you for helping debug EdisonMail. EdisonMail will now restart.';
    let phrase = 'disabled';

    if (AppEnv.config.get(VERBOSE_UNTIL_KEY)) {
      AppEnv.config.set(VERBOSE_UNTIL_KEY, 0);
    } else {
      AppEnv.config.set(VERBOSE_UNTIL_KEY, Date.now() + 30 * 60 * 1000);
      phrase = 'enabled';
      message =
        `Verbose logging will be enabled for the next thirty minutes. This records ` +
        `all network traffic to your mail providers and will be quite slow. Restart EdisonMail ` +
        `and wait for your problem to occur, and then submit mailsync-***.log files located ` +
        `in the directory: \n\n${configDirPath}.\n\nEdisonMail will now restart.`;
    }
    AppEnv.showErrorDialog({
      title: `Verbose logging is now ${phrase}`,
      message,
    });
    remote.app.relaunch();
    remote.app.quit();
  }

  clients() {
    return this._clients;
  }

  ensureClients = _.throttle((kind) => {
    console.log(`ensuring account ${kind}`);
    const clientsWithoutAccounts = Object.assign({}, this._clients);

    for (const acct of AccountStore.accounts()) {
      if (!this._clients[acct.id]) {
        // client for this account is missing, launch it!
        this._launchClient(acct);
      } else {
        // client for this account exists
        delete clientsWithoutAccounts[acct.id];
      }
    }

    // Any clients left in the `clientsWithoutAccounts` after we looped
    // through and deleted one for each accountId are ones representing
    // deleted accounts.
    for (const client of Object.values(clientsWithoutAccounts)) {
      let id = '';
      if (client._proc && client._proc.pid) {
        id = client._proc.pid;
      }
      client.kill();
      if (!kind) {
        AppEnv.debugLog(`@pid ${id} kind is missing value in ensureClients`);
      }
      AppEnv.debugLog(`pid@${id} mailsync-bridge ensureClients: ${kind}`);
    }
  }, 100);

  forceRelaunchClient(account) {
    this._launchClient(account, { force: true });
  }

  analyzeDataBase = () => {
    if (!AppEnv.isMainWindow()) {
      return;
    }
    const analyzeOptions = AppEnv.config.get('analyzeDBOptions') || {};
    const {
      lastAnalyzed = 0,
      analyzeInterval = MAX_ANALYZE_INTERVAL,
      checkInterval = ANALYZE_CHECK_INTERVAL,
    } = analyzeOptions;
    if (Date.now() - lastAnalyzed >= analyzeInterval) {
      const accountIds = Object.keys(this._clients);
      if (accountIds.length > 0) {
        const task = new AnalyzeDBTask({ accountId: accountIds[0] });
        this._onQueueTask(task);
        AppEnv.config.set('analyzeDBOptions', {
          lastAnalyzed: Date.now(),
          analyzeInterval,
          checkInterval,
        });
      }
    }
    this._analyzeDBTimer = setTimeout(this.analyzeDataBase, checkInterval);
  };

  sendSyncMailNow() {
    console.warn('Sending `wake` to all mailsync workers...');
    if (this._clients) {
      for (const client of Object.values(this._clients)) {
        client.sendMessage({ type: 'wake-workers' });
      }
    }
  }

  sendMessageToAccount(accountId, json) {
    if (!this._clients[accountId]) {
      const { emailAddress } = AccountStore.accountForId(accountId) || {};
      return AppEnv.showErrorDialog({
        title: `EdisonMail is unable to sync ${emailAddress}`,
        message: `In order to perform actions on this mailbox, you need to resolve the sync issue. Visit Preferences > Accounts for more information.`,
      });
    }
    if (!this._clients[accountId].isSyncReadyToReceiveMessage()) {
      const { emailAddress } = AccountStore.accountForId(accountId) || {};
      console.log(
        `sync is not ready, initial message not send to native yet. Message for account ${emailAddress} not send`
      );
      this._clients[accountId].appendToSendQueue(json);
      return;
    }
    this._clients[accountId].sendMessage(json);
  }

  async resetCacheForAccount(account, { silent } = {}) {
    // grab the existing client, if there is one
    const syncingClient = this._clients[account.id];
    if (syncingClient) {
      // mark client as removing;
      syncingClient.isRemoving = true;
      let id = '';
      if (syncingClient._proc && syncingClient._proc.pid) {
        id = syncingClient._proc.pid;
      }
      syncingClient.kill();
      AppEnv.debugLog(`pid @ ${id} mailsync-bridge resetCacheForAccount`);
      delete this._clients[account.id];
    }

    // create a new client that will perform the reset
    const resetClient = new MailsyncProcess(this._getClientConfiguration());
    resetClient.account = (await KeyManager.insertAccountSecrets(account)).toJSON();
    resetClient.identity = IdentityStore.identity();
    resetClient.isRemoving = true;

    // no-op - do not allow us to kill this client - we may be reseting the cache of an
    // account which does not exist anymore, but we don't want to interrupt this process
    resetClient.kill = () => {
    };

    this._clients[account.id] = resetClient;

    // kill the old client, ensureClients will be a no-op because the
    // client has already been replaced in our lookup table.

    if (!silent) {
      AppEnv.showErrorDialog({
        title: `Cleanup Started`,
        message: `EdisonMail is clearing it's cache for ${
          account.emailAddress
          }. Depending on the size of the mailbox, this may take a few seconds or a few minutes. An alert will appear when cleanup is complete.`,
      });
    }

    try {
      const start = Date.now();

      await resetClient.resetCache();

      if (!silent) {
        AppEnv.showErrorDialog({
          title: `Cleanup Complete`,
          message: `EdisonMail reset the local cache for ${account.emailAddress} in ${Math.ceil(
            (Date.now() - start) / 1000,
          )} seconds. Your mailbox will now begin to sync again.`,
        });
      }
    } catch (error) {
      AppEnv.showErrorDialog({
        title: `Cleanup Error`,
        message: `EdisonMail was unable to reset the local cache. ${error}`,
      });
    } finally {
      delete this._clients[account.id];
      process.nextTick(() => {
        this.ensureClients('resetCacheForAccount');
      });
    }
  }

  fakeEmit(msgs) {
    this._onIncomingMessages(msgs);
  }

  // Private

  _getClientConfiguration(account) {
    const { configDirPath, resourcePath } = AppEnv.getLoadSettings();
    const verboseUntil = AppEnv.config.get(VERBOSE_UNTIL_KEY) || 0;
    const verbose = verboseUntil && verboseUntil / 1 > Date.now();
    if (verbose) {
      console.warn(`Verbose mailsync logging is enabled until ${new Date(verboseUntil)}`);
    }
    return { configDirPath, resourcePath, verbose };
  }

  async _launchClient(account, { force } = {}) {
    const client = new MailsyncProcess(this._getClientConfiguration());
    this._clients[account.id] = client; // set this synchornously so we never spawn two
    delete this._setObservableRangeTimer[account.id];
    delete this._cachedSetObservableRangeTask[account.id];
    delete this._additionalObservableThreads[account.id];
    const fullAccountJSON = (await KeyManager.insertAccountSecrets(account)).toJSON();

    if (force) {
      this._crashTracker.forgetCrashes(fullAccountJSON);
    } else if (this._crashTracker.tooManyFailures(fullAccountJSON)) {
      delete this._clients[account.id];
      return;
    }

    client.account = fullAccountJSON;
    client.identity = IdentityStore.identity();
    client.sync();
    client.on('deltas', this._onIncomingMessages);
    client.on('close', ({ code, error, signal }) => {
      if (this._clients[account.id] !== client) {
        return;
      }

      delete this._clients[account.id];
      if (signal === 'SIGTERM') {
        return;
      }
      this._crashTracker.recordClientCrash(fullAccountJSON, { code, error, signal });

      const isAuthFailure =
        `${error}`.includes('Response Code: 401') || // mailspring services
        `${error}`.includes('Response Code: 403') || // mailspring services
        `${error}`.includes('ErrorAuthentication'); // mailcore

      if (this._crashTracker.tooManyFailures(fullAccountJSON)) {
        Actions.updateAccount(account.id, {
          syncState: isAuthFailure ? Account.SYNC_STATE_AUTH_FAILED : Account.SYNC_STATE_ERROR,
          syncError: { code, error, signal },
        });
      } else {
        this.ensureClients('_launchClient');
      }
    });

    if (fullAccountJSON.syncState !== Account.SYNC_STATE_OK) {
      // note: This call triggers ensureClients, and must go after this.clients[id] is set
      Actions.updateAccount(account.id, {
        syncState: Account.SYNC_STATE_OK,
        syncError: null,
      });
    }
  }

  _onQueueTask(task) {
    if (!DatabaseObjectRegistry.isInRegistry(task.constructor.name)) {
      console.log(task);
      throw new Error(
        'You must queue a `Task` instance which is registred with the DatabaseObjectRegistry',
      );
    }
    if (!task.id) {
      console.log(task);
      throw new Error(
        'Tasks must have an ID prior to being queued. Check that your Task constructor is calling `super`',
      );
    }
    if (!task.accountId) {
      throw new Error(
        `Tasks must have an accountId. Check your instance of ${task.constructor.name}.`,
      );
    }
    if (task.needToBroadcastBeforeSendTask) {
      if (
        task.needToBroadcastBeforeSendTask.channel &&
        task.needToBroadcastBeforeSendTask.options
      ) {
        // Because we are using sync call, make sure the listener is very short
        console.log('Making sync call, this better be time sensitive operation');
        if (!this._clients[task.accountId]) {
          console.log('client is already dead, we are ignoring this sync call');
          return;
        }
        ipcRenderer.sendSync(
          `mainProcess-sync-call`,
          task.needToBroadcastBeforeSendTask,
        );
      }
    }

    task.willBeQueued();

    task.status = 'local';
    task.origin = new Error().stack
      .split('\n')
      .slice(2)
      .join('\n');

    this.sendMessageToAccount(task.accountId, { type: 'queue-task', task: task });
  }

  _onQueueTasks(tasks) {
    if (!tasks || !tasks.length) {
      return;
    }
    for (const task of tasks) {
      if (task) {
        this._onQueueTask(task);
      }
    }
  }

  _onCancelTask(taskOrId) {
    let task = taskOrId;
    if (typeof taskOrId === 'string') {
      task = TaskQueue.queue().find(t => t.id === taskOrId);
    }
    if (task) {
      this.sendMessageToAccount(task.accountId, { type: 'cancel-task', taskId: task.id });
    }
  }

  _onIncomingMessages = msgs => {
    for (const msg of msgs) {
      if (msg.length === 0) {
        continue;
      }
      if (msg[0] !== '{') {
        console.log(`Sync worker sent non-JSON formatted message: ${msg}`);
        continue;
      }

      let json = null;
      try {
        json = JSON.parse(msg);
      } catch (err) {
        console.log(`Sync worker sent non-JSON formatted message: ${msg}. ${err}`);
        continue;
      }

      const { type, modelJSONs, modelClass } = json;
      if (!modelJSONs || !type || !modelClass) {
        console.log(`Sync worker sent a JSON formatted message with unexpected keys: ${msg}`);
        continue;
      }

      // dispatch the message to other windows
      ipcRenderer.send('mailsync-bridge-rebroadcast-to-all', msg);
      if (AppEnv.enabledFromNativeLog) {
        console.log('----------------From native-------------------');
        console.log(`from native : ${msg}`);
        console.log('---------------------From native END------------------------');
      }
      const models = modelJSONs.map(Utils.convertToModel);
      this._onIncomingChangeRecord(
        new DatabaseChangeRecord({
          type, // TODO BG move to "model" naming style, finding all uses might be tricky
          objectClass: modelClass,
          objects: models,
        }),
      );
    }
  };
  _recordErrorToConsole = task => {
    if (task && task.accountId) {
      const accounts = AppEnv.config.get('accounts');
      let errorAccount = {};
      if (Array.isArray(accounts)) {
        for (let acc of accounts) {
          if (acc.id === task.aid || acc.id === task.accountId) {
            errorAccount = AppEnv.anonymizeAccount(acc);
            break;
          }
        }
      }
      AppEnv.reportError(new Error(`TaskError: account-> ${JSON.stringify(errorAccount)} task-> ${JSON.stringify(task)}`));
    }
  };

  _onIncomingChangeRecord = record => {
    DatabaseStore.trigger(record);

    // Run task success / error handlers if the task is now complete
    // Note: cannot use `record.objectClass` because of subclass names
    if (record.type === 'persist' && record.objects[0] instanceof Task) {
      for (const task of record.objects) {
        if (task.error != null) {
          task.onError(task.error);
          this._recordErrorToConsole(task);
        }
        if (task.status !== 'complete') {
          continue;
        }
        if (task.error != null) {
          task.onError(task.error);
          this._recordErrorToConsole(task);
        } else {
          task.onSuccess();
        }
      }
    }
  };

  _onIncomingRebroadcastMessage = (event, msg) => {
    const { type, modelJSONs, modelClass } = JSON.parse(msg);
    const models = modelJSONs.map(Utils.convertToModel);
    DatabaseStore.trigger(
      new DatabaseChangeRecord({
        type,
        objectClass: modelClass,
        objects: models,
      }),
    );
  };

  _onFetchBodies(messages) {
    const byAccountId = {};
    for (const msg of messages) {
      byAccountId[msg.accountId] = byAccountId[msg.accountId] || [];
      byAccountId[msg.accountId].push(msg.id);
    }
    for (const accountId of Object.keys(byAccountId)) {
      this.sendMessageToAccount(accountId, { type: 'need-bodies', ids: byAccountId[accountId] });
    }
  }

  _onNewWindowOpened = (event, options) => {
    if (options.threadId && options.accountId && this._clients[options.accountId]) {
      if (!this._additionalObservableThreads[options.accountId]) {
        this._additionalObservableThreads[options.accountId] = {};
      }
      this._additionalObservableThreads[options.accountId][options.threadId] = options.threadId;
      if (
        this._cachedSetObservableRangeTask[options.accountId] &&
        !this._isThreadIdWithinRange(options.accountId, options.threadId)
      ) {
        this._onSetObservableRange(
          options.accountId,
          this._cachedSetObservableRangeTask[options.accountId],
          true,
        );
      }
    }
  };
  _onNewWindowClose = (event, options) => {
    if (options.threadId && options.accountId && this._clients[options.accountId]) {
      if (this._additionalObservableThreads[options.accountId]) {
        delete this._additionalObservableThreads[options.accountId][options.threadId];
        if (Object.keys(this._additionalObservableThreads[options.accountId]).length === 0) {
          delete this._additionalObservableThreads[options.accountId];
        }
        if (
          this._cachedSetObservableRangeTask[options.accountId] &&
          !this._isThreadIdWithinRange(options.accountId, options.threadId)
        ) {
          this._onSetObservableRange(
            options.accountId,
            this._cachedSetObservableRangeTask[options.accountId],
            true,
          );
        }
      }
    }
  };
  _isThreadIdWithinRange = (accountId, threadId) => {
    if (!this._cachedSetObservableRangeTask[accountId]) {
      return false;
    }
    return this._cachedSetObservableRangeTask[accountId].threadIds.includes(threadId);
  };
  _updatedCacheObservableRangeTask = (accountId, task) => {
    if (!this._cachedSetObservableRangeTask[accountId]) {
      this._cachedSetObservableRangeTask[accountId] = new SetObservableRangeTask(task);
      return true;
    }
    if (this._cachedSetObservableRangeTask[accountId].threadIds.length !== task.threadIds.length) {
      this._cachedSetObservableRangeTask[accountId] = new SetObservableRangeTask(task);
      return true;
    }
    for (let threadId of task.threadIds) {
      if (!this._cachedSetObservableRangeTask[accountId].threadIds.includes(threadId)) {
        this._cachedSetObservableRangeTask[accountId] = new SetObservableRangeTask(task);
        return true;
      }
    }
    return false;
  };

  _onSetObservableRange = (accountId, task, isManualTrigger = false) => {
    if (!this._clients[accountId]) {
      //account doesn't exist, we clear observable cache
      delete this._setObservableRangeTimer[accountId];
      delete this._cachedSetObservableRangeTask[accountId];
      return;
    }
    if (this._setObservableRangeTimer[accountId]) {
      if (Date.now() - this._setObservableRangeTimer[accountId].timestamp > 1000) {
        if (!this._updatedCacheObservableRangeTask(accountId, task) && !isManualTrigger) {
          return;
        }
        const tmpTask = this._cachedSetObservableRangeTask[accountId];
        if (isManualTrigger) {

          tmpTask.threadIds = [
            ...new Set(
              tmpTask.threadIds.concat(Object.values(this._additionalObservableThreads[accountId])),
            )];
        }
        this._setObservableRangeTimer[accountId].timestamp = Date.now();
        // DC-46
        // We call sendMessageToAccount last on the off chance that mailsync have died,
        // we want to avoid triggering client.kill() before setting observable cache
        this.sendMessageToAccount(accountId, tmpTask.toJSON());
      } else {
        clearTimeout(this._setObservableRangeTimer[accountId].id);
        this._setObservableRangeTimer[accountId] = {
          id: setTimeout(() => {
            if (!this._updatedCacheObservableRangeTask(accountId, task) && !isManualTrigger) {
              return;
            }
            const tmpTask = this._cachedSetObservableRangeTask[accountId];
            if (isManualTrigger) {
              tmpTask.threadIds = [
                ...new Set(
                  tmpTask.threadIds.concat(Object.values(this._additionalObservableThreads[accountId])),
                )];
            }
            this.sendMessageToAccount(accountId, tmpTask.toJSON());
          }, 1000),
          timestamp: Date.now(),
        };
      }
    } else {
      this._setObservableRangeTimer[accountId] = {
        id: setTimeout(() => {
          if (!this._updatedCacheObservableRangeTask(accountId, task) && !isManualTrigger) {
            return;
          }
          const tmpTask = this._cachedSetObservableRangeTask[accountId];
          if (isManualTrigger) {
            tmpTask.threadIds = [
              ...new Set(
                tmpTask.threadIds.concat(Object.values(this._additionalObservableThreads[accountId])),
              )];
          }
          this.sendMessageToAccount(accountId, tmpTask.toJSON());
        }, 1000),
        timestamp: Date.now(),
      };
    }
  };

  _onSyncFolders({ accountId, foldersIds } = {}) {
    if (Array.isArray(foldersIds) && accountId) {
      this.sendMessageToAccount(accountId, {
        type: 'sync-folders',
        aid: accountId,
        ids: foldersIds,
      });
    }
  }

  _onBeforeUnload = readyToUnload => {
    // If other windows are open, delay the closing of the main window
    // by 400ms the first time beforeUnload is called so other windows
    // ave a chance to save drafts before we kill the workers.
    if (remote.getGlobal('application').windowManager.getOpenWindowCount() <= 1) {
      return true;
    }
    if (this._lastWait && Date.now() - this._lastWait < 2000) {
      return true;
    }
    this._lastWait = Date.now();
    setTimeout(readyToUnload, 400);
    return false;
  };

  _onReadyToUnload = () => {
    for (const client of Object.values(this._clients)) {
      let id = '';
      if (client._proc && client._proc.pid) {
        id = client._proc.pid;
      }
      client.kill();
      AppEnv.debugLog(`pid@${id} mailsync-bridge _onReadyToUnload: page refresh`);
    }
    this._clients = {};
  };

  _onOnlineStatusChanged = ({ onlineDidChange, wakingFromSleep }) => {
    if (wakingFromSleep || (onlineDidChange && OnlineStatusStore.isOnline())) {
      this.sendSyncMailNow();
    }
  };
}
