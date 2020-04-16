import Model from './model';
import Attributes from '../attributes';

export default class SentProgress extends Model {
  static passAsIs = true;
  static attributes = Object.assign({}, Model.attributes, {
    id: Attributes.String({
      modelKey: 'pid',
      jsModelKey: 'id',
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
