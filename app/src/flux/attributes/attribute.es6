import Matcher from './matcher';
import SortOrder from './sort-order';

/*
Public: The Attribute class represents a single model attribute, like 'account_id'.
Subclasses of {Attribute} like {AttributeDateTime} know how to covert between
the JSON representation of that type and the javascript representation.
The Attribute class also exposes convenience methods for generating {Matcher} objects.

Section: Database
*/
export default class Attribute {
  constructor({mergeIntoModel = false, isPseudoPrimary = false, modelKey, jsModelKey = false, queryable = false, jsonKey, loadFromColumn = false, isJoinTable = false, modelTable, toJSONMapping = false, fromJSONMapping = false }) {
    this.modelKey = modelKey;
    this.jsModelKey = jsModelKey || modelKey;
    this.tableColumn = modelKey;
    this.jsonKey = jsonKey || modelKey;
    this.queryable = queryable;
    if (loadFromColumn && !queryable) {
      throw new Error('loadFromColumn requires queryable');
    }
    this.loadFromColumn = loadFromColumn;
    this.isJoinTable = isJoinTable;
    this.modelTable = modelTable;
    this.toJSONMapping = toJSONMapping;
    this.fromJSONMapping = fromJSONMapping;
    this.isPseudoPrimary = isPseudoPrimary && queryable;
    // Use to indicate if field must be in the select sql.
    if(mergeIntoModel && !loadFromColumn){
      throw new Error(`mergeIntoModel requires loadFromColumn`);
    }
    this.mergeIntoModel = mergeIntoModel && loadFromColumn;

  }

  _assertPresentAndQueryable(fnName, val) {
    if (val === undefined) {
      throw new Error(`Attribute::${fnName} (${this.modelKey}) - you must provide a value`);
    }
    if (!this.queryable) {
      throw new Error(
        `Attribute::${fnName} (${this.modelKey}) - this field cannot be queried against`
      );
    }
  }

  // Public: Returns a {Matcher} for objects `=` to the provided value.
  equal(val) {
    this._assertPresentAndQueryable('equal', val);
    return new Matcher(this, '=', val, this.isJoinTable);
  }

  // Public: Returns a {Matcher} for objects `=` to the provided value.
  in(val, { notIn } = {}) {
    this._assertPresentAndQueryable('in', val);

    if (!(val instanceof Array)) {
      throw new Error(`Attribute.in: you must pass an array of values.`);
    }
    if (val.length === 0) {
      console.warn(
        `Attribute::in (${
        this.modelKey
        }) called with an empty set. You should avoid this useless query!`
      );
    }
    if (val.length === 1) {
      const testChar = notIn ? '!=' : '=';
      return new Matcher(this, testChar, val[0], this.isJoinTable);
    }
    const matcherType = notIn ? 'not in' : 'in';
    return new Matcher(this, matcherType, val, this.isJoinTable);
  }

  notIn(val) {
    return this.in(val, { notIn: true });
  }

  // Public: Returns a {Matcher} for objects `!=` to the provided value.
  not(val) {
    this._assertPresentAndQueryable('not', val);
    return new Matcher(this, '!=', val, this.isJoinTable);
  }

  // Public: Returns a descending {SortOrder} for this attribute.
  descending() {
    return new SortOrder(this, 'DESC');
  }

  // Public: Returns an ascending {SortOrder} for this attribute.
  ascending() {
    return new SortOrder(this, 'ASC');
  }

  toJSON(val) {
    if (typeof this.toJSONMapping === 'function') {
      return this.toJSONMapping(val);
    }
    return val;
  }

  fromJSON(val) {
    if (typeof this.fromJSONMapping === 'function'){
      return this.fromJSONMapping(val);
    }
    return val || null;
  }

  fromColumn(val) {
    return this.fromJSON(val);
  }

  needsColumn() {
    // return this.queryable && this.columnSQL && this.jsonKey !== 'id';
    return this.queryable;
  }
}