import LocalSearchQueryBackend from '../../services/search/search-query-backend-local';

// https://www.sqlite.org/faq.html#q14
// That's right. Two single quotes in a row…
const singleQuoteEscapeSequence = "''";

// https://www.sqlite.org/fts5.html#section_3
const doubleQuoteEscapeSequence = '""';

/*
Public: The Matcher class encapsulates a particular comparison clause on an {Attribute}.
Matchers can evaluate whether or not an object matches them, and also compose
SQL clauses for the DatabaseStore. Each matcher has a reference to a model
attribute, a comparator and a value.

```javascript

// Retrieving Matchers

isUnread = Thread.attributes.unread.equal(true)

hasLabel = Thread.attributes.categories.contains('label-id-123')

// Using Matchers in Database Queries

DatabaseStore.findAll(Thread).where(isUnread)...

// Using Matchers to test Models

threadA = new Thread(unread: true)
threadB = new Thread(unread: false)

isUnread.evaluate(threadA)
// => true
isUnread.evaluate(threadB)
// => false

```

Section: Database
*/
const isMessageView = AppEnv.isDisableThreading();
class Matcher {
  constructor(attr, comparator, val, muid = null, useJoinTableRef = false) {
    this.attr = attr;
    this.comparator = comparator;
    this.val = val;
    if (muid) {
      this.muid = muid;
    } else {
      this.muid = Matcher.muid;
      Matcher.muid = (Matcher.muid + 1) % 50;
    }
    this._useJoinTableRef = useJoinTableRef;
    this._partOfSubSelectJoin = false;
  }
  set partOfSubSelectJoin(val) {
    this._partOfSubSelectJoin = val;
  }
  get partOfSubSelectJoin() {
    return this._partOfSubSelectJoin;
  }

  getMuid() {
    return this.muid;
  }

  setMuid(value) {
    this.muid = value;
  }

  attribute() {
    return this.attr;
  }

  value() {
    return this.val;
  }

  evaluate(model) {
    let modelValue = model[this.attr.jsModelKey || this.attr.modelKey];
    if (modelValue instanceof Function) {
      modelValue = modelValue();
    }
    const matcherValue = this.val;

    // Given an array of strings or models, and a string or model search value,
    // will find if a match exists.
    const modelArrayContainsValue = (array, searchItem) => {
      const asId = v => (v && v.id ? v.id : v);
      const search = asId(searchItem);
      if (!Array.isArray(array)) {
        console.log(`\nnot array ${array}\n`);
      }
      for (const item of array) {
        if (asId(item) === search) {
          return true;
        }
      }
      return false;
    };
    const valueIn = (array, searchItem) => {
      if (array.length === 0) {
        return false;
      }
      for (let item of array) {
        // triple-equals would break this, because we have state = 1 while we look for state='1'
        if (item == searchItem) {
          // eslint-disable-line
          return true;
        }
      }
      return false;
    };
    const valueNotIn = (array, searchItem) => {
      if (array.length === 0) {
        return true;
      }
      for (let item of array) {
        // triple-equals would break this, because we have state = 1 while we look for state='1'
        if (item == searchItem) {
          // eslint-disable-line
          return false;
        }
      }
      return true;
    };

    switch (this.comparator) {
      case '=':
        // triple-equals would break this, because we convert false to 0, true to 1
        return modelValue == matcherValue; // eslint-disable-line
      case '!=':
        return modelValue != matcherValue; // eslint-disable-line
      case '<':
        return modelValue < matcherValue;
      case '>':
        return modelValue > matcherValue;
      case '<=':
        return modelValue <= matcherValue;
      case '>=':
        return modelValue >= matcherValue;
      case 'in':
        return valueIn(matcherValue, modelValue);
      case 'not in':
        return valueNotIn(matcherValue, modelValue);
      case 'contains':
        return modelArrayContainsValue(modelValue, matcherValue);
      case 'containsAnyAtCategory':
        return true;
      case 'containsAny':
        return !!matcherValue.find(submatcherValue =>
          modelArrayContainsValue(modelValue, submatcherValue)
        );
      case 'startsWith':
        return modelValue.startsWith(matcherValue);
      case 'like':
        return modelValue.search(new RegExp(`.*${matcherValue}.*`, 'gi')) >= 0;
      default:
        throw new Error(
          `Matcher.evaulate() not sure how to evaluate ${this.attr.modelKey} with comparator ${this.comparator}`
        );
    }
  }

  joinTableRef() {
    return `M${this.muid}`;
  }

  joinSQL(klass) {
    switch (this.comparator) {
      case 'contains':
      case 'containsAnyAtCategory':
      case 'containsAny': {
        const joinTable = this.attr.tableNameForJoinAgainst(klass);
        const joinTableRef = this.joinTableRef();
        let andSql = '';
        if (this.attr.joinOnWhere) {
          const wheres = [];
          let tmpVal = '';
          let tmpKey = '';
          for (const key of Object.keys(this.attr.joinOnWhere)) {
            tmpVal = this._escapeValue(this.attr.joinOnWhere[key]);
            tmpKey = key;
            if (typeof tmpVal === 'string' && tmpVal.indexOf('(') === 0) {
              wheres.push(` \`${joinTableRef}\`.\`${tmpKey}\` IN ${tmpVal} `);
            } else if (tmpVal === null) {
              wheres.push(` \`${joinTableRef}\`.\`${tmpKey}\` is NULL `);
            } else {
              wheres.push(` \`${joinTableRef}\`.\`${tmpKey}\` = ${tmpVal} `);
            }
          }
          if (wheres.length > 0) {
            andSql = ` AND ( ${wheres.join(' AND ')} ) `;
          }
        }
        return `INNER JOIN ${
          isMessageView || this.attr.ignoreSubSelect ? `\`${joinTable}\`` : '(SUB_SELECT_SQL) '
        } AS \`${joinTableRef}\` ON \`${joinTableRef}\`.\`${
          this.attr.joinTableOnField
        }\` = \`${klass.getTableName()}\`.\`${this.attr.joinModelOnField}\`${andSql}`;
      }
      default:
        return false;
    }
  }

  _escapeValue(val) {
    if (typeof val === 'string') {
      return `'${val.replace(/'/g, singleQuoteEscapeSequence)}'`;
    } else if (val === true) {
      return 1;
    } else if (val === false) {
      return 0;
    } else if (val instanceof Date) {
      return val.getTime() / 1000;
    } else if (val instanceof Array) {
      const escapedVals = [];
      for (const v of val) {
        if (typeof v !== 'string') {
          throw new Error(`${this.attr.tableColumn} value ${v} must be a string.`);
        }
        escapedVals.push(`'${v.replace(/'/g, singleQuoteEscapeSequence)}'`);
      }
      return `(${escapedVals.join(',')})`;
    } else {
      return val;
    }
  }

  _safeSQL(keyWord) {
    return keyWord
      .replace(/\//g, '//')
      .replace(/\'/g, singleQuoteEscapeSequence)
      .replace(/\[/g, '/[')
      .replace(/\]/g, '/]')
      .replace(/\%/g, '/%')
      .replace(/\&/g, '/&')
      .replace(/\_/g, '/_')
      .replace(/\(/g, '/(')
      .replace(/\)/g, '/)');
  }
  _likeSQLSplit(term) {
    let searchSubjectTerm = term.replace(/\ +/g, '%');
    if (searchSubjectTerm.lastIndexOf('%') === searchSubjectTerm.length - 1) {
      searchSubjectTerm = searchSubjectTerm.slice(-1);
    }
    if (searchSubjectTerm.indexOf('%') === 0) {
      searchSubjectTerm = searchSubjectTerm.slice(1);
    }
    return searchSubjectTerm;
  }

  whereSQL(klass, usingSubSelect = false) {
    if (usingSubSelect !== this.partOfSubSelectJoin && !isMessageView) {
      // console.warn(`skipping attr ${this.attr.modelKey}`);
      return false;
    }
    const val =
      this.comparator === 'like' ? `%${this._likeSQLSplit(this._safeSQL(this.val))}%` : this.val;
    let escaped = null;
    if (typeof val === 'string') {
      if (this.comparator === 'like') {
        escaped = `'${val}' escape '/' `;
      } else {
        escaped = `'${val.replace(/'/g, singleQuoteEscapeSequence)}'`;
      }
    } else if (val === true) {
      escaped = 1;
    } else if (val === false) {
      escaped = 0;
    } else if (val instanceof Date) {
      escaped = val.getTime() / 1000;
    } else if (val instanceof Array) {
      const escapedVals = [];
      for (const v of val) {
        if (typeof v !== 'string') {
          throw new Error(`${this.attr.tableColumn} value ${v} must be a string.`);
        }
        escapedVals.push(`'${v.replace(/'/g, singleQuoteEscapeSequence)}'`);
      }
      escaped = `(${escapedVals.join(',')})`;
    } else {
      escaped = val;
    }
    let andSql = '';
    let tableName = klass.getTableName();
    if (usingSubSelect && !isMessageView) {
      tableName = this.attr.joinTableName || this.attr.modelTable;
    }
    if (this.attr.joinOnWhere) {
      const wheres = [];
      let tmpVal = '';
      let tmpKey = '';
      for (const key of Object.keys(this.attr.joinOnWhere)) {
        tmpVal = this._escapeValue(this.attr.joinOnWhere[key]);
        tmpKey = key;
        if (typeof tmpVal === 'string' && tmpVal.indexOf('(') === 0) {
          wheres.push(
            ` \`${usingSubSelect ? tableName : this.joinTableRef()}\`.\`${tmpKey}\` IN ${tmpVal} `
          );
        } else if (tmpVal === null) {
          wheres.push(
            ` \`${usingSubSelect ? tableName : this.joinTableRef()}\`.\`${tmpKey}\` is NULL `
          );
        } else {
          wheres.push(
            ` \`${usingSubSelect ? tableName : this.joinTableRef()}\`.\`${tmpKey}\` = ${tmpVal} `
          );
        }
      }
      andSql = ` AND ( ${wheres.join(' AND ')} ) `;
    }
    if (this.attr.isJoinTable && !usingSubSelect) {
      switch (this.comparator) {
        case '=': {
          if (escaped === null) {
            return `\`${this.joinTableRef()}\`.\`${this.attr.tableColumn}\` IS NULL`;
          }
          return `\`${this.joinTableRef()}\`.\`${this.attr.tableColumn}\` = ${escaped}`;
        }
        case '!=': {
          if (escaped === null) {
            return `\`${this.joinTableRef()}\`.\`${this.attr.tableColumn}\` IS NOT NULL`;
          }
          return `\`${this.joinTableRef()}\`.\`${this.attr.tableColumn}\` != ${escaped}`;
        }
        case 'startsWith':
          return ' RAISE `TODO`; ';
        case 'contains':
          return `\`${this.joinTableRef()}\`.\`${this.attr.joinTableColumn}\` = ${escaped}`;
        case 'containsAny':
          return `\`${this.joinTableRef()}\`.\`${
            this.attr.joinTableColumn
          }\` IN ${escaped} ${andSql}`;
        case 'containsAnyAtCategory':
          return `\`${this.joinTableRef()}\`.\`${
            this.attr.joinTableColumn
          }\` IN ${escaped} ${andSql}`;
        default:
          return `\`${this.joinTableRef()}\`.\`${this.attr.tableColumn}\` ${
            this.comparator
          } ${escaped}`;
      }
    }
    switch (this.comparator) {
      case '=': {
        if (escaped === null) {
          return `\`${tableName}\`.\`${this.attr.tableColumn}\` IS NULL`;
        }
        return `\`${tableName}\`.\`${this.attr.tableColumn}\` = ${escaped}`;
      }
      case '!=': {
        if (escaped === null) {
          return `\`${tableName}\`.\`${this.attr.tableColumn}\` IS NOT NULL`;
        }
        return `\`${tableName}\`.\`${this.attr.tableColumn}\` != ${escaped}`;
      }
      case 'startsWith':
        return ' RAISE `TODO`; ';
      case 'contains':
        return `\`${usingSubSelect ? tableName : this.joinTableRef()}\`.\`${
          this.attr.joinTableColumn
        }\` = ${escaped}`;
      case 'containsAny':
        return `\`${usingSubSelect ? tableName : this.joinTableRef()}\`.\`${
          this.attr.joinTableColumn
        }\` IN ${escaped} ${andSql}`;
      case 'containsAnyAtCategory':
        return `\`${usingSubSelect ? tableName : this.joinTableRef()}\`.\`${
          this.attr.joinTableColumn
        }\` IN ${escaped} ${andSql}`;
      default:
        return `\`${tableName}\`.\`${this.attr.tableColumn}\` ${this.comparator} ${escaped}`;
    }
  }
}

Matcher.muid = 0;

class OrCompositeMatcher extends Matcher {
  constructor(children) {
    super();
    this.children = children;
  }

  attribute() {
    return null;
  }

  value() {
    return null;
  }

  evaluate(model) {
    return this.children.some(matcher => matcher.evaluate(model));
  }

  joinSQL(klass) {
    const joins = [];
    for (const matcher of this.children) {
      const join = matcher.joinSQL(klass);
      if (join) {
        joins.push(join);
      }
    }
    return joins.length ? joins.join(' ') : false;
  }

  whereSQL(klass, usingSubSelect = false) {
    const wheres = [];
    this.children.forEach(matcher => {
      const where = matcher.whereSQL(klass, usingSubSelect);
      if (where) {
        wheres.push(where);
      }
    });
    return wheres.length > 0 ? `(${wheres.join(' OR ')})` : '';
  }
}

class JoinOrCompositeMatcher extends OrCompositeMatcher {
  constructor(props) {
    super(props);
    this._partOfSubSelectjoin = true;
    this.children.forEach(child => {
      child.partOfSubSelectJoin = true;
    });
  }

  joinSQL(klass) {
    const joins = [];
    for (const matcher of this.children) {
      matcher.setMuid(this.getMuid());
      const join = matcher.joinSQL(klass);
      if (join) {
        joins.push(join);
      }
    }
    return joins.length ? joins.join(' ') : false;
  }

  whereSQL(klass, usingSubSelect = false) {
    const muid = this.getMuid();
    const wheres = [];
    this.children.forEach(matcher => {
      matcher.setMuid(muid);
      const where = matcher.whereSQL(klass, usingSubSelect);
      if (where) {
        wheres.push(where);
      }
    });
    return wheres.length > 0 ? `(${wheres.join(' OR ')})` : '';
  }
}

class AndCompositeMatcher extends Matcher {
  constructor(children) {
    super();
    this.children = children;
  }

  attribute() {
    return null;
  }

  value() {
    return null;
  }

  evaluate(model) {
    return this.children.every(m => m.evaluate(model));
  }

  joinSQL(klass) {
    const joins = [];
    for (const matcher of this.children) {
      const join = matcher.joinSQL(klass);
      if (join) {
        joins.push(join);
      }
    }
    return joins;
  }

  whereSQL(klass, usingSubSelect = false) {
    const wheres = [];
    this.children.forEach(m => {
      const where = m.whereSQL(klass, usingSubSelect);
      if (where) {
        wheres.push(where);
      }
    });
    return wheres.length > 0 ? `(${wheres.join(' AND ')})` : '';
  }
}

class JoinAndCompositeMatcher extends AndCompositeMatcher {
  constructor(props) {
    super(props);
    this._partOfSubSelectJoin = true;
    this.children.forEach(child => {
      child.partOfSubSelectJoin = true;
    });
  }

  joinSQL(klass) {
    const joins = [];
    for (const matcher of this.children) {
      matcher.setMuid(this.getMuid());
      const join = matcher.joinSQL(klass);
      if (join) {
        joins.push(join);
      }
    }
    return joins;
  }

  whereSQL(klass, usingSubSelect = false) {
    const muid = this.getMuid();
    const wheres = [];
    this.children.forEach(m => {
      m.setMuid(muid);
      const where = m.whereSQL(klass, usingSubSelect);
      if (where) {
        wheres.push(where);
      }
    });
    if (wheres.length > 0) {
      return `(${wheres.join(' AND ')})`;
    }
    return '';
  }
}

class NotCompositeMatcher extends AndCompositeMatcher {
  whereSQL(klass, usingSubSelect = false) {
    const where = super.whereSQL(klass, usingSubSelect);
    if (where) {
      return `NOT (${where})`;
    } else {
      return '';
    }
  }
}

class StructuredSearchMatcher extends Matcher {
  constructor(searchQuery) {
    super(null, null, null);
    this._searchQuery = searchQuery;
    this.isSearchQurey = true;
  }

  attribute() {
    return null;
  }

  value() {
    return null;
  }

  // The only way to truly check if a model matches this matcher is to run the query
  // again and check if the model is in the results. This is too expensive, so we
  // will always return true so models aren't excluded from the
  // SearchQuerySubscription result set
  evaluate() {
    return true;
  }

  whereSQL(klass) {
    return new LocalSearchQueryBackend(klass.getTableName()).compile(this._searchQuery);
  }
}

class SearchMatcher extends Matcher {
  constructor(searchQuery) {
    if (typeof searchQuery !== 'string' || searchQuery.length === 0) {
      throw new Error('You must pass a string with non-zero length to search.');
    }
    super(null, null, null);
    this.searchQuery = searchQuery
      .trim()
      .replace(/^['"]/, '')
      .replace(/['"]$/, '')
      .replace(/'/g, singleQuoteEscapeSequence)
      .replace(/"/g, doubleQuoteEscapeSequence);
    this.isSearchQurey = true;
  }

  attribute() {
    return null;
  }

  value() {
    return null;
  }

  // The only way to truly check if a model matches this matcher is to run the query
  // again and check if the model is in the results. This is too expensive, so we
  // will always return true so models aren't excluded from the
  // SearchQuerySubscription result set
  evaluate() {
    return true;
  }

  whereSQL(klass) {
    const searchTable = `${klass.getTableName()}Search`;
    return `\`${klass.getTableName()}\`.\`pid\` IN (SELECT \`threadId\` FROM \`${searchTable}\` WHERE \`${searchTable}\` MATCH '"${
      this.searchQuery
    }"*' LIMIT 1000)`;
  }
}

Matcher.Or = OrCompositeMatcher;
Matcher.JoinOr = JoinOrCompositeMatcher;
Matcher.And = AndCompositeMatcher;
Matcher.JoinAnd = JoinAndCompositeMatcher;
Matcher.Not = NotCompositeMatcher;
Matcher.Search = SearchMatcher;
Matcher.StructuredSearch = StructuredSearchMatcher;

export default Matcher;
