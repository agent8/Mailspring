import Model from './model';
import Attributes from '../attributes';


export default class FolderState extends Model {
  static attributes = Object.assign({}, Model.attributes, {
    accountId: Attributes.Ignore(),
    lastSynced: Attributes.DateTime({
      modelKey: 'lastSynced',
    })
  });
}
