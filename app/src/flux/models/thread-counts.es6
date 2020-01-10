import Attributes from '../attributes';
import Model from './model';
export default class ThreadCounts extends Model {
  static passAsIs = true;
  static attributes = Object.assign({}, {
    categoryId: Attributes.String({
      queryable: true,
      modelKey: 'categoryId',
      loadFromColumn: true
    }),
    unread: Attributes.Number({
      modelKey: 'unread',
      queryable: true,
      loadFromColumn: true
    }),
    total: Attributes.Number({
      modelKey: 'total',
      queryable: true,
      loadFromColumn: true
    }),
    remoteUnread: Attributes.Number({
      modelKey: 'remoteUnread',
      queryable: true,
      loadFromColumn: true
    }),
    remoteTotal: Attributes.Number({
      modelKey: 'remoteTotal',
      queryable: true,
      loadFromColumn: true
    })
  })
}