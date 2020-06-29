import Model from './model';
import Attributes from '../attributes';

export default class AttachmentProgress extends Model {
  static passAsIs = true;
  static attributes = Object.assign({}, Model.attributes, {
    pid: Attributes.String({
      modelKey: 'pid',
    }),
    cursize: Attributes.Number({
      modelKey: 'cursize',
    }),
    maxsize: Attributes.Number({
      modelKey: 'maxsize',
    }),
    state: Attributes.Number({
      modelKey: 'state',
    }),
  });
  constructor() {
    super();
  }

  label() {
    return `email attachments download progress`;
  }

  onError(data) {
    AppEnv.logWarning(data);
  }
}
