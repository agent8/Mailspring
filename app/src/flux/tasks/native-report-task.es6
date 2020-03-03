import Task from './task';
import Attributes from '../attributes';

export default class NativeReportTask extends Task {
  static errorLevel = {
    'info': 0,
    'warning': 1,
    'error': 2,
  };
  static attributes = Object.assign({}, Task.attributes, {
    key: Attributes.String({
      modelKey: 'key',
      queryable: false,
    }),
    info: Attributes.String({
      modelKey: 'info',
      queryable: false,
    }),
    level: Attributes.Number({
      modelKey: 'level',
      queryable: false,
    })
  });
  constructor({ accountId, ...rest } = {}) {
    super(rest);
    this.accountId = accountId || '';
  }

  label() {
    return `Native Report Task`;
  }
}
