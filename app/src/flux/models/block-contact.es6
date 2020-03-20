import Attributes from '../attributes';
import Model from './model';

export default class BlockContact extends Model {
  static passAsIs = true;
  static attributes = Object.assign({}, Model.attributes, {
    id: Attributes.String({
      modelKey: 'id',
      queryable: true,
      loadFromColumn: true,
      isPseudoPrimary: true,
    }),
    accountId: Attributes.String({
      modelKey: 'accountId',
      queryable: true,
      loadFromColumn: true,
    }),
    email: Attributes.String({
      modelKey: 'email',
      queryable: true,
      loadFromColumn: true,
    }),
    name: Attributes.String({
      modelKey: 'name',
      queryable: true,
      loadFromColumn: true,
    }),
    state: Attributes.Number({
      modelKey: 'state',
      queryable: true,
      loadFromColumn: true,
    }),
    filterId: Attributes.String({
      modelKey: 'filterId',
    }),
    type: Attributes.Number({
      modelKey: 'type',
    }),
    data: Attributes.Object({
      modelKey: 'data',
      queryable: true,
      loadFromColumn: true,
    }),
  });
  constructor(data) {
    super(data);
    this.name = this.name || '';
  }
}
