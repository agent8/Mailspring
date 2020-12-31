import MailspringStore from 'mailspring-store';
import { DatabaseStore } from 'mailspring-exports';
import uuid from 'uuid';

class BugReportStore extends MailspringStore {
  constructor() {
    super();
    this._sqlResults = [];
  }
  _updateSqlResult(id, result) {
    const now = Date.now();
    for (let i = 0; i < this._sqlResults.length; i++) {
      if (this._sqlResults[i].id === id) {
        this._sqlResults[i].result = result;
        this._sqlResults[i].updateTime = now;
        AppEnv.logDebug(`--------User Manual query----------`);
        AppEnv.logDebug(
          `query ${this._sqlResults[i].query}, start time: ${this._sqlResults[i].startTime}, end time: ${now}`
        );
        AppEnv.logDebug(`result: ${result}`);
        AppEnv.logDebug(`----------User Manual query end----------`);
        return;
      }
    }
  }

  getSqlResults() {
    return this._sqlResults.slice();
  }
  resetSqlResults() {
    this._sqlResults = [];
  }
  appendSqlQuery(query, dbKey = 'main') {
    const id = uuid();
    this._sqlResults.push({ query, result: 'waiting...', id, startTime: Date.now() });
    DatabaseStore.sendArbitrarySqlQuery(query, dbKey).then(
      result => {
        this._updateSqlResult(id, JSON.stringify(result));
        this.trigger();
      },
      err => {
        this._updateSqlResult(id, err.toString());
        this.trigger();
      }
    );
    this.trigger();
  }
}
module.exports = new BugReportStore();
