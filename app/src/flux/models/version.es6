import Attributes from '../attributes';
import Model from './model';

export default class Version extends Model {
  static attributes = Object.assign({}, {
    // load id column into json
    version: Attributes.String({
      loadFromColumn: true,
      queryable: true,
      jsonKey: 'version',
      modelKey: 'version',
    }),
  });

  constructor(data = {}) {
    super(data);
  }

  fromJSON(json = {}) {
    super.fromJSON(json);

    // Only change the `draft` bit if the incoming json has an `object`
    // property. Because of `DraftChangeSet`, it's common for incoming json
    // to be an empty hash. In this case we want to leave the pre-existing
    // draft bit alone.
    // if (json.object) {
    //   this.draft = json.object === 'draft';
    // }

    return this;
  }
}
