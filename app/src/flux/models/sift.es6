import Model from './model';
import Attributes from '../attributes';

export default class Sift extends Model {
  static categories = {
    Travel: 'Travel',
    Packages: 'Packages',
    Bill: 'Bill & Receipts',
    Entertainment: 'Entertainment',
  };
  static categoryStringToIntString = category => {
    if (typeof category !== 'string') {
      return '1';
    }
    if (category.toLocaleLowerCase() === Sift.categories.Travel.toLocaleLowerCase()) {
      return '0';
    }
    if (category.toLocaleLowerCase() === Sift.categories.Bill.toLocaleLowerCase()) {
      return '2';
    }
    if (category.toLocaleLowerCase() === Sift.categories.Entertainment.toLocaleLowerCase()) {
      return '3';
    }
    return '1';
  };
  static attributes = Object.assign({}, Model.attributes, {
    msgId: Attributes.String({
      modelKey: 'msgId',
      queryable: true,
    }),
    accountId: Attributes.String({
      modelKey: 'aid',
    }),
    mimeId: Attributes.String({
      modelKey: 'mimeId',
    }),
    connectionId: Attributes.Number({
      modelKey: 'connId',
    }),
    siftId: Attributes.Number({
      modelKey: 'siftId',
    }),
    domain: Attributes.String({
      modelKey: 'domain',
      queryable: true,
    }),
    category: Attributes.Number({
      modelKey: 'category',
      queryable: true,
    }),
    payload: Attributes.Object({
      modelKey: 'payload',
    }),
    state: Attributes.Number({
      modelKey: 'state',
    }),
  });
  constructor({ accountId, ...rest } = {}) {
    super(rest);
    this.accountId = accountId || '';
  }

  label() {
    return `Sift Data`;
  }
}