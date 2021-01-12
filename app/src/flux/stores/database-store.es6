/* eslint global-require: 0 */
import path from 'path';
import fs from 'fs';
import createDebug from 'debug';
import childProcess from 'child_process';
import LRU from 'lru-cache';
import Sqlite3 from 'better-sqlite3';
import { remote } from 'electron';
import { ExponentialBackoffScheduler } from '../../backoff-schedulers';
// import Actions from '../actions';
import MailspringStore from '../../global/mailspring-store';
import Utils from '../models/utils';
import Query from '../models/query';
// import AppMessage from '../models/app-message';
import DatabaseChangeRecord from './database-change-record';
import { QUERY_TYPE } from '../../constant';

const debug = createDebug('app:RxDB');
const debugVerbose = createDebug('app:RxDB:all');

const DEBUG_QUERY_PLANS = AppEnv.inDevMode();

const BASE_RETRY_LOCK_DELAY = 50;
const MAX_RETRY_LOCK_DELAY = 500;
const SLOW_QUERY_THRESH_HOLD = 1500;
const SLOW_QUERY_PROMPT_THRESH_HOLD = 3000;
const SLOW_QUERY_PROMPT_MAX_INTERVAL = 2000;
const NUM_SLOW_QUERY_THRESH_HOLD = 10;
const promptSlowQuery = slowQueryCache => {
  const now = Date.now();
  if (slowQueryCache.length > 0) {
    if (now - slowQueryCache[slowQueryCache.length - 1] > SLOW_QUERY_PROMPT_MAX_INTERVAL) {
      slowQueryCache.length = 0;
      return;
    }
    if (slowQueryCache.length + 1 > NUM_SLOW_QUERY_THRESH_HOLD) {
      // const message = new AppMessage({
      //   allowClose: true,
      //   level: 0,
      //   id: 'database-slow-query',
      //   accountIds: [],
      //   description: 'Edison Mail need to do some housekeeping in order to improve performance.',
      //   actions: [{ text: 'Proceed', onClick: () => Actions.askVacuum() }],
      // });
      // Actions.pushAppMessage(message);
      slowQueryCache.length = 0;
      return;
    }
  }
  slowQueryCache.push(now);
};
export const AuxDBs = {
  MessageBody: 'embody.db',
};

function trimTo(str, size) {
  const g = window || global || {};
  const TRIM_SIZE = size || process.env.TRIM_SIZE || g.TRIM_SIZE || 256;
  let trimed = str;
  if (str.length >= TRIM_SIZE) {
    trimed = `${str.slice(0, TRIM_SIZE / 2)}…${str.slice(str.length - TRIM_SIZE / 2, str.length)}`;
  }
  return trimed;
}

function handleUnrecoverableDatabaseError(
  err = new Error(`Manually called handleUnrecoverableDatabaseError`)
) {
  AppEnv.errorLogger.reportError(err);
  const app = remote.getGlobal('application');
  if (!app) {
    throw new Error('handleUnrecoverableDatabaseError: `app` is not ready!');
  }
  const ipc = require('electron').ipcRenderer;
  ipc.send('command', 'application:reset-database', {
    errorMessage: err.toString(),
    source: 'handleUnrecoverableDatabaseError',
  });
}

async function openDatabase(dbPath, retryCnt = 0, options = { readonly: true }) {
  try {
    const database = await new Promise((resolve, reject) => {
      const db = new Sqlite3(dbPath, options);
      // db.on('close', reject);
      // db.on('open', () => {
      // https://www.sqlite.org/wal.html
      // WAL provides more concurrency as readers do not block writers and a writer
      // does not block readers. Reading and writing can proceed concurrently.
      db.pragma(`journal_mode = WAL`);

      // Note: These are properties of the connection, so they must be set regardless
      // of whether the database setup queries are run.

      // https://www.sqlite.org/intern-v-extern-blob.html
      // A database page size of 8192 or 16384 gives the best performance for large BLOB I/O.
      db.pragma(`main.page_size = 4096`);
      db.pragma(`main.cache_size = 10000`);
      db.pragma(`main.synchronous = FULL`);

      db.pragma(`busy_timeout = 30000`);
      db.pragma(`locking_mode = NORMAL`);

      resolve(db);
      // });
    });
    return database;
  } catch (err) {
    const errString = err.toString();
    if (/database disk image is malformed/gi.test(errString)) {
      handleUnrecoverableDatabaseError(err);
      return null;
    }
    if (retryCnt > 10) {
      const ipc = require('electron').ipcRenderer;
      ipc.send('command', 'application:window-relaunch');
      return null;
    }
    return await new Promise((resolve, reject) => {
      setTimeout(() => {
        openDatabase(dbPath, retryCnt + 1).then(db => resolve(db));
      }, 1000);
    });
  }
}
const openAuxiliaryDBs = async cache => {
  console.log('opening aux db connections');
  const configPath = AppEnv.getConfigDirPath();
  const promises = [];
  for (let name of Object.keys(AuxDBs)) {
    if (name) {
      promises.push(
        new Promise(resolve => {
          openDatabase(auxiliaryDBPath(configPath, AuxDBs[name])).then(connection => {
            resolve({ name: AuxDBs[name], connection });
          });
        })
      );
    }
  }
  return new Promise(resolve => {
    Promise.all(promises).then(ret => {
      for (let value of ret) {
        cache[value.name] = value.connection;
      }
      console.log(`opened all aux db connections`);
      resolve();
    });
  });
};

function databasePath(configDirPath, specMode = false) {
  let dbPath = path.join(configDirPath, 'edisonmail.db');
  if (specMode) {
    dbPath = path.join(configDirPath, 'edisonmail.test.db');
  }
  return dbPath;
}

function auxiliaryDBPath(configDirPath, auxDBName) {
  return path.join(configDirPath, auxDBName);
}

/*
Public: Mailspring is built on top of a custom database layer modeled after
ActiveRecord. For many parts of the application, the database is the source
of truth. Data is retrieved from the API, written to the database, and changes
to the database trigger Stores and components to refresh their contents.

The DatabaseStore is available in every application window and allows you to
make queries against the local cache. Every change to the local cache is
broadcast as a change event, and listening to the DatabaseStore keeps the
rest of the application in sync.

#// Listening for Changes

To listen for changes to the local cache, subscribe to the DatabaseStore and
inspect the changes that are sent to your listener method.

```javascript
this.unsubscribe = DatabaseStore.listen(this._onDataChanged, this)

...

_onDataChanged(change) {
  if (change.objectClass !== Message) {
    return;
  }
  if (!change.objects.find((m) => m.id === this._myMessageID)) {
    return;
  }

  // Refresh Data
}
```

The local cache changes very frequently, and your stores and components should
carefully choose when to refresh their data. The \`change\` object passed to your
event handler allows you to decide whether to refresh your data and exposes
the following keys:

\`objectClass\`: The {Model} class that has been changed. If multiple types of models
were saved to the database, you will receive multiple change events.

\`objects\`: An {Array} of {Model} instances that were either created, updated or
deleted from the local cache. If your component or store presents a single object
or a small collection of objects, you should look to see if any of the objects
are in your displayed set before refreshing.

Section: Database
*/
class DatabaseStore extends MailspringStore {
  static ChangeRecord = DatabaseChangeRecord;

  constructor() {
    super();

    this._open = false;
    this._waiting = [];
    this._preparedStatementCache = LRU({ max: 500 });
    this._slowQueryCache = [];
    this._agent = {};

    this.setupEmitter();
    this._emitter.setMaxListeners(100);

    this._databasePath = databasePath(AppEnv.getConfigDirPath(), AppEnv.inSpecMode());
    console.log('this._databasePath', this._databasePath);

    if (!AppEnv.inSpecMode() && !AppEnv.isMigrateWindow()) {
      this.open();
    }
  }

  async open() {
    this._db = { main: await openDatabase(this._databasePath) };
    await openAuxiliaryDBs(this._db);
    console.log(`\n---\ndb connections open ${Object.keys(this._db).join(',')}\n--\n`);
    this._open = true;
    for (const w of this._waiting) {
      w();
    }
    this._waiting = [];
    this._emitter.emit('ready');
  }
  close(source = '') {
    AppEnv.logDebug(`Closing db connections because ${source}`);
    Object.values(this._db).forEach(db => {
      try {
        db.close();
      } catch (err) {
        AppEnv.logError(`Closing db connections because ${source} failed: ${err}`);
      }
    });
    this._open = false;
    this._waiting = [];
    this._preparedStatementCache.reset();
    this._slowQueryCache = [];
    AppEnv.logDebug(`Connections closed`);
  }

  _prettyConsoleLog(qa) {
    AppEnv.reportWarning(new Error(qa), { errorData: { queryTakingTooLong: true } });
    let q = qa.replace(/%/g, '%%');
    q = `color:black |||%c ${q}`;
    q = q.replace(/`(\w+)`/g, '||| color:purple |||%c$&||| color:black |||%c');

    const colorRules = {
      'color:green': [
        'SELECT',
        'INSERT INTO',
        'VALUES',
        'WHERE',
        'FROM',
        'JOIN',
        'ORDER BY',
        'DESC',
        'ASC',
        'INNER',
        'OUTER',
        'LIMIT',
        'OFFSET',
        'IN',
      ],
      'color:red; background-color:#ffdddd;': ['SCAN TABLE'],
    };

    for (const style of Object.keys(colorRules)) {
      for (const keyword of colorRules[style]) {
        q = q.replace(
          new RegExp(`\\b${keyword}\\b`, 'g'),
          `||| ${style} |||%c${keyword}||| color:black |||%c`
        );
      }
    }

    q = q.split('|||');
    const colors = [];
    const msg = [];
    for (let i = 0; i < q.length; i++) {
      if (i % 2 === 0) {
        colors.push(q[i]);
      } else {
        msg.push(q[i]);
      }
    }
    console.log(msg.join(''), ...colors);
  }

  // Returns a Promise that resolves when the query has been completed and
  // rejects when the query has failed.
  //
  // If a query is made before the database has been opened, the query will be
  // held in a queue and run / resolved when the database is ready.
  _query(query, values = [], background = false, dbKey = 'main', queryType) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      if (!this._open) {
        console.log(`db conections not ready ${dbKey}`);
        this._waiting.push(() => this._query(query, values, false, dbKey).then(resolve, reject));
        return;
      }

      // Undefined, True, and False are not valid SQLite datatypes:
      // https://www.sqlite.org/datatype3.html
      values.forEach((val, idx) => {
        if (val === false) {
          values[idx] = 0;
        } else if (val === true) {
          values[idx] = 1;
        } else if (val === undefined) {
          values[idx] = null;
        }
      });

      const start = Date.now();

      // when limit 0, no need to run the query
      if (/LIMIT 0/g.test(query)) {
        return resolve([]);
      }

      if (!background) {
        const results = await this._executeLocally(query, values, dbKey);
        const msec = Date.now() - start;
        if (msec > SLOW_QUERY_THRESH_HOLD) {
          this._prettyConsoleLog(
            `DatabaseStore._executeLocally took more than ${SLOW_QUERY_THRESH_HOLD}ms - ${msec}msec: ${query}`
          );
          if (msec > SLOW_QUERY_PROMPT_THRESH_HOLD) {
            promptSlowQuery(this._slowQueryCache);
          }
        }
        resolve(results);
      } else {
        this._executeInBackground(query, values, dbKey, queryType).then(
          ({ results, backgroundTime }) => {
            const msec = Date.now() - start;
            if (debugVerbose.enabled) {
              const q = `🔶 (${msec}ms) Background: ${query}`;
              debugVerbose(trimTo(q));
            }

            if (msec > SLOW_QUERY_THRESH_HOLD) {
              const msgPrefix = `DatabaseStore._executeInBackground took more than ${SLOW_QUERY_THRESH_HOLD}ms - `;
              this._prettyConsoleLog(
                `${msgPrefix}${msec}msec (${backgroundTime}msec in background): ${query}`
              );
              if (backgroundTime > SLOW_QUERY_PROMPT_THRESH_HOLD) {
                promptSlowQuery(this._slowQueryCache);
              }
            }
            resolve(results);
          }
        );
      }
    });
  }
  sendArbitrarySqlQuery(query, dbKey = 'main') {
    return this._query(query, [], true, dbKey, 'SQL_DEBUG');
  }

  async _executeLocally(query, values, dbKey = 'main') {
    if (AppEnv.enabledLocalQueryLog) {
      console.log(`-------------------local query for ${dbKey}----------------`);
      AppEnv.logDebug(`local db: ${dbKey} query - ${query}`);
      console.log(`--------------------local query for ${dbKey} end---------------`);
    }

    const fn = query.startsWith('SELECT') ? 'all' : 'run';
    let results = null;
    const scheduler = new ExponentialBackoffScheduler({
      baseDelay: BASE_RETRY_LOCK_DELAY,
      maxDelay: MAX_RETRY_LOCK_DELAY,
    });

    const schemaChangedStr = 'database schema has changed';

    const retryableRegexp = new RegExp(`(database is locked)||(${schemaChangedStr})`, 'i');

    // Because other processes may be writing to the database and modifying the
    // schema (running ANALYZE, etc.), we may `prepare` a statement and then be
    // unable to execute it. Handle this case silently unless it's persistent.
    while (!results) {
      try {
        if (scheduler.currentDelay() > 0) {
          // Setting a timeout for 0 will still defer execution of this function
          // to the next tick of the event loop.
          // We don't want to unnecessarily defer and delay every single query,
          // so we only set the timer when we are actually backing off for a
          // retry.
          await Promise.delay(scheduler.currentDelay());
        }

        let stmt = this._preparedStatementCache.get(query);
        if (!stmt) {
          stmt = this._db[dbKey].prepare(query);
          this._preparedStatementCache.set(query, stmt);
        }

        const start = Date.now();
        results = stmt[fn](values);
        const msec = Date.now() - start;
        if (debugVerbose.enabled) {
          const q = `(${msec}ms) ${query}`;
          debugVerbose(trimTo(q));
        }

        if (msec > SLOW_QUERY_THRESH_HOLD) {
          const msgPrefix = `DatabaseStore: query took more than ${SLOW_QUERY_THRESH_HOLD}ms - `;
          if (query.startsWith(`SELECT `) && DEBUG_QUERY_PLANS) {
            const plan = this._db[dbKey].prepare(`EXPLAIN QUERY PLAN ${query}`).all(values);
            const planString = `${plan.map(row => row.detail).join('\n')} for ${query}`;
            const quiet = ['ThreadCounts', 'ThreadSearch', 'ContactSearch', 'COVERING INDEX'];

            if (!quiet.find(str => planString.includes(str))) {
              this._prettyConsoleLog(`${msgPrefix}${msec}msec: ${planString}`);
            }
          } else {
            this._prettyConsoleLog(`${msgPrefix}${msec}msec: ${query}`);
          }
        }
      } catch (err) {
        const errString = err.toString();
        if (/database disk image is malformed/gi.test(errString)) {
          handleUnrecoverableDatabaseError(err);
          return results;
        }

        if (scheduler.numTries() > 5 || !retryableRegexp.test(errString)) {
          throw new Error(
            `DatabaseStore: Query ${query}, ${JSON.stringify(values)} failed ${err.toString()}`
          );
        }

        // Some errors require action before the query can be retried
        if (new RegExp(schemaChangedStr, 'i').test(errString)) {
          this._preparedStatementCache.del(query);
        }
      }
      scheduler.nextDelay();
    }
    return results;
  }
  _sendToAgent = (data, queryType = QUERY_TYPE.BACKGROUND) => {
    if (!this._agent[queryType]) {
      AppEnv.logError(`Agent not available for background db query, ${data.id} not send`);
      return;
    }
    AppEnv.logDebug(`Sending query for ${data.id} to agent`);
    this._agent[queryType].send(data);
  };
  _registerAndStartAgent = (queryForLog, queryType = QUERY_TYPE.BACKGROUND, { onMessage } = {}) => {
    if (!this._agent[queryType]) {
      AppEnv.logDebug(`DBStore:Agent not available, starting agent`);
      this._agentOpenQueries = {};
      this._agentQueues = {};
      this._agent[queryType] = childProcess.fork(
        path.join(path.dirname(__filename), 'database-agent.js'),
        [AppEnv.getConfigDirPath(), queryType],
        {
          silent: true,
        }
      );
      const clearOpenQueries = () => {
        for (const id in this._agentOpenQueries) {
          if (this._agentOpenQueries[id]) {
            this._agentOpenQueries[id]({ results: [] });
          }
        }
        this._agentOpenQueries = {};
        this._agentQueues = {};
      };
      this._agent[queryType].stdout.on('data', data => console.log(data.toString()));
      this._agent[queryType].stderr.on('data', data => {
        AppEnv.reportError(new Error(`database-store._executeInBackground error`), {
          errorData: data.toString(),
          query: queryForLog,
        });
        console.error(data.toString(), queryForLog);
      });
      this._agent[queryType].on('disconnect', () => {
        AppEnv.logError(`database background agent disconnected`);
        debug(`Query Agent: disconnected`);
        if (this._agent[queryType]) {
          this._agent[queryType].kill('SIGTERM');
        }
        this._agent[queryType] = null;
        clearOpenQueries();
      });
      this._agent[queryType].on('exit', code => {
        AppEnv.logDebug(`database background agent exited with code ${code}`);
        debug(`Query Agent: exited with code ${code}`);
        this._agent[queryType] = null;
        clearOpenQueries();
      });
      this._agent[queryType].on('close', code => {
        AppEnv.logDebug(`database background agent closed with code ${code}`);
        debug(`Query Agent: closed with code ${code}`);
        this._agent[queryType] = null;
        clearOpenQueries();
      });
      this._agent[queryType].on('error', err => {
        AppEnv.reportError(
          new Error(`Query Agent: failed to start or receive message: ${err.toString()}`)
        );
        this._agent[queryType].kill('SIGTERM');
        this._agent[queryType] = null;
        clearOpenQueries();
      });
      if (onMessage) {
        this._agent[queryType].on('message', onMessage);
      } else {
        this._agent[queryType].on('message', ({ type, id, results, agentTime, queryType }) => {
          const result = { results, backgroundTime: agentTime };
          if (!queryType && type === 'results' && this._agentOpenQueries[id]) {
            this._agentOpenQueries[id](result);
            delete this._agentOpenQueries[id];
          } else if (type === 'results' && queryType && this._agentQueues[queryType]) {
            const item =
              this._agentQueues[queryType].length > 0 ? this._agentQueues[queryType][0] : null;
            const newItem =
              this._agentQueues[queryType].length > 1 ? this._agentQueues[queryType][1] : null;
            if (item && item.id === id && item.resolve) {
              AppEnv.logDebug(
                `DBStore:Background results for ${id} of type ${queryType} match, resolving`
              );
              item.resolve(result);
            } else {
              AppEnv.logError(
                `DBStore:Background results for ${id} of type ${queryType} not resolve`
              );
            }
            if (newItem && newItem.data) {
              AppEnv.logDebug(
                `DBStore:old item ${id} new item in queue, ${newItem.data.id} query type ${queryType}, sending`
              );
              this._sendToAgent(newItem.data, queryType);
            }
            if (newItem) {
              this._agentQueues[queryType] = [newItem];
            } else {
              this._agentQueues[queryType] = [];
            }
          }
        });
      }
    }
  };

  _executeInBackground(query, values, dbKey = 'main', queryType = null) {
    if (AppEnv.enabledBackgroundQueryLog) {
      console.log(`-------------------background query for ${dbKey}----------------`);
      AppEnv.logDebug(`background query - ${query}`);
      console.log(`--------------------background query for ${dbKey} end---------------`);
    }
    this._registerAndStartAgent(query, queryType);

    return new Promise(resolve => {
      const id = Utils.generateTempId();
      let ignore = false;
      let data;
      if (dbKey === 'main') {
        data = { query, values, id, dbpath: this._databasePath, queryType: queryType };
      } else {
        data = {
          query,
          values,
          id,
          queryType: queryType,
          dbpath: auxiliaryDBPath(AppEnv.getConfigDirPath(), AuxDBs[dbKey]),
        };
      }
      if (!queryType) {
        this._agentOpenQueries[id] = resolve;
      } else {
        if (!this._agentQueues[queryType]) {
          this._agentQueues[queryType] = [];
        }
        if (this._agentQueues[queryType].length > 0) {
          ignore = true;
          this._agentQueues[queryType] = [this._agentQueues[queryType][0], { id, resolve, data }];
        } else {
          this._agentQueues[queryType] = [{ id, resolve, data }];
        }
      }
      if (!ignore) {
        AppEnv.logDebug(`DBStore:No pending request for ${id} of type ${queryType}, sending`);
        this._sendToAgent(data, queryType);
        return;
      }
      AppEnv.logDebug(`DBStore:Request pending,  request for ${id} of type ${queryType} not send`);
    });
  }

  // PUBLIC METHODS #############################

  // ActiveRecord-style Querying

  vaccum() {
    const configPath = AppEnv.getConfigDirPath();
    const dbKeys = [];
    const executeVacuumQuery = (dbKey, index) => {
      const dbPath = path.join(configPath, dbKey);
      AppEnv.logDebug(`Vacuuming ${dbKey} db`);

      return new Promise(resolve => {
        const onMessage = ({ id } = {}) => {
          console.warn(`resolving ${id}`);
          resolve();
        };
        try {
          this._registerAndStartAgent('', `${QUERY_TYPE.VACUUM}${index}`, { onMessage });
          const data = {
            query: 'Vacuum',
            values: [],
            id: `${QUERY_TYPE.VACUUM}${index}`,
            dbpath: dbPath,
            queryType: `${QUERY_TYPE.VACUUM}${index}`,
          };
          this._sendToAgent(data, `${QUERY_TYPE.VACUUM}${index}`);
        } catch (err) {
          AppEnv.logError(`Opening db ${dbKey} for vacuum failed ${err}`);
        }
      });
    };
    return new Promise((resolve, reject) => {
      this.close('Vacuum DB');
      AppEnv.logDebug(`Finding all db files`);
      fs.readdir(configPath, { encoding: 'utf8', withFileTypes: true }, (err, files) => {
        if (err) {
          AppEnv.logError(`Reading config path for Vacuum failed, ${err}`);
          reject(err);
          return;
        }
        files.forEach(dirent => {
          if (dirent.isFile()) {
            if (dirent.name.match(/\S+\.db$/g)) {
              dbKeys.push(dirent.name);
            }
          }
        });
        const total = dbKeys.length;
        let finished = 0;
        dbKeys.forEach((key, index) => {
          executeVacuumQuery(key, index).then(() => {
            finished++;
            if (finished === total) {
              AppEnv.logDebug(`Vacuuming dbs finished, restarting UI db connections`);
              this.open()
                .then(() => {
                  AppEnv.logDebug(`DBs connections restarted, notifying UI`);
                  setTimeout(() => {
                    resolve();
                  }, 2000);
                })
                .catch(err => {
                  AppEnv.logError(err);
                  resolve();
                });
            }
          });
        });
      });
    });
  }
  // Public: Creates a new Model Query for retrieving a single model specified by
  // the class and id.
  //
  // - \`class\` The class of the {Model} you're trying to retrieve.
  // - \`id\` The {String} id of the {Model} you're trying to retrieve
  //
  // Example:
  // ```javascript
  // DatabaseStore.find(Thread, 'id-123').then((thread) => {
  //   // thread is a Thread object, or null if no match was found.
  // }
  // ```
  //
  // Returns a {Query}
  //
  find(klass, id) {
    if (!klass) {
      throw new Error(`DatabaseStore::find - You must provide a class`);
    }
    if (typeof id !== 'string') {
      throw new Error(
        `DatabaseStore::find - You must provide a string id. You may have intended to use findBy.`
      );
    }
    return new Query(klass, this).where({ id }).one();
  }

  // Public: Creates a new Model Query for retrieving a single model matching the
  // predicates provided.
  //
  // - \`class\` The class of the {Model} you're trying to retrieve.
  // - \`predicates\` An {Array} of {matcher} objects. The set of predicates the
  //    returned model must match.
  //
  // Returns a {Query}
  //
  findBy(klass, predicates = []) {
    if (!klass) {
      throw new Error(`DatabaseStore::findBy - You must provide a class`);
    }
    return new Query(klass, this).where(predicates).one();
  }

  // Public: Creates a new Model Query for retrieving all models matching the
  // predicates provided.
  //
  // - \`class\` The class of the {Model} you're trying to retrieve.
  // - \`predicates\` An {Array} of {matcher} objects. The set of predicates the
  //    returned model must match.
  //
  // Returns a {Query}
  //
  findAll(klass, predicates = []) {
    if (!klass) {
      throw new Error(`DatabaseStore::findAll - You must provide a class`);
    }
    return new Query(klass, this).where(predicates);
  }

  // Public: Creates a new Model Query that returns the {Number} of models matching
  // the predicates provided.
  //
  // - \`class\` The class of the {Model} you're trying to retrieve.
  // - \`predicates\` An {Array} of {matcher} objects. The set of predicates the
  //    returned model must match.
  //
  // Returns a {Query}
  //
  count(klass, predicates = []) {
    if (!klass) {
      throw new Error(`DatabaseStore::count - You must provide a class`);
    }
    return new Query(klass, this).where(predicates).count();
  }

  // Public: Modelify converts the provided array of IDs or models (or a mix of
  // IDs and models) into an array of models of the \`klass\` provided by querying for the missing items.
  //
  // Modelify is efficient and uses a single database query. It resolves Immediately
  // if no query is necessary.
  //
  // - \`class\` The {Model} class desired.
  // - 'arr' An {Array} with a mix of string model IDs and/or models.
  //
  modelify(klass, arr) {
    if (!(arr instanceof Array) || arr.length === 0) {
      return Promise.resolve([]);
    }

    const ids = [];
    for (const item of arr) {
      if (item instanceof klass) {
        // nothing
      } else if (typeof item === 'string') {
        ids.push(item);
      } else {
        throw new Error(`modelify: Not sure how to convert ${item} into a ${klass.name}`);
      }
    }
    if (ids.length === 0) {
      return Promise.resolve(arr);
    }

    return this.findAll(klass)
      .where(klass.attributes.id.in(ids))
      .markNotBackgroundable()
      .then(modelsFromIds => {
        const modelsByString = {};
        for (const model of modelsFromIds) {
          modelsByString[model.id] = model;
        }
        return Promise.resolve(
          arr.map(item => (item instanceof klass ? item : modelsByString[item]))
        );
      });
  }

  // Public: Executes a {Query} on the local database.
  //
  // - \`modelQuery\` A {Query} to execute.
  //
  // Returns a {Promise} that
  //   - resolves with the result of the database query.
  //
  run(modelQuery, options = { format: true }) {
    return this._query(
      modelQuery.sql(),
      [],
      modelQuery._background,
      'main',
      modelQuery.queryType()
    ).then(result => {
      if (AppEnv.showQueryResults || modelQuery.showQueryResults()) {
        try {
          AppEnv.logDebug(`query-results: ${JSON.stringify(result)}`);
          if (AppEnv.isHinata()) {
            AppEnv.reportLog(new Error('upload sql results'), {
              errorData: JSON.stringify(result.slice(0, 5)),
            });
          }
        } catch (e) {
          AppEnv.logError(`Show query results failed ${e}`);
        }
      }
      let transformed = modelQuery.inflateResult(result);
      const crossDBs = modelQuery.crossDBs();
      const links = modelQuery.crossDBLink();
      const auxDBQueries = Object.keys(crossDBs);
      if (auxDBQueries.length === 0 || modelQuery.isIdsOnly() || !links.hasLink) {
        if (options.format !== false) {
          transformed = modelQuery.formatResult(transformed);
        }
        // console.log(`no need for aux db query`);
        return Promise.resolve(transformed);
      } else {
        const promises = [];
        for (let auxDBKey of auxDBQueries) {
          if (links[auxDBKey]) {
            promises.push(
              this._query(
                modelQuery.sql(auxDBKey),
                [],
                modelQuery._background,
                crossDBs[auxDBKey].db,
                modelQuery.queryType()
              )
            );
          } else {
            // console.log(`aux db ${auxDBKey} not linked, ignoring`);
          }
        }
        return new Promise(resolve => {
          Promise.all(promises).then(rets => {
            if (AppEnv.showQueryResults || modelQuery.showQueryResults()) {
              try {
                AppEnv.logDebug(`query-results: ${JSON.stringify(rets)}`);
                if (AppEnv.isHinata()) {
                  AppEnv.reportLog(new Error('upload sql results'), {
                    errorData: JSON.stringify(rets.slice(0, 5)),
                  });
                }
              } catch (e) {
                AppEnv.logError(`Show query results failed ${e}`);
              }
            }
            for (let i = 0; i < rets.length; i++) {
              if (rets[i]) {
                transformed = modelQuery.inflateResult(rets[i], auxDBQueries[i]);
              }
            }
            if (options.format !== false) {
              transformed = modelQuery.formatResult(transformed);
            }
            // console.log('aux db quires results returned');
            resolve(transformed);
          });
        });
      }
    });
  }

  inTransaction() {
    throw new Error('The client-side database connection no longer permits writes');
  }
}

export default new DatabaseStore();
