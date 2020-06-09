import Attributes from '../attributes';
import Model from './model';
export default class ThreadCategory extends Model {
  static attributes = Object.assign(
    {},
    {
      categoryId: Attributes.String({
        modelKey: 'categoryId',
        queryable: true,
      }),
      unread: Attributes.Number({
        modelKey: 'unread',
      }),
      value: Attributes.String({
        modelKey: 'categoryId',
      }),
      inAllMail: Attributes.Number({
        modelKey: 'inAllMail',
      }),
      state: Attributes.Number({
        modelKey: 'state',
        queryable: true,
      }),
      primary: Attributes.Number({
        modelKey: 'primary',
      }),
      lastMessageTimestamp: Attributes.DateTime({
        modelKey: 'lastDate',
      }),
    }
  );
}
