import SiftTask from './sift-task';
import Attributes from '../attributes';

export default class GetMuteListTask extends SiftTask {
  static attributes = Object.assign({}, SiftTask.attributes, {
    aid: Attributes.String({
      modelKey: 'aid',
    }),
  });
  constructor() {
    super();
    this.aid = 'empty';
  }

  label() {
    return `get mute list`;
  }
}
