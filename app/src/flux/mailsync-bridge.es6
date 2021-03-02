import path from 'path';
import fs from 'fs';
import { ipcRenderer, remote } from 'electron';
import _ from 'underscore';
import Task from './tasks/task';
import SetObservableRange from './models/set-observable-range';
import TaskQueue from './stores/task-queue';
import IdentityStore from './stores/identity-store';
import Account from './models/account';
import Sift from './models/sift';
import Matcher from './attributes/matcher';
import AccountStore from './stores/account-store';
import DatabaseStore from './stores/database-store';
import OnlineStatusStore from './stores/online-status-store';
import DatabaseChangeRecord from './stores/database-change-record';
import DatabaseObjectRegistry from '../registries/database-object-registry';
import MailsyncProcess, { mailSyncModes } from '../mailsync-process';
import KeyManager from '../key-manager';
import Actions from './actions';
import Utils from './models/utils';
import AnalyzeDBTask from './tasks/analyze-db-task';
import SiftChangeSharingOptTask from './tasks/sift-change-sharing-opt-task';
import Message from './models/message';
import NativeReportTask from './tasks/native-report-task';
import { spawn } from 'child_process';
let FocusedPerspectiveStore = null;
let focusedContentStore = null;
const FocusedContentStore = () => {
  return (focusedContentStore =
    focusedContentStore || require('./stores/focused-content-store').default);
};
let Thread = null;
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
      const buffer = Buffer.alloc(tailSize);
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
    this._appendCrashToHistory(fullAccountJSON, { code, error, signal });

    // We now let crashpad do this, because Sentry was losing it's mind.
  }

  _keyFor({ id, settings }) {
    return JSON.stringify({ id, settings });
  }

  _appendCrashToHistory(fullAccountJSON, { code = 0, error, signal } = {}) {
    const key = this._keyFor(fullAccountJSON);
    if (code === null) {
      console.log('mailsync crashed');
      AppEnv.reportError(new Error(`mailsync crashed for account: ${key}`));
    } else {
      console.log('mailsync exited');
      AppEnv.reportWarning(
        new Error(
          `mailsync existed with code: ${code}, error: ${error}, signal: ${signal} for account: ${key}`
        )
      );
    }
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
    Actions.fetchAttachments.listen(this._onFetchAttachments, this);
    Actions.syncFolders.listen(this._onSyncFolders, this);
    Actions.syncFolderList.listen(this._onSyncFolderList, this);
    Actions.syncSiftFolder.listen(this._onSyncSiftFolder, this);
    Actions.setObservableRange.listen(this._onSetObservableRange, this);
    Actions.debugFakeNativeMessage.listen(this.fakeEmit, this);
    Actions.forceKillAllClients.listen(this.forceKillClients, this);
    Actions.forceDatabaseTrigger.listen(this._onIncomingChangeRecord, this);
    Actions.dataShareOptions.listen(this.onDataShareOptionsChange, this);
    Actions.remoteSearch.listen(this._onRemoteSearch, this);
    Actions.startDBVacuum.listen(this._onVacuum, this);
    Actions.fetchNativeRuntimeInfo.listen(this._onFetchNativeRuntimeInfo, this);
    ipcRenderer.on('mailsync-config', this._onMailsyncConfigUpdate);
    ipcRenderer.on('client-config', this._onClientConfigUpdate);
    ipcRenderer.on('thread-new-window', this._onNewWindowOpened);
    ipcRenderer.on('refresh-start-of-day', this._refreshStartOfDay);
    // ipcRenderer.on('thread-close-window', this._onNewWindowClose);

    this._crashTracker = new CrashTracker();
    this._clients = {};
    this._sift = null;
    this._clientsStartTime = {};
    this._fetchBodiesCacheTTL = 30000;
    this._fetchAttachmentCacheTTL = 60000;
    this._cachedFetchBodies = {};
    this._cachedFetchAttachments = {};
    this._setObservableRangeTimer = {};
    this._cachedObservableThreadIds = {};
    this._cachedObservableMessageIds = {};
    this._cachedObservableFolderIds = {};
    this._folderListCache = {};
    this._folderListTTL = 60000;
    this._cachedObservableTTL = 30000;
    this._analyzeDBTimer = null;
    this._isVacuuming = false;

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
    }).then(() => {
      if (!process.mas) {
        remote.app.relaunch();
      }
      remote.app.quit();
    });
  }

  clients() {
    return this._clients;
  }

  ensureClients = _.throttle(kind => {
    if (this._noRelaunch) {
      console.log('no relaunch of clients');
      return;
    }
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

  onDataShareOptionsChange({ optOut = false } = {}) {
    if (this._sift) {
      const task = new SiftChangeSharingOptTask({ sharingOpt: !optOut ? 1 : 0 });
      this._onQueueTask(task);
    }
  }

  _onVacuum() {
    if (this._isVacuuming) {
      AppEnv.logDebug(`We are already vacuuming db`);
      return;
    }
    this._isVacuuming = true;
    setTimeout(() => {
      AppEnv.logDebug('killing clients for vacuum');
      this.forceKillClients('Vacuum', false);
      this.killSift('Vacuum');
      DatabaseStore.vaccum().then(() => {
        AppEnv.logDebug('Vacuuming finished, starting clients');
        this._noRelaunch = false;
        this.ensureClients('Vacuum Finished');
        this.startSift('Vacuum Finished');
        Actions.endDBVacuum();
        AppEnv.logDebug('Notifying UI Vacuum finished');
        this._isVacuuming = false;
      });
    });
  }

  forceKillClients(source = '', resetDB = true) {
    if (!AppEnv.isMainWindow()) {
      return;
    }
    this._noRelaunch = true;
    for (const client of Object.values(this.clients())) {
      if (client) {
        if (client._proc && client._proc.pid) {
          const id = client._proc.pid;
          AppEnv.logWarning(`\n\n@pid ${id} was forced to die, it shall not re-spawn\n\n`);
          client.kill();
        }
      }
    }
    this._clients = {};
    if (resetDB) {
      ipcRenderer.send('command', 'application:reset-database', {
        source: `forceKillClients:${source}`,
      });
    }
  }

  forceRelaunchClient(account) {
    this._launchClient(account, { force: true });
  }
  tmpKillClient(account) {
    if (!AppEnv.isMainWindow()) {
      return;
    }
    if (!this._tmpNoRelaunch) {
      this._tmpNoRelaunch = {};
    }
    const client = this.clients()[account.id];
    if (client) {
      if (client._proc && client._proc.pid) {
        const id = client._proc.pid;
        this._tmpNoRelaunch[account.id] = true;
        AppEnv.logWarning(`\n\n@pid ${id} was forced to die, entering one time re-spawn\n\n`);
        client.kill();
      }
    }
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

  sendSyncMailNow(accountId) {
    if (accountId) {
      if (this._clients && this._clients[accountId]) {
        this._clients[accountId].sendMessage({ type: 'wake-workers' });
      }
    } else {
      if (this._clients) {
        console.warn('Sending `wake` to all mailsync workers...');
        for (const client of Object.values(this._clients)) {
          client.sendMessage({ type: 'wake-workers' });
        }
      }
    }
    this._onSyncSiftFolder();
  }

  async sendMessageToAccount(accountId, json, mailSyncMode = mailSyncModes.SYNC) {
    if (this._isVacuuming) {
      AppEnv.logDebug(`Message ${json} ignored, because is Vacuuming`);
      return;
    }
    let client;
    if (mailSyncMode !== mailSyncModes.SIFT) {
      client = this._clients[accountId];
      if (!AccountStore.accountForId(accountId)) {
        return;
      }
    } else {
      client = this._sift;
    }
    if (!client && mailSyncMode !== mailSyncModes.SIFT) {
      const account = AccountStore.accountForId(accountId) || {};
      const emailAddress = account.emailAddress;
      if (emailAddress) {
        const fullAccountJSON = (await KeyManager.insertAccountSecrets(account)).toJSON();
        if (this._crashTracker.tooManyFailures(fullAccountJSON)) {
          delete this._clientsStartTime[account.id];
          Actions.updateAccount(account.pid || account.id, {
            syncState: Account.SYNC_STATE_ERROR,
            syncError: null,
          });
          return;
        } else {
          this.ensureClients('sendMessageToAccount');
          return;
        }
      } else {
        return AppEnv.showErrorDialog({
          title: `EdisonMail is unable to sync `,
          message: `In order to perform actions on this mailbox, you need to resolve the sync issue. Visit Preferences > Accounts for more information.`,
        });
      }
    } else if (!client && mailSyncMode === mailSyncModes.SIFT) {
      await this._launchSift({ force: true, reason: 'Sending message to sift' });
      client = this._sift;
      if (client && !client.isSyncReadyToReceiveMessage()) {
        console.log(`sift is not ready, message not send to native yet.`);
        client.appendToSendQueue(json);
        return;
      } else if (client) {
        client.sendMessage(json);
      }
      return;
    }
    if (!client.isSyncReadyToReceiveMessage()) {
      const { emailAddress } = AccountStore.accountForId(accountId) || {};
      console.log(
        `sync is not ready, initial message not send to native yet. Message for account ${emailAddress} not send`
      );
      client.appendToSendQueue(json);
      return;
    }
    client.sendMessage(json);
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
      delete this._clientsStartTime[account.id];
    }

    // create a new client that will perform the reset
    const resetClient = new MailsyncProcess(this._getClientConfiguration());
    resetClient.account = (await KeyManager.insertAccountSecrets(account)).toJSON();
    resetClient.identity = IdentityStore.identity();
    resetClient.isRemoving = true;

    // no-op - do not allow us to kill this client - we may be reseting the cache of an
    // account which does not exist anymore, but we don't want to interrupt this process
    resetClient.kill = () => {};

    this._clients[account.id] = resetClient;

    // kill the old client, ensureClients will be a no-op because the
    // client has already been replaced in our lookup table.

    if (!silent) {
      AppEnv.showErrorDialog({
        title: `Cleanup Started`,
        message: `EdisonMail is clearing it's cache for ${account.emailAddress}. Depending on the size of the mailbox, this may take a few seconds or a few minutes. An alert will appear when cleanup is complete.`,
      });
    }

    try {
      const start = Date.now();

      await resetClient.resetCache();

      if (!silent) {
        AppEnv.showErrorDialog({
          title: `Cleanup Complete`,
          message: `EdisonMail reset the local cache for ${account.emailAddress} in ${Math.ceil(
            (Date.now() - start) / 1000
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
      delete this._clientsStartTime[account.id];
      process.nextTick(() => {
        this.ensureClients('resetCacheForAccount');
      });
    }
  }

  fakeEmit(msgs) {
    this._onIncomingMessages(msgs);
  }
  fakeTask(task) {
    this.sendMessageToAccount(task.accountId || task.aid, { type: 'queue-task', task: task });
  }

  // Private

  _getClientConfiguration(account) {
    const { configDirPath, resourcePath } = AppEnv.getLoadSettings();
    const disableThread = AppEnv.isDisableThreading();
    const verboseUntil = AppEnv.config.get(VERBOSE_UNTIL_KEY) || 0;
    const verbose = verboseUntil && verboseUntil / 1 > Date.now();
    if (verbose) {
      console.warn(`Verbose mailsync logging is enabled until ${new Date(verboseUntil)}`);
    }
    return { configDirPath, resourcePath, verbose, disableThread };
  }

  startSift(reason = 'Unknown') {
    //Returns a promise
    return this._launchSift({ force: true, reason });
  }

  sift() {
    return this._sift;
  }
  killSift(reason = 'Unknown') {
    if (this._sift) {
      this._sift.kill();
      AppEnv.debugLog(`sift killed, triggered by ${reason}`);
      this._sift = null;
    } else {
      AppEnv.debugLog(`sift not killed, triggered by ${reason},`);
    }
  }

  async _launchSift({ force = false, reason = 'Unknown' } = {}) {
    AppEnv.debugLog(`launching sift, triggered by ${reason}, is forced: ${force}`);
    if (this._sift) {
      if (force) {
        this._sift.kill();
      } else {
        return;
      }
    }
    const client = new MailsyncProcess(this._getClientConfiguration());
    this._sift = client;
    client.identity = IdentityStore.identity();
    client.updatePrivacyOptions(AppEnv.config.get('core.privacy'));
    const supportId = AppEnv.config.get('core.support.id');
    if (supportId) {
      client.updateSupportId(supportId);
    }
    const allAccountsJSON = [];
    for (const acct of AccountStore.accounts()) {
      const fullAccountJSON = (await KeyManager.insertAccountSecrets(acct)).toJSON();
      allAccountsJSON.push(fullAccountJSON);
    }
    client.accounts = allAccountsJSON;
    client.sift();
    client.on('deltas', this._onIncomingMessages);
    client.on('close', ({ code, error, signal }) => {
      if (this._sift !== client) {
        return;
      }
      this._sift = null;
      if (signal === 'SIGTERM') {
        return;
      }
      this._launchSift({ force: true, reason: 'sift died' });
    });
  }

  async _launchClient(account, { force } = {}) {
    if (this._tmpNoRelaunch && account && this._tmpNoRelaunch[account.id]) {
      delete this._tmpNoRelaunch[account.id];
      AppEnv.logWarning(
        `No launch client because of one time launch deny on account: ${account.id}`
      );
      return;
    }
    const client = new MailsyncProcess(this._getClientConfiguration());
    const supportId = AppEnv.config.get('core.support.id');
    if (supportId) {
      client.updateSupportId(supportId);
    }
    this._clients[account.id] = client; // set this synchornously so we never spawn two
    this._clientsStartTime[account.id] = Date.now();
    delete this._setObservableRangeTimer[account.id];
    delete this._cachedObservableThreadIds[account.id];
    delete this._cachedObservableMessageIds[account.id];
    delete this._cachedObservableFolderIds[account.id];
    delete this._cachedFetchAttachments[account.id];
    delete this._cachedFetchBodies[account.id];
    delete this._folderListCache[account.id];
    const fullAccountJSON = (await KeyManager.insertAccountSecrets(account)).toJSON();

    if (force) {
      this._crashTracker.forgetCrashes(fullAccountJSON);
    } else if (this._crashTracker.tooManyFailures(fullAccountJSON)) {
      delete this._clients[account.id];
      delete this._clientsStartTime[account.id];
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
      delete this._clientsStartTime[account.id];
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
        'You must queue a `Task` instance which is registred with the DatabaseObjectRegistry'
      );
    }
    if (!task.id) {
      try {
        AppEnv.reportError(new Error(`Task ${task.constructor.name} have no id`), {
          errorData: {
            task: task.toJSON(),
            account: JSON.stringify(AccountStore.accountsForErrorLog()),
          },
        });
      } catch (e) {
        console.log(e);
      }
      throw new Error(
        'Tasks must have an ID prior to being queued. Check that your Task constructor is calling `super`'
      );
    }
    if (!task.accountId && task.mailsyncMode !== mailSyncModes.SIFT) {
      try {
        AppEnv.reportError(
          new Error(`Task ${task.constructor.name} have no accountId`),
          {
            errorData: {
              task: task.toJSON(),
              account: JSON.stringify(AccountStore.accountsForErrorLog()),
            },
          },
          { grabLogs: true }
        );
      } catch (e) {
        console.log(e);
      }
      throw new Error(
        `Tasks must have an accountId. Check your instance of ${task.constructor.name}.`
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
        ipcRenderer.sendSync(`mainProcess-sync-call`, task.needToBroadcastBeforeSendTask);
      }
    }
    // if (
    //   task instanceof SyncbackDraftTask ||
    //   task instanceof DestroyDraftTask ||
    //   task instanceof RestoreDraftTask
    // ) {
    //   AppEnv.logDebug(`delaying syncback/destroy draft tasks`);
    //   setTimeout(() => {
    //     task.willBeQueued();
    //
    //     task.status = Task.Status.Local;
    //     task.origin = new Error().stack
    //       .split('\n')
    //       .slice(2)
    //       .join('\n');
    //     this.sendMessageToAccount(
    //       task.accountId,
    //       { type: 'queue-task', task: task },
    //       task.mailsyncMode
    //     );
    //   }, 5000);
    //   return;
    // }

    task.willBeQueued();

    task.status = Task.Status.Local;
    task.origin = new Error().stack
      .split('\n')
      .slice(2)
      .join('\n');

    AppEnv.trackingTask(task);
    this.sendMessageToAccount(
      task.accountId,
      { type: 'queue-task', task: task },
      task.mailsyncMode
    );
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
      this.sendMessageToAccount(
        task.accountId,
        { type: 'cancel-task', taskId: task.id },
        task.mailsyncMode
      );
    }
  }

  _onIncomingMessages = (msgs, accountId) => {
    for (const msg of msgs) {
      if (msg.length === 0) {
        AppEnv.logWarning(`Sync worker sent message with length as 0: ${msg}`);
        continue;
      }
      if (msg[0] !== '{') {
        AppEnv.logWarning(`Sync worker sent non-JSON formatted message: ${msg}`);
        continue;
      }

      let json = null;
      try {
        json = JSON.parse(msg);
      } catch (err) {
        AppEnv.logWarning(`Sync worker sent non-JSON formatted message: ${msg}. ${err}`);
        continue;
      }

      let { type, modelJSONs, modelClass } = json;
      if (!modelJSONs || !type || !modelClass) {
        AppEnv.logWarning(`Sync worker sent a JSON formatted message with unexpected keys: ${msg}`);
        continue;
      }

      // if ErrorAuthentication
      modelJSONs = modelJSONs.filter(data => {
        if (data.key && data.key === 'ErrorAuthentication') {
          Actions.updateAccount(data.aid, {
            syncState: Account.SYNC_STATE_AUTH_FAILED,
            syncError: null,
          });
          console.error('ErrorAuthentication', data);
          return false;
        }
        return true;
      });
      if (AppEnv.enabledFromNativeLog) {
        console.log('----------------From native-------------------');
        AppEnv.logDebug(`from-native: ${msg}`);
        console.log('---------------------From native END------------------------');
      }

      // Under message view, thread has no native notification,
      // when receive a message model notification, a corresponding thread notification should be generated
      if (AppEnv.isDisableThreading() && modelClass === 'Message') {
        const threadMsgTmp = {
          modelClass: 'Thread',
          modelJSONs: modelJSONs.map(json => ({ ...json, __cls: 'Thread' })),
          type,
        };
        this._onIncomingMessages([JSON.stringify(threadMsgTmp)]);
      }

      const promises = [];
      const tmpModels = modelJSONs.map(Utils.convertToModel);
      let passAsIs = false;
      if (tmpModels.length > 0) {
        if (tmpModels[0].constructor.passAsIs) {
          passAsIs = true;
        }
      }
      if (passAsIs || type === 'unpersist') {
        // console.log('passing data from native to UI without going through db');
        ipcRenderer.send('mailsync-bridge-rebroadcast-to-all', {
          type,
          modelClass,
          modelJSONs: tmpModels.map(m => m.toJSON()),
          processAccountId: accountId,
        });
        this._onIncomingChangeRecord(
          new DatabaseChangeRecord({
            type, // TODO BG move to "model" naming style, finding all uses might be tricky
            objectClass: modelClass,
            objects: tmpModels,
            processAccountId: accountId,
          })
        );
        continue;
      }
      let threadIndex = -1;
      if (tmpModels.length < 1) {
        return;
      }
      const klass = tmpModels[0].constructor;
      const where = {};
      const construct = tmpModels[0].constructor;
      const primaryKey = tmpModels[0].constructor.pseudoPrimaryJsKey;
      const mergeFields = {};
      tmpModels.forEach(m => {
        if (m.constructor.name !== modelClass) {
          return;
        }
        if (Array.isArray(m.constructor.mergeFields) && m.constructor.mergeFields.length > 0) {
          if (!Array.isArray(mergeFields[m.constructor.name])) {
            mergeFields[m.constructor.name] = [];
          }
          const fields = {};
          m.constructor.mergeFields.forEach(key => {
            fields[key] = m[key];
          });
          fields[primaryKey] = m[primaryKey];
          mergeFields[m.constructor.name].push(fields);
        }
        if (!where[primaryKey]) {
          where[primaryKey] = [];
        }
        where[primaryKey].push(m[primaryKey]);
      });
      if (where[primaryKey]) {
        let tmp = DatabaseStore.findAll(klass, where);
        if (construct.name === 'Message') {
          tmp.linkDB(Message.attributes.body);
        } else if (construct.name === 'Thread') {
          FocusedPerspectiveStore =
            FocusedPerspectiveStore || require('./stores/focused-perspective-store').default;
          const perspective = FocusedPerspectiveStore.current();
          if (perspective) {
            const categoryIds = Array.isArray(perspective.categories())
              ? perspective.categories().map(cat => cat.id)
              : [];
            if (Array.isArray(categoryIds) && categoryIds.length > 0) {
              // console.log(`adding category constrain, ${categoryIds}`);
              Thread = Thread || require('./models/thread').default;
              const threadPromise = DatabaseStore.findAll(Thread, where).where(
                new Matcher.JoinAnd([Thread.attributes.categories.containsAny(categoryIds)])
              );
              promises.push(threadPromise);
              threadIndex = promises.length - 1;
            } else {
              console.log(`Cannot get category Ids, using data purely from thread`);
            }
          } else {
            console.log(`No current perspective, using data purely from thread`);
          }
        }
        promises.push(tmp);
      } else {
        console.error(
          `Primary key ${construct.pseudoPrimaryJsKey} have no value for class ${construct.name}`
        );
      }
      const parsedModels = [];
      const parseQueryPromises = (models, index) => {
        models.forEach(model => {
          if (!model) {
            return;
          }
          const pseudoPrimaryKey = model.constructor.pseudoPrimaryJsKey || 'id';
          let duplicate = false;
          for (let m of parsedModels) {
            if (!m) {
              AppEnv.reportError(
                new Error(`There is an null in the parsed change record models send to UI`)
              );
              continue;
            }
            if (m[pseudoPrimaryKey] === model[pseudoPrimaryKey]) {
              duplicate = true;
              let correctLastMessageTimestamp;
              let inboxCategory;
              if (index === threadIndex) {
                correctLastMessageTimestamp = model.lastMessageTimestamp;
                inboxCategory = model.inboxCategory;
              } else {
                correctLastMessageTimestamp = m.lastMessageTimestamp;
                inboxCategory = m.inboxCategory;
              }
              Object.assign(m, model);
              m.lastMessageTimestamp = correctLastMessageTimestamp;
              m.inboxCategory = inboxCategory;
              break;
            }
          }
          if (!duplicate) {
            if (
              Array.isArray(mergeFields[model.constructor.name]) &&
              mergeFields[model.constructor.name].length > 0
            ) {
              for (let i = 0; i < mergeFields[model.constructor.name].length; i++) {
                const mergeModel = mergeFields[model.constructor.name][i];
                if (model[pseudoPrimaryKey] === mergeModel[pseudoPrimaryKey]) {
                  console.log('new Folder: found model to merge', mergeModel);
                  Object.assign(model, mergeModel);
                  break;
                }
              }
            }
            parsedModels.push(model);
          }
        });
      };
      if (promises.length > 0) {
        Promise.all(promises).then(queries => {
          if (promises.length > 1) {
            queries.forEach((models, index) => {
              parseQueryPromises(models, index);
            });
          } else {
            parseQueryPromises(queries[0], 0);
          }
          if (parsedModels.length === 0) {
            return;
          }
          // dispatch the message to other windows
          ipcRenderer.send('mailsync-bridge-rebroadcast-to-all', {
            type,
            modelClass,
            modelJSONs: parsedModels.map(m => m.toJSON()),
            processAccountId: accountId,
          });
          this._onIncomingChangeRecord(
            new DatabaseChangeRecord({
              type,
              objectClass: modelClass,
              objects: parsedModels,
              processAccountId: accountId,
            })
          );
        });
      }
    }
  };

  _recordErrorToConsole = task => {
    const warningKeys = ['ErrorConnection', 'ErrorAuthentication'];
    let errorAccount = {};
    if (task && task.accountId) {
      const accounts = AppEnv.config.get('accounts');
      if (Array.isArray(accounts)) {
        for (let acc of accounts) {
          const accountId = acc.id || acc.pid;
          if (accountId && (accountId === task.aid || accountId === task.accountId)) {
            errorAccount = AppEnv.anonymizeAccount(acc);
            break;
          }
        }
      }
    }
    if (task) {
      if (task.error && task.error.retryable) {
        AppEnv.reportWarning(
          new Error(
            `TaskError: account-> ${JSON.stringify(errorAccount)} task-> ${JSON.stringify(task)}`
          )
        );
      } else if (task.error && task.error.key && warningKeys.includes(task.error.key)) {
        AppEnv.reportWarning(
          new Error(
            `TaskError: account-> ${JSON.stringify(errorAccount)} task-> ${JSON.stringify(task)}`
          )
        );
      } else {
        AppEnv.reportError(
          new Error(
            `TaskError: account-> ${JSON.stringify(errorAccount)} task-> ${JSON.stringify(task)}`
          )
        );
      }
    }
  };
  _uploadNativeReport = nativeReportTask => {
    if (nativeReportTask instanceof NativeReportTask) {
      if (nativeReportTask.level === NativeReportTask.errorLevel.info) {
        AppEnv.reportLog(
          nativeReportTask.key,
          { errorData: nativeReportTask },
          { noAppConfig: true, noStackTrace: true, expandLog: false }
        );
      } else if (nativeReportTask.level === NativeReportTask.errorLevel.warning) {
        AppEnv.reportWarning(
          nativeReportTask.key,
          { errorData: nativeReportTask },
          { noAppConfig: true, noStackTrace: true, expandLog: false }
        );
      } else {
        AppEnv.reportError(
          nativeReportTask.key,
          { errorData: nativeReportTask },
          { noAppConfig: true, noStackTrace: true, expandLog: false }
        );
      }
    }
  };

  _onIncomingChangeRecord = record => {
    if (AppEnv.enabledChangeRecordLog) {
      console.log('------DatabaseChangeRecord-----');
      AppEnv.logDebug(`databaseChangeRecord: ${JSON.stringify(record)}`);
      console.log('------DatabaseChangeRecord end-----');
    }
    DatabaseStore.trigger(record);

    // Run task success / error handlers if the task is now complete
    // Note: cannot use `record.objectClass` because of subclass names
    if (record.type === 'persist' && record.objects[0] instanceof Task) {
      for (const task of record.objects) {
        if (task && task instanceof NativeReportTask) {
          this._uploadNativeReport(task);
          continue;
        }
        if (task.status !== Task.Status.Complete && task.status !== Task.Status.Cancelled) {
          continue;
        }
        if (task.status === Task.Status.Cancelled) {
          task.onCancelled();
        } else if (task.error != null) {
          task.onError(task.error);
          this._recordErrorToConsole(task);
        } else {
          task.onSuccess();
        }
      }
    }
  };

  _onIncomingRebroadcastMessage = (event, data) => {
    const { type, modelJSONs, modelClass, processAccountId } = data;
    console.log(`type: ${type}, modelClass: ${modelClass}`, modelJSONs);
    const models = modelJSONs.map(Utils.convertToModel);
    DatabaseStore.trigger(
      new DatabaseChangeRecord({
        type,
        objectClass: modelClass,
        objects: models,
        processAccountId,
      })
    );
  };

  _getFocusedThreadId = accountId => {
    const currentThread = FocusedContentStore().focused('thread');
    if (currentThread && currentThread.accountId === accountId) {
      return currentThread.id;
    }
    return null;
  };
  _getOpenThreadWindowIds = accountId => {
    const threadIds = [];
    const openWindows = AppEnv.getOpenWindowsByAccountId(accountId);
    if (Array.isArray(openWindows)) {
      openWindows.forEach(win => {
        if (win && win.windowKey && win.windowKey.includes('thread-')) {
          threadIds.push(win.windowKey.slice('thread-'.length));
        }
      });
    }
    return threadIds;
  };
  _updateObservableCache({ accountId = null, missingIds = [], priority = 0 } = {}, dataCache, ttl) {
    if (!accountId) {
      return [];
    }
    const now = Date.now();
    const clientStartTime = this._clientsStartTime[accountId] || now - 1;
    if (!dataCache[accountId]) {
      dataCache[accountId] = [];
    }
    const missingIdsMap = {};
    missingIds.forEach(id => {
      missingIdsMap[id] = true;
    });
    const uniqMissingIds = Object.keys(missingIdsMap);
    if (dataCache[accountId].length === 0) {
      for (const id of uniqMissingIds) {
        dataCache[accountId].push({ id: id, lastSend: now, priority });
      }
      return missingIds;
    } else {
      const missing = [];
      const newCache = [];
      for (let cache of dataCache[accountId]) {
        let cacheUpdated = false;
        for (const id of uniqMissingIds) {
          if (id === cache.id) {
            if (now - cache.lastSend > ttl || cache.lastSend < clientStartTime) {
              cache.lastSend = now;
              cache.priority = priority;
              missing.push(cache.id);
            } else if (priority > cache.priority || priority === 0) {
              cache.lastSend = now;
              cache.priority = priority;
              missing.push(cache.id);
            }
            newCache.push(cache);
            cacheUpdated = true;
            delete missingIdsMap[cache.id];
            break;
          }
        }
        if (now - cache.lastSend <= ttl && cache.lastSend > clientStartTime && !cacheUpdated) {
          newCache.push(cache);
        }
      }
      for (const id of Object.keys(missingIdsMap)) {
        newCache.push({ id, lastSend: now, priority });
        missing.push(id);
      }
      dataCache[accountId] = newCache;
      return missing;
    }
  }

  _fetchCacheFilter({ accountId = null, missingIds = [], priority = 0 } = {}, dataCache, ttl) {
    if (!accountId) {
      return [];
    }
    const now = Date.now();
    const clientStartTime = this._clientsStartTime[accountId] || now - 1;
    if (!dataCache[accountId]) {
      dataCache[accountId] = [];
    }
    if (dataCache[accountId].length === 0) {
      for (const id of missingIds) {
        dataCache[accountId].push({ id: id, lastSend: now, priority });
      }
      return missingIds;
    } else {
      const missingIdsMap = missingIds.map(id => {
        return { id: id, isNew: true };
      });
      const missing = [];
      const newCache = [];
      for (let cache of dataCache[accountId]) {
        let cacheUpdated = false;
        for (let i = 0; i < missingIdsMap.length; i++) {
          if (missingIdsMap[i].id === cache.id) {
            if (cache.lastSend < clientStartTime || now - cache.lastSend >= ttl) {
              cache.lastSend = now;
              cache.priority = priority;
            } else if (priority > cache.priority || priority === 0) {
              cache.lastSend = now;
              cache.priority = priority;
            } else {
              missingIdsMap[i].isNew = false;
            }
            newCache.push(cache);
            cacheUpdated = true;
            break;
          }
        }
        if (now - cache.lastSend < ttl && !cacheUpdated) {
          newCache.push(cache);
        }
      }
      for (const idMap of missingIdsMap) {
        if (idMap.isNew) {
          newCache.push({ id: idMap.id, lastSend: now, priority });
          missing.push(idMap.id);
        }
      }
      dataCache[accountId] = newCache;
      return missing;
    }
  }

  _onFetchAttachments({ accountId, missingItems, needProgress, source }) {
    if (Array.isArray(missingItems) && missingItems.length > 0) {
      this.sendMessageToAccount(accountId, {
        type: 'need-attachments',
        ids: missingItems,
        needProgress,
        source,
      });
    }
  }

  _fetchAttachmentCacheFilter({ accountId = null, missingItems = [] } = {}) {
    return this._fetchCacheFilter(
      { accountId, missingIds: missingItems },
      this._cachedFetchAttachments,
      this._fetchAttachmentCacheTTL
    );
  }

  _onFetchBodies({ messages = [], source = 'message' } = {}) {
    const messagesByAccountId = this._sortMessagesByAccount({ messages });
    let priority = 0;
    if (source === 'draft') {
      priority = 2;
    } else if (source === 'message') {
      priority = 1;
    }
    for (const accountId of Object.keys(messagesByAccountId)) {
      const ids = this._fetchBodiesCacheFilter({
        accountId,
        messages: messagesByAccountId[accountId],
        priority,
      });
      if (ids.length > 0) {
        this.sendMessageToAccount(accountId, {
          type: 'need-bodies',
          ids: ids,
          source,
        });
      }
    }
  }

  _onMailsyncConfigUpdate = (event, mailsyncConfig = null) => {
    if (!mailsyncConfig) {
      const defaultSettings = AppEnv.config.get('core.mailsync');
      const accounts = AppEnv.config.get('accounts');
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return;
      }
      delete defaultSettings.accounts;
      mailsyncConfig = {};
      for (let account of accounts) {
        if (account.mailsync) {
          delete account.mailsync.taskDelay;
          mailsyncConfig[account.pid || account.id] = Object.assign(
            {},
            defaultSettings,
            account.mailsync
          );
        } else {
          mailsyncConfig[account.pid || account.id] = Object.assign({}, defaultSettings);
        }
      }
    }
    for (const accountId of Object.keys(this._clients)) {
      if (mailsyncConfig[accountId]) {
        this.sendMessageToAccount(accountId, {
          type: 'config-change',
          settings: mailsyncConfig[accountId],
        });
      }
    }
  };

  _onClientConfigUpdate = (event, clientConfig) => {
    if (!clientConfig) {
      return;
    }

    for (const accountId of Object.keys(this._clients)) {
      this.sendMessageToAccount(accountId, {
        type: 'config-change',
        settings: clientConfig,
      });
    }
  };
  _refreshStartOfDay = (event, { startOfDay = 0 } = {}) => {
    if (startOfDay === 0) {
      const now = new Date();
      const tmp = new Date(now.toDateString());
      startOfDay = tmp.now();
    }
    for (const accountId of Object.keys(this._clients)) {
      this.sendMessageToAccount(accountId, {
        type: 'refresh-startOfDay',
        startOfDay: startOfDay,
      });
    }
  };

  _sortMessagesByAccount({ messages = [] } = {}) {
    const byAccount = {};
    for (const msg of messages) {
      if (!byAccount[msg.accountId]) {
        byAccount[msg.accountId] = [];
      }
      byAccount[msg.accountId].push(msg);
    }
    return byAccount;
  }

  _fetchBodiesCacheFilter({ accountId, messages = [], priority = 0 } = {}) {
    return this._fetchCacheFilter(
      {
        accountId,
        missingIds: messages.map(m => m.id),
        priority,
      },
      this._cachedFetchBodies,
      this._fetchBodiesCacheTTL
    );
  }

  _onNewWindowOpened = (event, options) => {
    if (options.threadId && options.accountId && this._clients[options.accountId]) {
      const prevThreadIds = (this._cachedObservableThreadIds[options.accountId] || []).map(
        cache => cache.id
      );
      this._onSetObservableRange(options.accountId, {
        missingThreadIds: [options.threadId, ...prevThreadIds],
        missingMessageIds: [],
      });
    }
  };
  _sentObservableRangeTask = (accountId, missingThreadIds, missingMessageIds, priority = 0) => {
    const newThreadIds = this._updateObservableCache(
      { accountId, missingIds: missingThreadIds, priority },
      this._cachedObservableThreadIds,
      this._cachedObservableTTL
    );
    const newMessageIds = this._updateObservableCache(
      { accountId, missingIds: missingMessageIds, priority },
      this._cachedObservableMessageIds,
      this._cachedObservableTTL
    );
    const folderIds = [];
    FocusedPerspectiveStore =
      FocusedPerspectiveStore || require('./stores/focused-perspective-store').default;
    const currentPerspective = FocusedPerspectiveStore.current();
    if (currentPerspective) {
      const categories = currentPerspective.categories();
      if (Array.isArray(categories)) {
        categories.forEach(category => {
          if (category && category.accountId === accountId && category.id) {
            folderIds.push(category.id);
          }
        });
      }
    }
    const folderIdsChanged = !_.isEqual(
      folderIds,
      this._cachedObservableFolderIds[accountId] || []
    );
    if (folderIdsChanged) {
      this._cachedObservableFolderIds[accountId] = folderIds;
    } else if (newThreadIds.length === 0 && newMessageIds.length === 0) {
      console.log('no new ids, skipping this round');
      return;
    }
    const threadIds = (this._cachedObservableThreadIds[accountId] || []).map(cache => cache.id);
    const currentThreadId = this._getFocusedThreadId(accountId);
    if (currentThreadId) {
      threadIds.push(currentThreadId);
    }
    const openThreadWindowIds = this._getOpenThreadWindowIds(accountId);
    if (Array.isArray(openThreadWindowIds)) {
      threadIds.push(...openThreadWindowIds);
    }
    const messageIds = (this._cachedObservableMessageIds[accountId] || []).map(cache => cache.id);
    if (threadIds.length === 0 && messageIds.length === 0) {
      return;
    }
    const tmpTask = new SetObservableRange({ accountId, threadIds, messageIds, folderIds });
    this.sendMessageToAccount(accountId, tmpTask.toJSON());
  };

  _setObservableRangeTaskTimer = (
    accountId = '',
    missingThreadIds = [],
    missingMessageIds = [],
    priority = 0
  ) => {
    this._setObservableRangeTimer[accountId] = {
      id: setTimeout(() => {
        this._sentObservableRangeTask(accountId, missingThreadIds, missingMessageIds, priority);
      }, 1000),
      timestamp: Date.now(),
    };
  };

  _onSetObservableRange = (
    accountId,
    { missingThreadIds = [], missingMessageIds = [], windowLevel } = {}
  ) => {
    if (!this._clients[accountId]) {
      //account doesn't exist, we clear observable cache
      delete this._setObservableRangeTimer[accountId];
      delete this._cachedObservableThreadIds[accountId];
      delete this._cachedObservableMessageIds[accountId];
      delete this._cachedObservableFolderIds[accountId];
      return;
    }
    if (this._setObservableRangeTimer[accountId]) {
      if (Date.now() - this._setObservableRangeTimer[accountId].timestamp > 1000) {
        this._sentObservableRangeTask(accountId, missingThreadIds, missingMessageIds, windowLevel);
      } else {
        clearTimeout(this._setObservableRangeTimer[accountId].id);
        this._setObservableRangeTaskTimer(
          accountId,
          missingThreadIds,
          missingMessageIds,
          windowLevel
        );
      }
    } else {
      this._setObservableRangeTaskTimer(
        accountId,
        missingThreadIds,
        missingMessageIds,
        windowLevel
      );
    }
  };

  _onSyncFolders({ accountId, foldersIds, source = 'folderItem' } = {}) {
    if (Array.isArray(foldersIds) && accountId) {
      this.sendMessageToAccount(accountId, {
        type: 'sync-folders',
        aid: accountId,
        ids: foldersIds,
        source,
      });
    }
  }
  _onFetchNativeRuntimeInfo({ accountId } = {}) {
    this.sendMessageToAccount(accountId, {
      type: 'runtime-info',
      aid: accountId,
    });
  }
  _onSyncFolderList({ accountIds, source = 'syncFolderList' } = {}) {
    if (!Array.isArray(accountIds)) {
      console.error('no account');
      return;
    }
    if (accountIds.length === 0) {
      console.error('account array is empty');
      return;
    }
    const now = Date.now();
    accountIds.forEach(accountId => {
      const interval = now - (this._folderListCache[accountId] || 1);
      if (interval >= this._folderListTTL) {
        this.sendMessageToAccount(accountId, {
          type: 'sync-folderList',
          aid: accountId,
          source,
        });
        this._folderListCache[accountId] = now;
      }
    });
  }

  _onSyncSiftFolder({
    categories = [
      Sift.categories.Entertainment,
      Sift.categories.Packages,
      Sift.categories.Travel,
      Sift.categories.Bill,
    ],
    source = '',
  } = {}) {
    if (Array.isArray(categories)) {
      this.sendMessageToAccount(
        null,
        {
          type: 'sync-sifts',
          categories,
        },
        mailSyncModes.SIFT
      );
    }
  }

  _onRemoteSearch = _.debounce(tasks => {
    if (tasks.length > 0) {
      this._onQueueTasks(tasks);
    }
  }, 1500);

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
    let killScript = '';
    const processName = AppEnv.inDevMode() ? 'Electron' : 'Edison Mail';
    const mainProcessPid = process.pid;
    for (const client of Object.values(this._clients)) {
      let id = '';
      if (client._proc && client._proc.pid) {
        id = client._proc.pid;
      }
      client.kill();
      killScript = client.killNativeScript;
      AppEnv.debugLog(`pid@${id} mailsync-bridge _onReadyToUnload: page refresh`);
    }
    this._clients = {};
    this.killSift('onBeforeUnload');
    AppEnv.debugLog(
      `Main process terminating pid@${mainProcessPid}, starting kill script ${killScript}`
    );
    if (killScript) {
      spawn(killScript, [mainProcessPid, processName], { detached: true, stdio: 'ignore' });
    }
  };

  _onOnlineStatusChanged = ({ onlineDidChange, wakingFromSleep }) => {
    if (wakingFromSleep || (onlineDidChange && OnlineStatusStore.isOnline())) {
      this.sendSyncMailNow();
    }
  };
}
