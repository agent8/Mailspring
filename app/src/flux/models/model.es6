import Attributes from '../attributes';

/**
Public: A base class for API objects that provides abstract support for
serialization and deserialization, matching by attributes, and ID-based equality.

## Attributes

`id`: {AttributeString} The resolved canonical ID of the model used in the
database and generally throughout the app. The id property is a custom
getter that resolves to the id first, and then the id.

`object`: {AttributeString} The model's type. This field is used by the JSON
 deserializer to create an instance of the correct class when inflating the object.

`accountId`: {AttributeString} The string Account Id this model belongs to.

Section: Models
 */

export default class Model {
  static mergeFields = []; // This is to indicate whether we want to merge native data with db data
  static passAsIs = false; // This is to indicate whether we need to re query DB on message from native
  static pseudoPrimaryJsKey = 'id';
  static getTableName() {
    if (this.tableName) {
      return this.tableName;
    }
    return this.name;
  }
  static attributes = {
    id: Attributes.String({
      queryable: true,
      loadFromColumn: true,
      modelKey: 'pid',
      jsModelKey: 'id',
      isPseudoPrimary: true,
    }),

    accountId: Attributes.String({
      queryable: true,
      loadFromColumn: true,
      jsonKey: 'aid',
      modelKey: 'aid',
      jsModelKey: 'accountId',
    }),
    data: Attributes.Object({
      modelKey: 'data',
      mergeIntoModel: true,
      queryable: true,
      loadFromColumn: true,
    }),
  };

  static naturalSortOrder = () => null;

  constructor(data) {
    if (data) {
      if (data.__cls) {
        this.fromJSON(data);
      } else {
        for (const key of Object.keys(this.constructor.attributes)) {
          const jsonKey =
            this.constructor.attributes[key].jsonKey || this.constructor.attributes[key].modelKey;
          if (data[key] !== undefined) {
            this[key] = data[key];
          } else if (jsonKey && data[jsonKey] !== undefined && data[jsonKey] !== null) {
            this[key] = data[jsonKey];
          }
        }
      }
    }
  }

  clone() {
    return new this.constructor(this.toJSON());
  }

  // Public: Inflates the model object from JSON, using the defined attributes to
  // guide type coercision.
  //
  // - `json` A plain Javascript {Object} with the JSON representation of the model.
  //
  // This method is chainable.
  fromJSON(json) {
    for (const key of Object.keys(this.constructor.attributes)) {
      const attr = this.constructor.attributes[key];
      if (attr.ignore) {
        continue;
      }
      const attrValue = json[attr.jsonKey || attr.modelKey || key];
      if (attrValue !== undefined) {
        if (attr.mergeIntoModel) {
          Object.assign(this, attr.fromJSON(attrValue));
        } else {
          this[key] = attr.fromJSON(attrValue);
        }
      }
    }
    return this;
  }

  // Public: Deflates the model to a plain JSON object. Only attributes defined
  // on the model are included in the JSON.
  //
  // Returns an {Object} with the JSON representation of the model.
  //
  toJSON() {
    const json = {};
    for (const key of Object.keys(this.constructor.attributes)) {
      const attr = this.constructor.attributes[key];
      if (attr.mergeIntoModel) {
        continue;
      }
      const attrValue = this[key];
      if (attrValue === undefined) {
        continue;
      }
      json[attr.jsonKey || attr.modelKey || key] = attr.toJSON(attrValue);
    }
    json.__cls = this.constructor.name;
    return json;
  }

  toString() {
    return JSON.stringify(this.toJSON());
  }

  // Public: Evaluates the model against one or more {Matcher} objects.
  //
  // - `criteria` An {Array} of {Matcher}s to run on the model.
  //
  // Returns true if the model matches the criteria.
  //
  matches(criteria) {
    if (!(criteria instanceof Array)) {
      return false;
    }
    for (const matcher of criteria) {
      if (!matcher.evaluate(this)) {
        return false;
      }
    }
    return true;
  }

  mergeFromColumn(val) {
    const allKeys = Object.keys(this.constructor.attributes);
    const neededKeys = [];
    allKeys.forEach(key => {
      if (
        !this.constructor.attributes[key].loadFromColumn &&
        !this.constructor.attributes[key].mergeIntoModel
      ) {
        neededKeys.push(key);
      }
    });
    neededKeys.forEach(key => {
      const jsKey =
        this.constructor.attributes[key].jsonKey ||
        this.constructor.attributes[key].modelKey ||
        key;
      if (val && Object.prototype.hasOwnProperty.call(val, jsKey)) {
        this[key] = this.constructor.attributes[key].fromColumn(val[jsKey]);
      }
    });
  }
}
