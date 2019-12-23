import Model from './model';
import Attributes from '../attributes';

export default class AttachmentProgress extends Model {
  static attributes = Object.assign({}, Model.attributes, {
    id: Attributes.String({
      modelKey: 'id',
    }),
    cursize: Attributes.Number({
      modelKey: 'cursize',
    }),
    maxsize: Attributes.Number({
      modelKey: 'maxsize',
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
