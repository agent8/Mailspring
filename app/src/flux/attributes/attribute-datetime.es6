import Attribute from './attribute';
import Matcher from './matcher';

/*
Public: The value of this attribute is always a Javascript `Date`, or `null`.

Section: Database
*/
export default class AttributeDateTime extends Attribute {
  constructor({ joinTableName, ...others }) {
    super(others);
    this.joinTableName = joinTableName;
  }
  toJSON(val) {
    if (!val) {
      return null;
    }
    if (!(val instanceof Date) && isFinite(val)) {
      // console.warn('converting val from integer to Date');
      val = new Date(val);
    }
    if (!(val instanceof Date)) {
      // console.warn('converting val from string to Date');
      val = Date.parse(val);
      if (!isFinite(val)) {
        AppEnv.reportError(
          new Error(
            `Attempting to toJSON AttributeDateTime which is not a date: ${this.modelKey} = ${val}`
          )
        );
        return null;
      }
      val = new Date(val);
    }
    return Math.floor(val.getTime() / 1000);
  }

  fromJSON(val) {
    if (!val || val instanceof Date) {
      return val;
    }
    const d = new Date(val * 1000);
    d.toJSON = tmp => {
      console.log(`returing tmp`);
      return Math.floor(tmp.getTime() / 1000);
    };
    return d;
  }

  columnSQL() {
    return `${this.tableColumn} INTEGER`;
  }

  // Public: Returns a {Matcher} for objects greater than the provided value.
  greaterThan(val) {
    this._assertPresentAndQueryable('greaterThan', val);
    return new Matcher(this, '>', val);
  }

  // Public: Returns a {Matcher} for objects less than the provided value.
  lessThan(val) {
    this._assertPresentAndQueryable('lessThan', val);
    return new Matcher(this, '<', val);
  }

  // Public: Returns a {Matcher} for objects greater than the provided value.
  greaterThanOrEqualTo(val) {
    this._assertPresentAndQueryable('greaterThanOrEqualTo', val);
    return new Matcher(this, '>=', val);
  }

  // Public: Returns a {Matcher} for objects less than the provided value.
  lessThanOrEqualTo(val) {
    this._assertPresentAndQueryable('lessThanOrEqualTo', val);
    return new Matcher(this, '<=', val);
  }

  gt = AttributeDateTime.greaterThan;
  lt = AttributeDateTime.lessThan;
  gte = AttributeDateTime.greaterThanOrEqualTo;
  lte = AttributeDateTime.lessThanOrEqualTo;
}
