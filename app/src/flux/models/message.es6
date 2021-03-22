import _ from 'underscore';
import moment from 'moment';
import fs from 'fs';
import File from './file';
import Utils from './utils';
import Contact from './contact';
import Folder from './folder';
import Sift from './sift';
import Attributes from '../attributes';
import ModelWithMetadata from './model-with-metadata';
import AccountStore from '../stores/account-store';
import MessageBody from './message-body';
import CategoryStore from '../stores/category-store';
import Category from './category';
import { FileState, MailcoreReturnCodeEnum } from '../../constant';

let attachmentStore = null;
const AttachmentStore = () => {
  attachmentStore = attachmentStore || require('../stores/attachment-store').default;
  return attachmentStore;
};

const mapping = {
  attachmentIdsFromJSON: json => {
    if (!Array.isArray(json)) {
      return [];
    }
    const ret = [];
    json.forEach(attachment => {
      const file = new File();
      file.fromJSON(attachment);
      if (!file.id && (attachment.pid || attachment.id)) {
        file.id = attachment.pid || attachment.id;
      }
      if (file.state !== FileState.Removed) {
        ret.push(file);
      }
    });
    return ret;
  },
  defaultValuesFromJSON: jsonString => {
    let ret;
    if (typeof jsonString !== 'string') {
      return jsonString;
    }
    try {
      ret = JSON.parse(jsonString);
    } catch (e) {
      ret = {};
    }
    return ret;
  },
  defaultValuesToJSON: data => {
    let ret;
    if (typeof data === 'string') {
      return data;
    }
    try {
      ret = JSON.stringify(data);
    } catch (e) {
      ret = '{}';
    }
    return ret;
  },
};

const isMessageView = AppEnv.isDisableThreading();

export default class Message extends ModelWithMetadata {
  static fieldsNotInDB = [
    'calendarReply',
    'listUnsubscribe',
    'pristine',
    'refOldDraftMessageId',
    'savedOnRemote',
    'hasRefOldDraftOnRemote',
    'folder',
    'replyType',
    'msgOrigin',
    'hasNewID',
    'noSave',
    'waitingForBody',
    'calCurStat',
    'calTarStat',
    'lastUpdateTimestamp',
    'defaultValues',
  ];
  static NewDraft = 1;
  static EditExistingDraft = 2;
  static ReplyDraft = 3;
  static ForwardDraft = 4;
  static ReplyAllDraft = 5;
  static draftType = {
    new: 0,
    reply: 1,
    forward: 2,
  };
  static messageSyncState = {
    normal: '0',
    saving: '2',
    sending: '3',
    updatingNoUID: '4', // Updating data from server
    updatingHasUID: '5',
    failing: '-2', // This state indicates that draft first attempt at sending is taking too long, thus should
    // display in
    // outbox
    failed: '-1', // This state indicates that draft have failed to send.
  };
  static DraftSendErrorsMessages = {
    ErrorSendMessageIllegalAttachment: 'Provider indicates message contains illegal attachment(s)',
    ErrorSendMessageNotAllowed: 'Provider indicates account not allowed to send message',
    ErrorSendMessage: 'Provider indicates message not send for unspecific reason',
    ErrorAuthenticationRequired: 'Account authentication required',
    ErrorYahooSendMessageSpamSuspected:
      'Provider indicates message not send because it is marked as spam',
    ErrorYahooSendMessageDailyLimitExceeded:
      'Provider indicates daily maximum number of message send have reached',
  };
  static compareMessageState(currentState, targetState) {
    try {
      const current = parseInt(currentState);
      const target = parseInt(targetState);
      return current === target;
    } catch (e) {
      AppEnv.reportError(new Error('currentState or targetState cannot be converted to int'), {
        errorData: {
          current: currentState,
          target: targetState,
        },
      });
      return false;
    }
  }
  static attributes = Object.assign({}, ModelWithMetadata.attributes, {
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

    replyTo: Attributes.Collection({
      modelKey: 'replyTo',
      queryable: false,
      itemClass: Contact,
    }),
    calendarReply: Attributes.Boolean({
      modelKey: 'calendarReply',
      queryable: false,
    }),

    listUnsubscribe: Attributes.String({
      modelKey: 'ListUnsub',
      queryable: false,
    }),

    pristine: Attributes.Boolean({
      modelKey: 'pristine',
      queryable: false,
    }),
    replyToMessageId: Attributes.String({
      modelKey: 'relyToMessageId',
      jsonKey: 'replyToMsgPid',
      queryable: false,
    }),

    refOldDraftMessageId: Attributes.String({
      modelKey: 'refOldDraftMessageId',
      jsonKey: 'prevDraftPid',
      queryable: false,
    }),
    savedOnRemote: Attributes.Boolean({
      modelKey: 'savedOnRemote',
      jsonKey: 'uploaded',
      queryable: false,
    }),
    hasRefOldDraftOnRemote: Attributes.Boolean({
      modelKey: 'hasRefOldDraftOnRemote',
      queryable: false,
    }),
    folder: Attributes.Object({
      queryable: false,
      modelKey: 'folder',
      itemClass: Folder,
    }),
    replyType: Attributes.Number({
      modelKey: 'replyType',
      queryable: false,
    }),
    msgOrigin: Attributes.Number({
      modelKey: 'msgOrigin',
      queryable: false,
    }),
    hasNewID: Attributes.Boolean({
      modelKey: 'hasNewID',
      queryable: false,
    }),
    defaultValues: Attributes.Object({
      modelKey: 'defaultValues',
      queryable: false,
      fromJSONMapping: mapping.defaultValuesFromJSON,
      toJSONMapping: mapping.defaultValuesToJSON,
    }),
    noSave: Attributes.Boolean({
      modelKey: 'noSave',
      queryable: false,
    }),
    waitingForBody: Attributes.Boolean({
      modelKey: 'waitingForBody',
      queryable: false,
    }),
    waitingForAttachment: Attributes.Boolean({
      modelKey: 'waitingForAttachment',
      queryable: false,
    }),
    calendarCurrentStatus: Attributes.Number({
      modelKey: 'calCurStat',
      queryable: false,
    }),
    calendarTargetStatus: Attributes.Number({
      modelKey: 'calTarStat',
      queryable: false,
    }),
    pastMessageIds: Attributes.Collection({
      modelKey: 'pastMessageIds',
      queryable: false,
    }),
    messageReferences: Attributes.Collection({
      modelKey: 'messageReferences',
      jsonKey: 'references',
      queryable: false,
    }),
    lastSync: Attributes.Number({
      modelKey: 'lastSync',
      queryable: false,
    }),
    lastUpdateTimestamp: Attributes.DateTime({
      modelKey: 'lastUpdateTimestamp',
      queryable: false,
    }),
    needUpload: Attributes.Boolean({
      modelKey: 'needUpload',
      queryable: false,
    }),
    subjectChanged: Attributes.Boolean({
      modelKey: 'subjectChanged',
      queryable: false,
    }),
    sentResponseCode: Attributes.Number({
      modelKey: 'sentResponseCode',
      queryable: false,
    }),
    data: Attributes.Object({
      modelKey: 'data',
      queryable: true,
      loadFromColumn: true,
      mergeIntoModel: true,
    }),
    msgData: Attributes.Object({
      modelKey: 'msgData',
      queryable: true,
      loadFromColumn: true,
      mergeIntoModel: true,
    }),

    date: Attributes.DateTime({
      queryable: true,
      loadFromColumn: true,
      modelKey: 'date',
    }),

    body: Attributes.CrossDBString({
      itemClass: MessageBody,
      joinModelJsonKey: 'id',
      joinModelKey: 'pid',
      joinTableKey: 'pid',
      joinTableColumn: 'htmlBody',
      modelKey: 'body',
    }),

    // All message body from native is in html format
    // isPlainText: Attributes.CrossDBNumber({
    //   itemClass: MessageBody,
    //   modelKey: 'isPlainText',
    //   joinTableColumn: 'type',
    // }),
    labelIds: Attributes.Collection({
      modelKey: 'labelIds',
      queryable: true,
      loadFromColumn: true,
    }),
    XGMLabels: Attributes.Collection({
      modelKey: 'XGMLabels',
      queryable: true,
      loadFromColumn: true,
    }),
    files: Attributes.Collection({
      modelKey: 'files',
      queryable: true,
      loadFromColumn: true,
      itemClass: File,
      fromJSONMapping: mapping.attachmentIdsFromJSON,
    }),

    unread: Attributes.Boolean({
      queryable: true,
      loadFromColumn: true,
      modelKey: 'unread',
    }),

    // events: Attributes.Collection({
    //   modelKey: 'events',
    //   itemClass: Event,
    // }),

    starred: Attributes.Boolean({
      queryable: true,
      modelKey: 'starred',
      loadFromColumn: true,
    }),

    snippet: Attributes.String({
      modelKey: 'snippet',
      queryable: true,
      loadFromColumn: true,
    }),

    threadId: Attributes.String({
      queryable: true,
      loadFromColumn: true,
      jsModelKey: 'threadId',
      modelKey: isMessageView ? 'pid' : 'threadId',
    }),

    headerMessageId: Attributes.String({
      queryable: true,
      loadFromColumn: true,
      jsonKey: 'headerMsgId',
      modelKey: 'headerMsgId',
      jsModelKey: 'headerMessageId',
    }),

    subject: Attributes.String({
      modelKey: 'subject',
      queryable: true,
      loadFromColumn: true,
    }),

    draft: Attributes.Boolean({
      jsModelKey: 'draft',
      modelKey: 'isDraft',
      queryable: true,
      loadFromColumn: true,
    }),

    version: Attributes.Number({
      modelKey: 'version',
      queryable: true,
      loadFromColumn: true,
    }),

    hasCalendar: Attributes.Boolean({
      modelKey: 'hasCalendar',
      queryable: true,
      loadFromColumn: true,
    }),
    hasBody: Attributes.Boolean({
      modelKey: 'hasBody',
      queryable: true,
      loadFromColumn: true,
    }),
    inAllMail: Attributes.Boolean({
      modelKey: 'inAllMail',
      queryable: true,
      loadFromColumn: true,
    }),
    inboxCategory: Attributes.Number({
      queryable: true,
      loadFromColumn: true,
      modelKey: 'primary',
      jsModelKey: 'inboxCategory',
    }),
    siftCategory: Attributes.Collection({
      queryable: true,
      modelKey: 'siftCategory',
      joinModelOnField: 'pid',
      joinTableOnField: 'msgId',
      joinTableName: 'SiftData',
      joinTableColumn: 'category',
      joinOnWhere: { state: 0 },
      ignoreSubSelect: true,
      itemClass: Sift,
    }),
    deleted: Attributes.Boolean({
      modelKey: 'deleted',
      loadFromColumn: true,
      queryable: true,
    }),
    syncState: Attributes.Number({
      modelKey: 'syncState',
      loadFromColumn: true,
      queryable: true,
    }),
    isJIRA: Attributes.String({
      queryable: true,
      loadFromColumn: true,
      modelKey: 'isJIRA',
    }),
  });

  static naturalSortOrder() {
    return Message.attributes.date.ascending();
  }

  constructor(data = {}) {
    super(data);
    this.subject = this.subject || '';
    this.snippet = this.snippet || '';
    this.to = this.to || [];
    this.cc = this.cc || [];
    this.bcc = this.bcc || [];
    this.from = this.from || [];
    this.replyTo = this.replyTo || [];
    this.events = this.events || [];
    this.waitingForBody = data.waitingForBody || false;
    this.hasCalendar = this.hasCalendar || false;
    if (!Array.isArray(data.pastMessageIds)) {
      this.pastMessageIds = [];
    }
    if (!Array.isArray(data.files)) {
      this.files = [];
    }
    if (this.refOldDraftMessageId) {
      this.hasRefOldDraftOnRemote = true;
    }
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

  toJSON(options) {
    const json = super.toJSON(options);
    // json.headerMessageId = this.headerMessageId || '';
    json.file_ids = this.fileIds();
    if (this.draft) {
      json.draft = true;
    }

    if (this.events && this.events.length) {
      json.event_id = this.events[0].id;
    }

    return json;
  }

  fromJSON(json = {}) {
    super.fromJSON(json);
    if (!Array.isArray(json.pastMessageIds)) {
      this.pastMessageIds = [];
    }
    if (this.refOldDraftMessageId) {
      this.hasRefOldDraftOnRemote = true;
    }
    return this;
  }

  canReplyAll() {
    const { to, cc } = this.participantsForReplyAll();
    return to.length > 1 || cc.length > 0;
  }

  // Public: Returns a set of uniqued message participants by combining the
  // `to`, `cc`, `bcc` && (optionally) `from` fields.
  participants({ includeFrom = true, includeBcc = false } = {}) {
    const seen = {};
    const all = [];
    let contacts = [].concat(this.to, this.cc);
    if (includeFrom) {
      contacts = _.union(contacts, this.from || []);
    }
    if (includeBcc) {
      contacts = _.union(contacts, this.bcc || []);
    }
    for (const contact of contacts) {
      if (!contact.email) {
        continue;
      }
      const key = contact
        .toString()
        .trim()
        .toLowerCase();
      if (seen[key]) {
        continue;
      }
      seen[key] = true;
      all.push(contact);
    }
    return all;
  }

  // Public: Returns a hash with `to` && `cc` keys for authoring a new draft in
  // "reply all" to this message. This method takes into account whether the
  // message is from the current user, && also looks at the replyTo field.
  participantsForReplyAll() {
    const excludedFroms = this.from.map(c => Utils.toEquivalentEmailForm(c.email));

    const excludeMeAndFroms = cc =>
      _.reject(
        cc,
        p =>
          p.isMe({ meAccountId: this.accountId }) ||
          _.contains(excludedFroms, Utils.toEquivalentEmailForm(p.email))
      );

    let to = null;
    let cc = null;

    if (this.replyTo.length && !this.replyTo[0].isMe()) {
      // If a replyTo is specified and that replyTo would not result in you
      // sending the message to yourself, use it.
      to = this.replyTo;
      cc = excludeMeAndFroms([].concat(this.to, this.cc));
      // should add fron into cc
      if (this.from.length) {
        const isFromInTo = to.filter(item => item.email === this.from[0].email).length;
        if (!isFromInTo) {
          if (cc) {
            cc = cc.concat(this.from);
          } else {
            cc = [].concat(this.from);
          }
        }
      }
    } else if (this.isFromMe({ ignoreOtherAccounts: true })) {
      // If the message is from you to others, reply-all should send to the
      // same people.
      to = this.to;
      cc = excludeMeAndFroms(this.cc);
    } else {
      // ... otherwise, address the reply to the sender of the email and cc
      // everyone else.
      to = this.from;
      cc = excludeMeAndFroms([].concat(this.to, this.cc));
    }

    to = _.uniq(to, p => Utils.toEquivalentEmailForm(p.email));
    cc = _.uniq(cc, p => Utils.toEquivalentEmailForm(p.email));
    return { to, cc };
  }

  // Public: Returns a hash with `to` && `cc` keys for authoring a new draft in
  // "reply" to this message. This method takes into account whether the
  // message is from the current user, && also looks at the replyTo field.
  participantsForReply() {
    let to = [];
    const cc = [];
    if (this.replyTo.length && !this.replyTo[0].isMe()) {
      // If a replyTo is specified and that replyTo would not result in you
      // sending the message to yourself, use it.
      to = this.replyTo;
    } else if (this.isExactFromMe()) {
      // If you sent the previous email, a "reply" should go to the same recipient.
      to = this.to;
    } else {
      // ... otherwise, address the reply to the sender.
      to = this.from;
    }

    to = _.uniq(to, p => Utils.toEquivalentEmailForm(p.email));
    return { to, cc };
  }

  isExactFromMe() {
    if (this.from[0]) {
      const me = AccountStore.accountForId(this.accountId);
      if (me && me.emailAddress === this.from[0].email) {
        return true;
      }
    }
    return false;
  }

  // Public: Returns an {Array} of {File} IDs
  fileIds() {
    return (this.files || []).map(file => file.id);
  }

  get labels() {
    const ret = [];
    if (Array.isArray(this.labelIds)) {
      this.labelIds.forEach(labelId => {
        if (typeof labelId === 'string') {
          const tmp = CategoryStore.byFolderId(labelId);
          if (tmp) {
            ret.push(tmp);
          }
        }
      });
    }
    return ret;
  }
  get draftFailedReason() {
    if (!this.sentResponseCode) {
      return '';
    }
    const responseKey = MailcoreReturnCodeEnum[this.sentResponseCode];
    if (responseKey && Message.DraftSendErrorsMessages[responseKey]) {
      return (
        Message.DraftSendErrorsMessages[responseKey] ||
        Message.DraftSendErrorsMessages.ErrorSendMessage
      );
    }
    return Message.DraftSendErrorsMessages.ErrorSendMessage;
  }

  missingAttachments() {
    return new Promise(resolve => {
      const totalMissing = () => {
        return [
          ...ret.inline.downloading,
          ...ret.inline.needToDownload,
          ...ret.normal.downloading,
          ...ret.normal.needToDownload,
        ];
      };
      const ret = {
        totalMissing: totalMissing,
        inline: {
          downloading: [],
          needToDownload: [],
        },
        normal: {
          downloading: [],
          needToDownload: [],
        },
      };
      const total = (this.files || []).length * 2;
      if (total === 0) {
        resolve(ret);
        return;
      }
      let processed = 0;
      (this.files || []).forEach(f => {
        if (f.state === FileState.IgnoreMissing) {
          processed += 2;
          if (processed === total) {
            resolve(ret);
            return;
          }
        }
        const path = AttachmentStore().pathForFile(f);
        fs.access(path, fs.constants.R_OK, err => {
          if (err) {
            processed++;
            fs.access(`${path}.part`, fs.constants.R_OK, err => {
              processed++;
              if (!err) {
                if (f.isInline) {
                  ret.inline.downloading.push(f);
                } else {
                  ret.normal.downloading.push(f);
                }
                if (processed === total) {
                  resolve(ret);
                  return;
                }
              } else {
                if (f.isInline) {
                  ret.inline.needToDownload.push(f);
                } else {
                  ret.normal.needToDownload.push(f);
                }
                if (processed === total) {
                  resolve(ret);
                  return;
                }
              }
            });
          } else {
            processed += 2;
            if (processed === total) {
              resolve(ret);
              return;
            }
          }
        });
      });
    });
  }
  removeMissingAttachments = () => {
    if (Array.isArray(this.files) && this.files.length > 0) {
      return new Promise(resolve => {
        let processed = 0;
        const total = this.files.length;
        const ret = [];
        const removed = [];
        this.files.forEach(f => {
          const path = AttachmentStore().pathForFile(f);
          fs.access(path, fs.constants.R_OK, err => {
            processed++;
            if (!err) {
              ret.push(f);
            } else {
              removed.push(f);
            }
            if (processed === total) {
              this.files = ret;
              resolve(removed);
            }
          });
        });
      });
    } else {
      return Promise.resolve([]);
    }
  };

  //Public: returns the first email that belongs to the account that received the email,
  // otherwise returns the account's default email.
  findMyEmail() {
    const participants = this.participants({ includeFrom: false, includeBcc: true });
    const account = AccountStore.accountForId(this.accountId);
    if (!account) {
      AppEnv.reportError(new Error('Message accountId is not part of any account'), {
        errorData: this.toJSON(),
      });
      return false;
    }
    for (let participant of participants) {
      if (account.isMyEmail(participant.email)) {
        return participant.email;
      }
    }
    return account.defaultMe().email;
  }

  // Public: Returns true if this message === from the current user's email
  // address.
  isFromMe({ ignoreOtherAccounts = false } = {}) {
    if (!this.from[0]) {
      return false;
    }
    if (ignoreOtherAccounts) {
      const account = AccountStore.accountForEmail({
        email: this.from[0].email,
        accountId: this.accountId,
      });
      if (account) {
        return account.id === this.accountId;
      }
      return this.from[0].isMe({ meAccountId: this.accountId });
    }
    return this.from[0].isMe();
  }

  isFromMyOtherAccounts() {
    if (!this.from[0]) {
      return false;
    }
    const account = AccountStore.accountForEmail({
      email: this.from[0].email,
      accountId: this.accountId,
    });
    if (account) {
      return account.id !== this.accountId;
    }
    return false;
  }

  isForwarded() {
    if (!this.subject) {
      return false;
    }
    if (this.subject.toLowerCase().startsWith('fwd:')) {
      return true;
    }
    if (this.subject.toLowerCase().startsWith('re:')) {
      return false;
    }
    if (this.body) {
      const indexForwarded = this.body.search(/forwarded/i);
      if (indexForwarded >= 0 && indexForwarded < 250) {
        return true;
      }
      const indexFwd = this.body.search(/fwd/i);
      if (indexFwd >= 0 && indexFwd < 250) {
        return true;
      }
    }
    return false;
  }

  isInTrash() {
    if (!this.labels) {
      return false;
    }
    return this.labels.some(
      folder => folder && folder.role && folder.role.toLowerCase().includes('trash')
    );
  }
  isInSpam() {
    if (!this.labels) {
      return false;
    }
    return this.labels.some(
      folder => folder && folder.role && folder.role.toLowerCase().includes('spam')
    );
  }
  isInInbox() {
    if (!this.labels) {
      return false;
    }
    return this.labels.some(
      folder => folder && folder.role && folder.role.toLowerCase().includes('inbox')
    );
  }
  isInInboxFocused() {
    if (!this.isInInbox()) {
      return false;
    }
    if (this.fromContact() && this.fromContact().isMe()) {
      return false;
    }
    return (
      this.inboxCategory === Category.InboxCategoryState.MsgCandidate ||
      this.inboxCategory === Category.InboxCategoryState.MsgPrimary
    );
  }
  isInInboxOther() {
    if (!this.isInInbox()) {
      return false;
    }
    return this.inboxCategory === Category.InboxCategoryState.MsgOther;
  }

  fromContact() {
    return (this.from || [])[0] || new Contact({ name: 'Unknown', email: 'Unknown' });
  }

  // Public: Returns the standard attribution line for this message,
  // localized for the current user.
  // ie "On Dec. 12th, 2015 at 4:00PM, Ben Gotow wrote:"
  replyAttributionLine() {
    return `On ${this.formattedDate()}, ${this.fromContact().toString()} wrote:`;
  }

  formattedDate() {
    return moment(this.date).format('MMM D YYYY, [at] h:mm a');
  }

  hasEmptyBody() {
    if (!this.body) {
      return true;
    }

    const re = /(?:<edo-signature [^>]*>.*<\/edo-signature>)|(?:<.+?>)|\s/gim;
    return this.body.replace(re, '').length === 0;
  }

  isActiveDraft() {}

  isDeleted() {
    return this.deleted;
  }
  isDraftSending() {
    return (
      !this.isDeleted() &&
      this.draft &&
      Message.compareMessageState(this.syncState === Message.messageSyncState.sending)
    );
  }

  isDraftSaving() {
    return (
      !this.isDeleted() &&
      this.draft &&
      Message.compareMessageState(this.syncState == Message.messageSyncState.saving)
    ); // eslint-ignore-line
  }
  isCalendarReply() {
    return this.calendarReply;
  }

  isHidden() {
    const isReminder =
      this.to.length === 1 &&
      this.from.length === 1 &&
      this.to[0].email === this.from[0].email &&
      (this.from[0].name || '').endsWith('via Mailspring');
    const isDraftBeingDeleted = this.id.startsWith('deleted-');

    return isReminder || isDraftBeingDeleted || this.isCalendarReply() || this.isDeleted();
  }

  setOrigin(val) {
    this.msgOrigin = val;
  }

  isNewDraft() {
    return this.msgOrigin === Message.NewDraft || this.replyType === Message.draftType.new;
  }
  isForwardDraft() {
    return this.msgOrigin === Message.ForwardDraft || this.replyType === Message.draftType.forward;
  }

  calendarStatus() {
    if (this.calendarTargetStatus >= 0) {
      return this.calendarTargetStatus;
    }
    return this.calendarCurrentStatus;
  }
}
