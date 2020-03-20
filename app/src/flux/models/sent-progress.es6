import Model from './model';
import Attributes from '../attributes';

export default class SentProgress extends Model {
  static passAsIs = true;
  static attributes = Object.assign({}, Model.attributes, {
    pid: Attributes.String({
      modelKey: 'pid',
    }),
    headerMessageId: Attributes.String({
      modelKey: 'hMsgId',
      jsModelKey: 'headerMessageId',
    }),
    current: Attributes.Number({
      modelKey: 'current',
    }),
    total: Attributes.Number({
      modelKey: 'total',
    }),
  });
}
