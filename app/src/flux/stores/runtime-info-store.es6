import MailspringStore from 'mailspring-store';
import DatabaseStore from './database-store';
import RuntimeInfo from '../models/runtime-info';
import _ from 'underscore';

class RuntimeInfoStore extends MailspringStore {
  constructor() {
    super();
    this.runtimeInfo = {}
    this._triggerDebounced = _.debounce(() => this.trigger(), 200);
    DatabaseStore.listen(change => {
      if (change.objectClass === RuntimeInfo.name) {
        this._onRuntimeInfoChange(change.objects);
      }
    });
  }
  _onRuntimeInfoChange = items => {
    for (const data of items) {
      this.runtimeInfo[data.accountId] = data;
    }
    this._triggerDebounced();
  };

  getRuntimeInfo() {
    return this.runtimeInfo;
  }
}

export default new RuntimeInfoStore();
