import Message from './message';
import Contact from './contact';
// import Folder from './folder';
import File from './file';
// import Label from './label';
import Category from './category';
import Attributes from '../attributes';
import DatabaseStore from '../stores/database-store';
import CategoryStore from '../stores/category-store';
import ModelWithMetadata from './model-with-metadata';

/*
Public: The Thread model represents an email thread.

Attributes

`snippet`: {AttributeString} A short, ~140 character string with the content
  of the last message in the thread. Queryable.

`subject`: {AttributeString} The subject of the thread. Queryable.

`unread`: {AttributeBoolean} True if the thread is unread. Queryable.

`starred`: {AttributeBoolean} True if the thread is starred. Queryable.

`version`: {AttributeNumber} The version number of the thread.

`participants`: {AttributeCollection} A set of {Contact} models
  representing the participants in the thread.
  Note: Contacts on Threads do not have IDs.

`lastMessageReceivedTimestamp`: {AttributeDateTime} The timestamp of the
  last message on the thread.

This class also inherits attributes from {Model}

Section: Models
@class Thread
*/

const threadInboxCategory = {
  primary: 0,
  others: 1,
};

const isMessageView = AppEnv.getDisableThread();
const threadAttributes = isMessageView
  ? {
      snippet: Attributes.String({
        modelKey: 'snippet',
        queryable: true,
        loadFromColumn: true,
      }),

      subject: Attributes.String({
        queryable: true,
        loadFromColumn: true,
        modelKey: 'subject',
      }),

      unread: Attributes.Boolean({
        modelKey: 'unread',
        jsonKey: 'unread',
        queryable: true,
        loadFromColumn: true,
      }),

      starred: Attributes.Boolean({
        queryable: true,
        loadFromColumn: true,
        modelKey: 'starred',
      }),

      inboxCategory: Attributes.Number({
        queryable: true,
        loadFromColumn: true,
        modelKey: 'category',
        jsModelKey: 'inboxCategory',
      }),

      categories: Attributes.Collection({
        modelKey: 'categories',
        joinTableOnField: 'messageId',
        joinModelOnField: 'pid',
        joinTableColumn: 'categoryId',
        joinTableName: 'MessageCategory',
        joinOnWhere: { state: 0 },
        itemClass: Category,
        queryable: true,
      }),

      labelIds: Attributes.Collection({
        modelKey: 'labelIds',
        queryable: true,
        loadFromColumn: true,
      }),

      participants: Attributes.Collection({
        modelKey: 'participants',
        itemClass: Contact,
        queryable: false,
        loadFromColumn: false,
      }),

      files: Attributes.Collection({
        modelKey: 'files',
        itemClass: File,
      }),

      hasAttachments: Attributes.Boolean({
        modelKey: 'hasAttachments',
        queryable: true,
        loadFromColumn: true,
      }),
      lastMessageTimestamp: Attributes.DateTime({
        queryable: true,
        jsModelKey: 'lastMessageTimestamp',
        jsonKey: 'date',
        modelKey: 'date',
        loadFromColumn: true,
      }),
      inAllMail: Attributes.Boolean({
        modelKey: 'inAllMail',
        queryable: true,
        loadFromColumn: true,
      }),
      state: Attributes.Number({
        modelKey: 'deleted',
        queryable: true,
        loadFromColumn: true,
      }),
      hasCalendar: Attributes.Number({
        modelKey: 'hasCalendar',
        queryable: true,
        loadFromColumn: true,
      }),

      to: Attributes.Collection({
        modelKey: 'to',
        jsonKey: 'to',
        queryable: true,
        loadFromColumn: true,
        itemClass: Contact,
      }),

      cc: Attributes.Collection({
        modelKey: 'cc',
        jsonKey: 'cc',
        queryable: true,
        loadFromColumn: true,
        itemClass: Contact,
      }),

      bcc: Attributes.Collection({
        modelKey: 'bcc',
        jsonKey: 'bcc',
        queryable: true,
        loadFromColumn: true,
        itemClass: Contact,
      }),

      from: Attributes.Collection({
        modelKey: 'from',
        jsonKey: 'from',
        queryable: true,
        loadFromColumn: true,
        itemClass: Contact,
      }),
    }
  : {
      snippet: Attributes.String({
        modelKey: 'snippet',
        queryable: true,
        loadFromColumn: true,
      }),

      subject: Attributes.String({
        queryable: true,
        loadFromColumn: true,
        modelKey: 'subject',
      }),

      unread: Attributes.Boolean({
        modelKey: 'unread',
        jsonKey: 'unread',
        queryable: true,
        loadFromColumn: true,
        modelTable: 'ThreadCategory',
      }),

      starred: Attributes.Boolean({
        queryable: true,
        loadFromColumn: true,
        modelKey: 'starred',
      }),

      inboxCategory: Attributes.Number({
        queryable: true,
        loadFromColumn: true,
        modelKey: 'category',
        jsModelKey: 'inboxCategory',
      }),

      categories: Attributes.Collection({
        modelKey: 'categories',
        joinTableOnField: 'threadId',
        joinModelOnField: 'pid',
        joinTableColumn: 'categoryId',
        joinTableName: 'ThreadCategory',
        joinOnWhere: { state: 0 },
        joinQueryableBy: ['inAllMail', 'lastDate', 'unread'],
        itemClass: Category,
        queryable: true,
      }),

      labelIds: Attributes.Collection({
        modelKey: 'labelIds',
        queryable: true,
        loadFromColumn: true,
      }),

      participants: Attributes.Collection({
        modelKey: 'participants',
        itemClass: Contact,
        queryable: true,
        loadFromColumn: true,
      }),

      files: Attributes.Collection({
        modelKey: 'files',
        itemClass: File,
      }),

      hasAttachments: Attributes.Boolean({
        modelKey: 'hasAttachments',
        queryable: true,
        loadFromColumn: true,
      }),

      lastMessageTimestamp: Attributes.DateTime({
        queryable: true,
        jsModelKey: 'lastMessageTimestamp',
        jsonKey: 'lastDate',
        modelKey: 'lastDate',
        loadFromColumn: true,
        modelTable: 'ThreadCategory',
      }),

      inAllMail: Attributes.Boolean({
        modelKey: 'inAllMail',
        queryable: true,
        loadFromColumn: true,
      }),
      state: Attributes.Number({
        modelKey: 'state',
        queryable: true,
        loadFromColumn: true,
      }),
      hasCalendar: Attributes.Number({
        modelKey: 'hasCalendar',
        queryable: true,
        loadFromColumn: true,
      }),
    };
export default class Thread extends ModelWithMetadata {
  static tableName = isMessageView ? 'Message' : 'Thread';
  static attributes = Object.assign({}, ModelWithMetadata.attributes, threadAttributes);

  static sortOrderAttribute = () => {
    return Thread.attributes.lastMessageTimestamp;
  };

  static naturalSortOrder = () => {
    return Thread.sortOrderAttribute().descending();
  };

  constructor(...args) {
    super(...args);
    if (isMessageView) {
      this.participants = [
        ...(this.to || []),
        ...(this.cc || []),
        ...(this.bcc || []),
        ...(this.from || []),
      ];
    }
  }

  async messages({ includeHidden } = {}) {
    const where = isMessageView
      ? { id: this.id, deleted: false }
      : { threadId: this.id, deleted: false };
    const messages = await DatabaseStore.findAll(Message)
      .where(where)
      .where([
        Message.attributes.syncState.in([
          Message.messageSyncState.saving,
          Message.messageSyncState.normal,
        ]),
      ]);

    if (!includeHidden) {
      return messages.filter(message => !message.isHidden());
    }
    return messages;
  }

  get categories() {
    return [].concat(this.labels || []);
  }

  set categories(c) {
    // noop
  }

  get attachmentCount() {
    return (this.files || []).length;
  }
  get labels() {
    return this.labelIds.map(labelId => {
      if (typeof labelId === 'string') {
        return CategoryStore.byFolderId(labelId);
      }
    });
  }

  get folders() {
    return this.labels;
  }

  /**
   * In the `clone` case, there are `categories` set, but no `folders` nor
   * `labels`
   *
   * When loading data from the API, there are `folders` AND `labels` but
   * no `categories` yet.
   */
  fromJSON(json) {
    super.fromJSON(json);

    if (this.participants && this.participants instanceof Array) {
      this.participants.forEach(item => {
        item.accountId = this.accountId;
      });
    }
    return this;
  }

  sortedCategories() {
    if (!this.categories) {
      return [];
    }
    let out = [];
    const isImportant = l => l.role === 'important';
    const isStandardCategory = l => l.isStandardCategory();
    const isUnhiddenStandardLabel = l =>
      !isImportant(l) && isStandardCategory(l) && !l.isHiddenCategory();

    const importantLabel = this.categories.find(isImportant);
    if (importantLabel) {
      out = out.concat(importantLabel);
    }

    const standardLabels = this.categories.filter(isUnhiddenStandardLabel);
    if (standardLabels.length > 0) {
      out = out.concat(standardLabels);
    }

    const userLabels = this.categories.filter(l => !isImportant(l) && !isStandardCategory(l));

    if (userLabels.length > 0) {
      out = out.concat(userLabels.sort((a, b) => a.displayName.localeCompare(b.displayName)));
    }
    return out;
  }
}
