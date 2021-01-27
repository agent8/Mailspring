import SiftTask from './sift-task';
import Attributes from '../attributes';
import Actions from '../actions';
export default class SiftChangeSharingOptTask extends SiftTask {
  static attributes = Object.assign({}, SiftTask.attributes, {
    sharingOpt: Attributes.Number({
      modelKey: 'sharingOpt',
    }),
  });
  constructor(data) {
    super(data);
  }

  label() {
    return `Sift Change sharing option`;
  }
  onSuccess() {
    Actions.dataShareOptionsSuccess(this.sharingOpt);
  }
  onError(err) {
    Actions.dataShareOptionsFailed(err, this.sharingOpt);
  }
}
