import Attribute from './attribute';

export default class AttributeIgnore extends Attribute {
  constructor(data = {}) {
    super(data);
    this.ignore = true;
  }

  toJSON() {
    return {};
  }

  fromJSON(val) {
    return null;
  }
}
