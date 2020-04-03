import Model from './model';
import Attributes from '../attributes';

export default class JoinTable extends Model {
  static attributes = Object.assign({}, Model.attributes);
  static originalAttributes = Object.assign({}, Model.attributes);
  static useAttribute(attr, type) {
    const newObj = {};
    let attrKey;
    if(typeof attr === 'string'){
      newObj[attr] = Attributes[type]({
        queryable: true,
        modelKey: attr,
        isJoinTable: true,
      });
      attrKey = attr;
    } else {
      attrKey = attr.modelKey;
      newObj[attrKey] = Attributes[type](
        Object.assign({},attr,{
        queryable: true,
        isJoinTable: true,
      }));
    }
    JoinTable.attributes = Object.assign({}, JoinTable.originalAttributes, newObj);
    return JoinTable.attributes[attrKey];
  }
}
