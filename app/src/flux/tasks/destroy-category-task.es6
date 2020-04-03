import utf7 from 'utf7';
import Task from './task';
import Attributes from '../attributes';

export default class DestroyCategoryTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    path: Attributes.String({
      modelKey: 'path',
    }),
    name: Attributes.String({
      modelKey: 'name',
    })
  });

  constructor(data) {
    super(data);
    this.name = this.name || this.path;
  }
  onError({ key, debuginfo, retryable }) {
    const errorMessage = `Delete folder ${utf7.imap.decode(this.name)} failed`;
    const errorDetail = debuginfo;
    AppEnv.showErrorDialog({title: errorMessage, message: errorDetail});
  }

  label() {
    return `Deleting ${utf7.imap.decode(this.name)}`;
  }
}
