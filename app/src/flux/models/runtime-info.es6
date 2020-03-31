import Model from './model';
import Attributes from '../attributes';

export default class RuntimeInfo extends Model {
  static passAsIs = true;
  static attributes = Object.assign({}, Model.attributes, {
    pid: Attributes.String({
      modelKey: 'pid',
    }),
    async: Attributes.Object({
      modelKey: 'async',
    }),
    sync: Attributes.Object({
      modelKey: 'sync',
    }),
  });
  constructor() {
    super();
  }

  onError(data) {
    AppEnv.logWarning(data);
  }
}
