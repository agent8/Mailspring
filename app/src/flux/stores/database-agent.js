const path = require('path');
const fs = require('fs');
const Sqlite3 = require('better-sqlite3');
const LOG = require('electron-log');
let LOG_READY = false;
const dbs = {};

const deathDelay = 50000;
const args = process.argv.slice(2);
if (args.length > 1) {
  LOG.transports.file.file = path.join(
    args[0],
    'ui-log',
    `ui-log-database-agent-${args[1]}-${Date.now()}.log`
  );
  LOG.transports.console.level = false;
  LOG.transports.file.maxSize = 20485760;
  LOG.transports.file.archiveLog = file => {
    file = file.toString();
    const info = path.parse(file);
    try {
      fs.renameSync(file, path.join(info.dir, `${info.name}-${Date.now()}.old${info.ext}`));
    } catch (e) {
      console.warn('Could not rotate log', e);
    }
  };
  LOG_READY = true;
}
const _log = (message, logType = 'log') => {
  if (logType === 'error') {
    console.error(message);
  } else if (logType === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
  }
  if (LOG_READY) {
    LOG[logType](message);
  }
};
const logError = log => {
  _log(log, 'error');
};

// eslint-disable-next-line no-unused-vars
const logWarning = log => {
  _log(log, 'warn');
};

const logDebug = log => {
  _log(log, 'debug');
};

let deathTimer = setTimeout(() => {
  logDebug(`existing process after ${deathDelay}`);
  process.exit(0);
}, deathDelay);
const getDatabase = (dbpath, readonly = true) => {
  logDebug(`accessing db at ${dbpath}`);
  if (dbs[dbpath]) {
    logDebug(`dbpath ${dbpath} already open`);
    return dbs[dbpath];
  }

  // let openResolve = null;

  try {
    logDebug(`creating dbpath ${dbpath}`);
    dbs[dbpath] = new Sqlite3(dbpath, { readonly });
  } catch (err) {
    logError(`error opening db ${dbpath}`);
    logError(err);
    process.exit(1);
  }
  // dbs[dbpath].on('close', (err) => {
  //   console.error(err);
  //   process.exit(1);
  // });
  // dbs[dbpath].on('open', () => {
  //   openResolve(dbs[dbpath]);
  // });

  // dbs[dbpath].openPromise = new Promise((resolve) => {
  //   openResolve = resolve;
  // });
  logDebug(`dbpath ${dbpath} opened`);
  return dbs[dbpath];
};
process.on('disconnect', () => {
  logDebug(`IPC channel disconnected, closing process`);
  clearTimeout(deathTimer);
  process.exit(1);
});
process.on('exit', () => {
  logDebug(`process exited, closing process`);
});
process.on('message', m => {
  clearTimeout(deathTimer);
  const { query, values, id, dbpath, queryType } = m;
  logDebug(`processing query for ${dbpath}, ${id}, ${query}`);
  const start = Date.now();

  const db = getDatabase(dbpath, query !== 'Vacuum');
  try {
    clearTimeout(deathTimer);
    let results;
    if (query === 'Vacuum') {
      results = db.exec(query);
    } else {
      const fn = query.startsWith('SELECT') ? 'all' : 'run';
      const stmt = db.prepare(query);
      results = stmt[fn](values);
    }
    process.send({
      type: 'results',
      results,
      id,
      agentTime: Date.now() - start,
      queryType: queryType,
    });
    logDebug(
      `returning results with length ${results.length ? results.length : 0} for ${dbpath}, ${id}`
    );
  } catch (err) {
    const errMessage = `returning results for ${dbpath}, ${id} failed, query: ${query}`;
    const errJSON = {
      message: errMessage,
      id,
      query,
      queryType,
      results: [],
      agentTime: Date.now() - start,
      reason: err,
    };
    try {
      const errString = JSON.stringify(errJSON);
      logError(errString);
    } catch (e) {
      logError(errMessage);
      logError(err);
    }
  }

  clearTimeout(deathTimer);

  if (query === 'Vacuum') {
    logDebug(`Because was ${query}, ${id}, killing connection now `);
    try {
      if (db) {
        logDebug(`closing db for ${dbpath}`);
        db.close();
      }
    } catch (err) {
      logError(err);
    }
    logDebug(`existing process immediately`);
    process.exit(0);
    return;
  }
  deathTimer = setTimeout(() => {
    try {
      if (db) {
        logDebug(`closing db for ${dbpath}`);
        db.close();
      }
    } catch (err) {
      logError(err);
    }
    logDebug(`existing process after ${deathDelay}`);
    process.exit(0);
  }, deathDelay);

  // getDatabase(dbpath).then((db) => {
  //   clearTimeout(deathTimer);
  //   const fn = query.startsWith('SELECT') ? 'all' : 'run';
  //   const stmt = db.prepare(query);
  //   const results = stmt[fn](values);
  //   process.send({ type: 'results', results, id, agentTime: Date.now() - start });

  //   clearTimeout(deathTimer);
  //   deathTimer = setTimeout(() => process.exit(0), deathDelay);
  // });
});
logDebug(`Waiting for queries`);
