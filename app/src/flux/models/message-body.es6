import Attributes from '../attributes';
import CrossDBModel from './crossDBModel';
import { AuxDBs } from '../stores/database-store';

export default class MessageBody extends CrossDBModel {
  static attributes = Object.assign({}, CrossDBModel.attributes, {
    id: Attributes.String({
      modelKey: 'pid',
      loadFromColumn: true,
      queryable: true,
      isPseudoPrimary: true
    }),
    value: Attributes.String({
      modelKey: 'htmlBody',
      loadFromColumn: true,
      queryable: true,
    }),
    fetchedAt: Attributes.DateTime({
      modelKey: 'lastUpdate',
      loadFromColumn: true,
      queryable: true,
    }),
    data: Attributes.Ignore({}),
  });
  static db = AuxDBs.MessageBody;
  constructor(data) {
    super(data);
    this.dbName = AuxDBs.MessageBody;
  }
}
