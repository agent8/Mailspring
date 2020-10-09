import Message from './message';
import Contact from './contact';
import File from './file';
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
const isMessageView = AppEnv.isDisableThreading();
const threadDiffAttributes = isMessageView
  ? {
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
      draft: Attributes.Boolean({
        jsModelKey: 'draft',
        modelKey: 'isDraft',
        queryable: true,
        loadFromColumn: true,
      }),
    }
  : {};
export default class Thread extends ModelWithMetadata {
  static tableName = isMessageView ? 'Message' : 'Thread';
  static attributes = Object.assign({}, ModelWithMetadata.attributes, threadDiffAttributes, {
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
    unread: isMessageView
      ? Attributes.Boolean({
          modelKey: 'unread',
          jsonKey: 'unread',
          queryable: true,
          loadFromColumn: true,
        })
      : Attributes.Boolean({
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

    inboxCategory: isMessageView
      ? Attributes.Number({
          queryable: true,
          modelKey: 'primary',
          jsModelKey: 'inboxCategory',
          loadFromColumn: true,
        })
      : Attributes.Number({
          queryable: true,
          modelKey: 'primary',
          jsModelKey: 'inboxCategory',
          loadFromColumn: true,
          modelTable: 'ThreadCategory',
        }),
    categories: isMessageView
      ? Attributes.Collection({
          modelKey: 'categories',
          joinTableOnField: 'messageId',
          joinModelOnField: 'pid',
          joinTableColumn: 'categoryId',
          joinTableName: 'MessageCategory',
          joinOnWhere: { state: 0 },
          itemClass: Category,
          queryable: true,
        })
      : Attributes.Collection({
          modelKey: 'categories',
          joinTableOnField: 'threadId',
          joinModelOnField: 'pid',
          joinTableColumn: 'categoryId',
          joinTableName: 'ThreadCategory',
          joinOnWhere: { state: 0 },
          joinQueryableBy: ['inAllMail', 'lastDate', 'unread', 'primary'],
          itemClass: Category,
          queryable: true,
        }),

    labelIds: Attributes.Collection({
      modelKey: 'labelIds',
      queryable: true,
      loadFromColumn: true,
    }),

    participants: isMessageView
      ? Attributes.Collection({
          modelKey: 'participants',
          itemClass: Contact,
          queryable: false,
          loadFromColumn: false,
        })
      : Attributes.Collection({
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

    lastMessageTimestamp: isMessageView
      ? Attributes.DateTime({
          queryable: true,
          jsModelKey: 'lastMessageTimestamp',
          jsonKey: 'date',
          modelKey: 'date',
          loadFromColumn: true,
        })
      : Attributes.DateTime({
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
    state: isMessageView
      ? Attributes.Number({
          modelKey: 'deleted',
          jsModelKey: 'state',
          queryable: true,
          loadFromColumn: true,
        })
      : Attributes.Number({
          modelKey: 'state',
          queryable: true,
          loadFromColumn: true,
        }),
    hasCalendar: Attributes.Number({
      modelKey: 'hasCalendar',
      queryable: true,
      loadFromColumn: true,
    }),
    isJIRA: Attributes.String({
      queryable: true,
      loadFromColumn: true,
      modelKey: 'isJIRA',
    }),
  });

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

  static sortOrderAttribute = () => {
    return Thread.attributes.lastMessageTimestamp;
  };

  static naturalSortOrder = () => {
    return Thread.sortOrderAttribute().descending();
  };

  async messages({ includeHidden } = {}) {
    const messages = await DatabaseStore.findAll(Message).where([
      Message.attributes.threadId.equal(this.id),
      Message.attributes.deleted.equal(false),
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
    if (!Array.isArray(this.labelIds)) {
      return [];
    }
    return this.labelIds
      .map(labelId => {
        if (typeof labelId === 'string') {
          return CategoryStore.byFolderId(labelId);
        }
      })
      .filter(l => l);
  }

  get folders() {
    return this.labels;
  }
  isSameInboxCategory(inboxCategory) {
    let val = inboxCategory;
    if (typeof inboxCategory !== 'number') {
      try {
        val = parseInt(inboxCategory, 10);
      } catch (e) {
        return false;
      }
    }
    return (
      Category.inboxNotOtherCategorys().includes(this.inboxCategory) ===
      Category.inboxNotOtherCategorys().includes(val)
    );
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
    if (!this.id) {
      this.id = json.id || json.pid;
    }
    if (json.remoteSearch) {
      this.remoteSearch = json.remoteSearch;
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
