import {
  SearchQueryExpressionVisitor,
  OrQueryExpression,
  AndQueryExpression,
  DateQueryExpression,
  UnreadStatusQueryExpression,
  StarredStatusQueryExpression,
  HasAttachmentQueryExpression,
  MatchQueryExpression,
  SpecialCharacterQueryExpression,
} from './search-query-ast';
import { DateUtils } from 'mailspring-exports';

const isMessageView = AppEnv.isDisableThreading();

/*
 * This class visits a match-compatible subtree and condenses it into a single
 * MatchQueryExpression.
 */
class MatchQueryExpressionVisitor extends SearchQueryExpressionVisitor {
  visit(root) {
    const result = this.visitAndGetResult(root);
    return new MatchQueryExpression(`${result}`);
  }

  _assertIsMatchCompatible(node) {
    if (!node.isMatchCompatible()) {
      throw new Error(`Expected ${node} to be match compatible`);
    }
  }

  visitAnd(node) {
    this._assertIsMatchCompatible(node);
    const lhs = this.visitAndGetResult(node.e1);
    const rhs = this.visitAndGetResult(node.e2);
    this._result = `(${lhs} AND ${rhs})`;
  }

  visitOr(node) {
    const lhs = this.visitAndGetResult(node.e1);
    const rhs = this.visitAndGetResult(node.e2);
    this._result = `(${lhs} OR ${rhs})`;
  }

  visitDate(node) {}

  visitFrom(node) {
    const text = this.visitAndGetResult(node.text);
    this._result = `(from_ : "${text}"*)`;
  }

  visitTo(node) {
    const text = this.visitAndGetResult(node.text);
    this._result = `(to_ : "${text}"*)`;
  }

  visitSubject(node) {
    const text = this.visitAndGetResult(node.text);
    this._result = `(subject : "${text}")`;
  }

  visitGeneric(node) {
    const text = this.visitAndGetResult(node.text);
    // this._result = `("${text}"*)`;
    this._result = `(("${text}"*) OR (remoteSearch : "${text}"*))`;
  }

  visitText(node) {
    // TODO: Should we do anything about possible SQL injection attacks?
    this._result = node.token.s;
  }

  visitUnread(node) {
    this._assertIsMatchCompatible(node);
  }

  visitStarred(node) {
    this._assertIsMatchCompatible(node);
  }

  visitIn(node) {
    const text = this.visitAndGetResult(node.text);
    this._result = `(categories : "${text}")`;
  }

  visitHasAttachment(node) {
    this._assertIsMatchCompatible(node);
  }

  visitSpecialCharacter(node) {}
}

/*
 * This class creates a new AST by converting match-compatible subtrees into
 * MatchQueryExpressions.
 */
class MatchCompatibleQueryCondenser extends SearchQueryExpressionVisitor {
  constructor() {
    super();
    this._matchVisitor = new MatchQueryExpressionVisitor();
  }

  visit(root) {
    return this.visitAndGetResult(root);
  }

  visitAnd(node) {
    if (node.isMatchCompatible()) {
      this._result = this._matchVisitor.visit(node);
      return;
    }

    const lhs = this.visitAndGetResult(node.e1);
    const rhs = this.visitAndGetResult(node.e2);
    this._result = new AndQueryExpression(lhs, rhs);
  }

  visitOr(node) {
    if (node.isMatchCompatible()) {
      this._result = this._matchVisitor.visit(node);
      return;
    }

    const lhs = this.visitAndGetResult(node.e1);
    const rhs = this.visitAndGetResult(node.e2);
    this._result = new OrQueryExpression(lhs, rhs);
  }

  visitFrom(node) {
    this._result = this._matchVisitor.visit(node);
  }

  visitTo(node) {
    this._result = this._matchVisitor.visit(node);
  }

  visitSubject(node) {
    this._result = this._matchVisitor.visit(node);
  }

  visitGeneric(node) {
    this._result = this._matchVisitor.visit(node);
  }

  visitText(node) {
    this._result = this._matchVisitor.visit(node);
  }

  visitIn(node) {
    this._result = this._matchVisitor.visit(node);
  }

  visitUnread(node) {
    this._result = new UnreadStatusQueryExpression(node.status);
  }

  visitDate(node) {
    this._result = new DateQueryExpression(node.text, node.direction);
  }

  visitStarred(node) {
    this._result = new StarredStatusQueryExpression(node.status);
  }

  visitHasAttachment(/* node */) {
    this._result = new HasAttachmentQueryExpression();
  }

  visitSpecialCharacter(node) {
    this._result = new SpecialCharacterQueryExpression(node.text);
  }
}

/*
 * Converts a search query into the appropriate where clause. It does this by
 * converting match-compatible subtrees into the appropriate subquery that
 * uses a MATCH clause.
 */
class StructuredSearchQueryVisitor extends SearchQueryExpressionVisitor {
  constructor(className) {
    super();
    this._className = className;
  }

  visit(root) {
    return this.visitAndGetResult(root);
  }

  visitAnd(node) {
    if (!node.noDatesOptimize) {
      if (node.e1 instanceof DateQueryExpression && node.e2 instanceof MatchQueryExpression) {
        node.e2.dates = [node.e1];
      } else if (
        node.e2 instanceof DateQueryExpression &&
        node.e1 instanceof MatchQueryExpression
      ) {
        node.e1.dates = [node.e2];
      } else {
        node.e1.noDatesOptimize = true;
        node.e2.noDatesOptimize = true;
      }
    }
    const lhs = this.visitAndGetResult(node.e1);
    const rhs = this.visitAndGetResult(node.e2);
    this._result = `(${lhs} AND ${rhs})`;
  }

  visitOr(node) {
    const lhs = this.visitAndGetResult(node.e1);
    const rhs = this.visitAndGetResult(node.e2);
    this._result = `(${lhs} OR ${rhs})`;
  }

  visitFrom(node) {
    throw new Error('Unreachable', node);
  }

  visitTo(node) {
    throw new Error('Unreachable', node);
  }

  visitSubject(node) {
    throw new Error('Unreachable', node);
  }

  visitGeneric(node) {
    throw new Error('Unreachable', node);
  }

  visitText(node) {
    throw new Error('Unreachable', node);
  }

  visitIn(node) {
    throw new Error('Unreachable', node);
  }

  visitUnread(node) {
    const unread = node.status ? 1 : 0;
    this._result = `(\`${this._className}\`.\`unread\` = ${unread})`;
  }

  visitStarred(node) {
    const starred = node.status ? 1 : 0;
    this._result = `(\`${this._className}\`.\`starred\` = ${starred})`;
  }

  visitHasAttachment(/* node */) {
    this._result = `(\`${this._className}\`.\`hasAttachments\` = 1)`;
  }

  visitSpecialCharacter(node) {
    const text = node.text.token.s;
    this._result = `(\`${this._className}\`.\`subject\` like '${text.replace(/'/g, "''")}')`;
  }

  visitDate(node, klassName = '') {
    this._result = StructuredSearchQueryVisitor.dateQuery(node, klassName);
  }
  static dateQuery(node, klassName = '') {
    const comparator = node.direction === 'before' ? '<' : '>';
    const date = DateUtils.getChronoPast().parseDate(node.text.token.s);
    if (!klassName) {
      klassName = isMessageView ? 'Message' : 'Thread';
    }
    if (!date) {
      if (isFinite(parseInt(node.text.token.s))) {
        return `${
          isMessageView ? ` ${klassName}.date ` : ` ${klassName}.lastDate `
        } ${comparator} ${node.text.token.s}`;
      }
      return '';
    }
    const ts = Math.floor(date.getTime() / 1000);
    return `${
      isMessageView ? ` ${klassName}.date ` : ` ${klassName}.lastDate`
    } ${comparator} ${ts}`;
  }

  visitMatch(node) {
    const searchTable = `${this._className}Search`;
    let dateQuery = '';
    if (!node.noDatesOptimize && Array.isArray(node.dates) && node.dates.length > 0) {
      const klassName = isMessageView ? 'MessageSearch' : 'ThreadSearch';
      dateQuery =
        ' AND ' +
        node.dates
          .map(d => {
            return StructuredSearchQueryVisitor.dateQuery(d, klassName);
          })
          .join(' AND ') +
        ' SEARCH_MATCH_SQL ';
    } else {
      dateQuery = ' SEARCH_MATCH_SQL ';
    }

    // in sqlite3, you use '' to escape a '. Weird right?
    const escaped = node.rawQuery.replace(/'/g, "''");
    this._result = `(\`${this._className}\`.\`pid\` IN (SELECT \`${
      isMessageView ? 'messageId' : 'threadId'
    }\` FROM \`${searchTable}\` WHERE \`${searchTable}\` MATCH '${escaped}' ${dateQuery} ))`;
  }
}

export default class LocalSearchQueryBackend {
  constructor(modelClassName) {
    this._modelClassName = modelClassName;
  }

  compile(ast) {
    const condenser = new MatchCompatibleQueryCondenser();
    const intermediateAST = condenser.visit(ast);

    const codegen = new StructuredSearchQueryVisitor(`${this._modelClassName}`);
    return codegen.visit(intermediateAST);
  }
}
