import _ from 'underscore';
import Actions from '../actions';
import AccountStore from './account-store';
import ContactStore from './contact-store';
import MessageStore from './message-store';
import FocusedPerspectiveStore from './focused-perspective-store';
import uuid from 'uuid';
import Contact from '../models/contact';
import Message from '../models/message';
import File from '../models/file';
import Utils from '../models/utils';
import InlineStyleTransformer from '../../services/inline-style-transformer';
import SanitizeTransformer from '../../services/sanitize-transformer';
import DOMUtils from '../../dom-utils';
let AttachmentStore = null;
let DraftStore = null;

const findAccountIdFrom = (message, thread) => {
  const validAccountId = id => {
    return typeof id === 'string' && id.length > 0;
  };
  if (!message && !thread) {
    AppEnv.reportError(new Error('Both message and thread is empty'));
    return '';
  }
  let accountId = (message || {}).accountId;
  let reportBug = false;
  let errorStr = '';
  if (!validAccountId(accountId)) {
    errorStr = 'Message doesnt have account id';
    reportBug = true;
    if (message && message.labels && message.labels[0] && message.labels[0].accountId) {
      accountId = message.labels[0].accountId;
    }
    if (!validAccountId(accountId)) {
      errorStr = errorStr + ' nor does folder/folder.accountId';
      if (thread) {
        accountId = thread.accountId;
        if (!validAccountId(accountId)) {
          errorStr = errorStr + ' nor does Thread have account Id';
        }
      }
    }
  }
  if (reportBug) {
    AppEnv.reportError(
      new Error(errorStr),
      { errorData: { message: message, thread: thread } },
      { grabLogs: true }
    );
  }
  return accountId;
};

async function prepareBodyForQuoting(body) {
  // const cidRE = MessageUtils.cidRegexString;

  // Be sure to match over multiple lines with [\s\S]*
  // Regex explanation here: https://regex101.com/r/vO6eN2/1
  // let transformed = (body || '').replace(new RegExp(`<img.*${cidRE}[\\s\\S]*?>`, 'igm'), '');
  // We no longer remove inline attachments from quoted body
  let transformed = body || '';
  transformed = await SanitizeTransformer.run(transformed, SanitizeTransformer.Preset.UnsafeOnly);
  transformed = await InlineStyleTransformer.run(transformed);
  return transformed;
}
const removeAttachmentNotLinkedInBody = (bodyStr, files) => {
  if (!Array.isArray(files)) {
    return [];
  }
  if (typeof bodyStr !== 'string') {
    return [];
  }
  const ret = [];
  files.forEach(file => {
    if (
      file &&
      typeof file.contentId === 'string' &&
      file.contentId.length > 0 &&
      bodyStr.includes(file.contentId) &&
      file.isInline
    ) {
      ret.push(file);
    }
  });
  return filterMissingAttachments(ret);
};
const filterMissingAttachments = files => {
  AttachmentStore = AttachmentStore || require('../stores/attachment-store').default;
  return AttachmentStore.filterOutMissingAttachments(files);
};
const mergeDefaultBccAndCCs = async (message, account) => {
  const mergeContacts = (field = 'cc', contacts) => {
    if (!Array.isArray(message[field])) {
      message[field] = [];
    }
    contacts.forEach(contact => {
      const exist = message[field].find(tmp => {
        return tmp.email === contact.email;
      });
      if (!exist) {
        message[field].push(contact);
      }
    });
  };
  const autoContacts = await ContactStore.parseContactsInString(account.autoaddress.value);
  if (account.autoaddress.type === 'cc') {
    mergeContacts('cc', autoContacts);
  }
  if (account.autoaddress.type === 'bcc') {
    mergeContacts('bcc', autoContacts);
  }
};
const getDraftDefaultValues = () => {
  const defaultValues = {};
  defaultValues.fontSize = AppEnv.config.get('core.fontsize');
  defaultValues.fontFace = AppEnv.config.get('core.fontface');
  return defaultValues;
};
class DraftFactory {
  getBlankContentWithDefaultFontValues() {
    const defaultValues = getDraftDefaultValues();
    const defaultSize = defaultValues.fontSize;
    const defaultFont = defaultValues.fontFace;
    return `
      <font style="font-size:${defaultSize};font-family:${defaultFont}">
        <br/>
        <br/>
      </font>
    `;
  }
  static updateFiles(message, refMessageIsDraft = false, noCopy = false) {
    if (!message) {
      return;
    }
    AttachmentStore = AttachmentStore || require('../stores/attachment-store').default;
    if (Array.isArray(message.files) && message.files.length > 0) {
      const attachmentData = [];
      message.files = message.files.map(f => {
        const newFile = File.fromPartialData(f);
        newFile.messageId = message.id;
        newFile.accountId = message.accountId;
        newFile.originFile = f;
        if (noCopy) {
          // console.log('update attachment cache');
          // AttachmentStore.setAttachmentData(newFile);
        } else {
          newFile.id = uuid();
        }
        const originalPath = AttachmentStore.pathForFile(f);
        if (refMessageIsDraft) {
          attachmentData.push({
            sourceFile: Object.assign({}, f, { fileId: f.id, filePath: originalPath }),
            dstFile: {
              fileId: newFile.id,
              filePath: AttachmentStore.pathForFile(newFile),
            },
          });
        } else {
          attachmentData.push({
            originalPath,
            dstFile: {
              fileId: newFile.id,
              filePath: AttachmentStore.pathForFile(newFile),
            },
          });
        }
        return newFile;
      });
      if (noCopy) {
        console.log('adding draft to draft attachment cache because of noCopy');
        AttachmentStore.addDraftToAttachmentCache(message);
      } else {
        console.log('copying attachments to draft attachment cache');
        AttachmentStore.copyAttachmentsToDraft({ draft: message, fileData: attachmentData });
      }
    } else {
      console.log('adding draft to draft attachment cache because of files');
      AttachmentStore.addDraftToAttachmentCache(message);
    }
  }
  async createDraft(fields = {}) {
    const account = this._accountForNewDraft();
    // const uniqueId = `${Math.floor(Date.now() / 1000)}.${Utils.generateTempId()}`;
    const uniqueId = uuid();
    const defaults = {
      body: `${this.getBlankContentWithDefaultFontValues()}`,
      subject: '',
      version: 0,
      unread: false,
      starred: false,
      headerMessageId: `${uniqueId}@edison.tech`,
      id: uniqueId,
      from: [account.defaultMe()],
      date: new Date(),
      draft: true,
      pristine: true,
      msgOrigin: Message.NewDraft,
      replyType: Message.draftType.new,
      hasNewID: false,
      accountId: account.id,
      pastMessageIds: [],
      defaultValues: getDraftDefaultValues(),
    };

    const merged = Object.assign(defaults, fields);
    if (!merged.threadId) {
      merged.threadId = `T${uniqueId}`;
    }
    if (AppEnv.isDisableThreading()) {
      merged.threadId = merged.id;
    }
    // if (merged.replyToMessageId) {
    //   merged.referenceMessageId = merged.replyToMessageId;
    //   delete merged.replyToMessageId;
    // } else {
    //   merged.referenceMessageId = merged.replyToMessageId;
    // }
    await mergeDefaultBccAndCCs(merged, account);
    // const autoContacts = await ContactStore.parseContactsInString(account.autoaddress.value);
    // if (account.autoaddress.type === 'cc') {
    //   merged.cc = (merged.cc || []).concat(autoContacts);
    // }
    // if (account.autoaddress.type === 'bcc') {
    //   merged.bcc = (merged.bcc || []).concat(autoContacts);
    // }
    const message = new Message(merged);
    DraftFactory.updateFiles(message, false, true);
    return message;
  }
  async createInviteDraft(draftData) {
    const draft = await this.createDraft(draftData);
    draft.noSave = true;
    return draft;
  }
  createNewDraftForEdit(draft) {
    const uniqueId = uuid();
    const account = AccountStore.accountForId(draft.accountId);
    if (!account) {
      throw new Error(
        'DraftEditingSession::createNewDraftForEdit - you can only send drafts from a configured account.'
      );
    }
    const pastMessageIds = Array.isArray(draft.pastMessageIds) ? draft.pastMessageIds.slice() : [];
    pastMessageIds.push(draft.id);
    const defaults = Object.assign({}, draft, {
      body: draft.body,
      version: 0,
      headerMessageId: `${uniqueId}@edison.tech`,
      id: uniqueId,
      pristine: false,
      hasNewID: false,
      accountId: account.id,
      savedOnRemote: false,
      hasRefOldDraftOnRemote: true,
      refOldDraftMessageId: draft.id,
      pastMessageIds,
    });
    if (AppEnv.isDisableThreading()) {
      defaults.threadId = defaults.id;
    }
    const message = new Message(defaults);
    DraftFactory.updateFiles(message, true, true);
    return message;
  }

  async createReportBugDraft(logId, userFeedBack) {
    try {
      const account = this._accountForNewDraft();
      if (!account) {
        return null;
      }
      const messageViewInfo = AppEnv.isDisableThreading() ? '-m' : '-t';
      const body = `<div>
            <div>
            User bug report:</br>
            ${userFeedBack.replace(/[\r|\n]/g, '</br>')}
            -----User bug report end-----</br>
            </div>
            <div>
            [MacOS] ${AppEnv.getVersion()}${process.mas ? '-mas' : ''}${messageViewInfo}
            </div></br>
            <div>
            SupportId: ${AppEnv.config.get('core.support.id')}
            </div></br>
            <div>
            [LogID]${logId}
            </div>
</div>`;
      const subject = `[Email-macOS] Feedback from ${account.emailAddress}`;
      const draft = await this.createDraft({
        body,
        subject,
        to: [Contact.fromObject({ email: 'mailsupport@edison.tech', name: 'Mac Feedback' })],
      });
      if (draft) {
        draft.bcc = [];
        draft.cc = [];
        return draft;
      }
      return null;
    } catch (e) {
      return null;
    }
  }
  duplicateDraftBecauseOfNewId(draft) {
    const uniqueId = uuid();
    const account = AccountStore.accountForId(draft.accountId);
    if (!account) {
      throw new Error(
        'DraftEditingSession::createNewDraftForEdit - you can only send drafts from a configured account.'
      );
    }
    const defaults = Object.assign({}, draft, {
      body: draft.body,
      version: 0,
      headerMessageId: `${uniqueId}@edison.tech`,
      id: uniqueId,
      pristine: false,
      hasNewID: false,
      accountId: account.id,
      savedOnRemote: false,
      hasRefOldDraftOnRemote: false,
      refOldDraftMessageId: '',
    });
    if (AppEnv.isDisableThreading()) {
      defaults.threadId = defaults.id;
    }
    const message = new Message(defaults);
    DraftFactory.updateFiles(message, true, true);
    return message;
  }

  async copyDraftToAccount(draft, from) {
    const uniqueId = uuid();
    const account = AccountStore.accountForId(from[0].accountId);
    if (!account) {
      throw new Error(
        'DraftEditingSession::ensureCorrectAccount - you can only send drafts from a configured account.'
      );
    }
    const defaults = Object.assign({}, draft, {
      body: draft.body,
      version: 0,
      from: from,
      unread: false,
      starred: false,
      headerMessageId: `${uniqueId}@edison.tech`,
      id: uniqueId,
      draft: true,
      pristine: false,
      replyType: Message.draftType.new,
      threadId: `T${uniqueId}`,
      replyToMessageId: '',
      refOldDraftMessageId: '',
      pastMessageIds: draft.pastMessageIds || [],
      savedOnRemote: false,
      hasRefOldDraftOnRemote: false,
      hasNewID: false,
      accountId: account.id,
      needUpload: true,
    });
    if (AppEnv.isDisableThreading()) {
      defaults.threadId = defaults.id;
    }
    await mergeDefaultBccAndCCs(defaults, account);
    const message = new Message(defaults);
    DraftFactory.updateFiles(message, true, true);
    return message;
  }

  async createDraftForMailto(urlString) {
    try {
      urlString = decodeURI(urlString);
    } catch (err) {
      // no-op
    }

    const match = /mailto:\/*([^?&]*)((.|\n|\r)*)/.exec(urlString);
    if (!match) {
      throw new Error(`${urlString} is not a valid mailto URL.`);
    }

    let to = match[1];
    const queryString = match[2];
    if (to.length > 0 && to.indexOf('@') === -1) {
      to = decodeURIComponent(to);
    }

    // /many/ mailto links are malformed and do things like:
    //   &body=https://github.com/atom/electron/issues?utf8=&q=is%3Aissue+is%3Aopen+123&subject=...
    //   (note the unescaped ? and & in the URL).
    //
    // To account for these scenarios, we parse the query string manually and only
    // split on params we expect to be there. (Jumping from &body= to &subject=
    // in the above example.) We only decode values when they appear to be entirely
    // URL encoded. (In the above example, decoding the body would cause the URL
    // to fall apart.)
    //
    const query = { msgOrigin: Message.NewDraft };
    query.to = to;

    const querySplit = /[&|?](subject|body|cc|to|from|bcc)+\s*=/gi;

    let openKey = null;
    let openValueStart = null;
    let matched = true;

    while (matched) {
      const queryMatch = querySplit.exec(queryString);
      matched = queryMatch !== null;

      if (openKey) {
        const openValueEnd = (queryMatch && queryMatch.index) || queryString.length;
        let value = queryString.substr(openValueStart, openValueEnd - openValueStart);
        const valueIsntEscaped = value.indexOf('?') !== -1 || value.indexOf('&') !== -1;
        try {
          if (!valueIsntEscaped) {
            value = decodeURIComponent(value);
          }
        } catch (err) {
          // no-op
        }
        query[openKey] = value;
      }
      if (queryMatch) {
        openKey = queryMatch[1].toLowerCase();
        openValueStart = querySplit.lastIndex;
      }
    }
    const contacts = {};
    for (const attr of ['to', 'cc', 'bcc']) {
      if (query[attr]) {
        contacts[attr] = ContactStore.parseContactsInString(query[attr]);
      }
    }

    if (query.body) {
      query.body = query.body.replace(/[\n\r]/g, '<br/>');
    }

    return this.createDraft(Object.assign(query, await Promise.props(contacts)));
  }

  async createOrUpdateDraftForReply({ message, thread, type, behavior }) {
    if (!['reply', 'reply-all'].includes(type)) {
      throw new Error(`createOrUpdateDraftForReply called with ${type}, not reply or reply-all`);
    }

    const existingDraft = await this.candidateDraftForUpdating(message, behavior);
    if (existingDraft) {
      return this.updateDraftForReply(existingDraft, { message, thread, type });
    }
    return this.createDraftForReply({ message, thread, type });
  }

  async createDraftForReply({ message, thread, type }) {
    const prevBody = await prepareBodyForQuoting(message.body);
    let participants = { to: [], cc: [] };
    if (type === 'reply') {
      participants = message.participantsForReply();
    } else if (type === 'reply-all') {
      participants = message.participantsForReplyAll();
    }
    const accountId = findAccountIdFrom(message, thread);
    let body = `
        ${this.getBlankContentWithDefaultFontValues()}
        <div class="gmail_quote_attribution">${DOMUtils.escapeHTMLCharacters(
          message.replyAttributionLine()
        )}</div>
        <blockquote class="gmail_quote" data-edison="true"
          style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex;">
          ${prevBody}
          <br/>
        </blockquote>
        `;
    if (!AppEnv.config.get('core.composing.includeOriginalEmailInReply')) {
      body = `${this.getBlankContentWithDefaultFontValues()}`;
    }
    return this.createDraft({
      subject: Utils.subjectWithPrefix(message.subject, 'Re:'),
      to: participants.to,
      cc: participants.cc,
      from: [this._fromContactForReply(message)],
      files: removeAttachmentNotLinkedInBody(body, message.files),
      threadId: thread.id,
      accountId: accountId,
      replyType: Message.draftType.reply,
      replyToMessageId: message.id,
      msgOrigin: type === 'reply' ? Message.ReplyDraft : Message.ReplyAllDraft,
      body,
    });
  }
  async createReplyForEvent({ message, file, replyStatus, tos, me, replyEvent }) {
    return this.createDraft({
      subject: replyEvent.summary,
      to: tos,
      from: [this._fromContactForReply(message)],
      threadId: '',
      accountId: message.accountId,
      replyToMessageId: '',
      body: `${me.name} have replied with a status of ${replyStatus.label}`,
      files: [file],
      calTarStat: replyStatus.code,
      hasCalendar: true,
      calendarReply: true,
    });
  }

  async createDraftForForward({ thread, message }) {
    // Start downloading the attachments, if they haven't been already
    message.files.forEach(f => Actions.fetchFile(f));

    const contactsAsHtml = cs => DOMUtils.escapeHTMLCharacters(_.invoke(cs, 'toString').join(', '));
    const fields = [];
    if (message.from.length > 0) fields.push(`From: ${contactsAsHtml(message.from)}`);
    fields.push(`Subject: ${message.subject}`);
    fields.push(`Date: ${message.formattedDate()}`);
    if (message.to.length > 0) fields.push(`To: ${contactsAsHtml(message.to)}`);
    if (message.cc.length > 0) fields.push(`Cc: ${contactsAsHtml(message.cc)}`);

    const body = await prepareBodyForQuoting(message.body);
    const accountId = findAccountIdFrom(message, thread);
    return this.createDraft({
      subject: Utils.subjectWithPrefix(message.subject, 'Fwd:'),
      from: [this._fromContactForReply(message)],
      files: [].concat(message.files),
      threadId: thread.id,
      accountId: accountId,
      replyToMessageId: message.id,
      replyType: Message.draftType.forward,
      msgOrigin: Message.ForwardDraft,
      pastMessageIds: [message.id],
      body: `
        ${this.getBlankContentWithDefaultFontValues()}
        <div class="gmail_quote">
          ---------- Forwarded message ---------
          <br><br>
          ${fields.join('<br>')}
          <br><br>
          ${body}
          <br/>
        </div>
        `,
    });
  }

  async createDraftForResurfacing(thread, threadMessageId, body) {
    const account = AccountStore.accountForId(thread.accountId);
    let replyToMessageId = threadMessageId;

    if (!replyToMessageId) {
      // const msg = await DatabaseStore.findBy(Message, {
      //   accountId: thread.accountId,
      //   threadId: thread.id,
      //   state: 0,
      // })
      //   .order(Message.attributes.date.descending())
      const msg = await MessageStore.findByThreadIdAndAccountIdInDesecndingOrder({
        threadId: thread.id,
        accountId: thread.accountId,
      }).limit(1);
      replyToMessageId = (msg && msg.id) || '';
    }

    return this.createDraft({
      from: [new Contact({ email: account.emailAddress, name: `${account.name} via EdisonMail` })],
      to: [account.defaultMe()],
      cc: [],
      pristine: false,
      subject: thread.subject,
      threadId: thread.id,
      accountId: thread.accountId,
      replyToMessageId: replyToMessageId,
      body: body,
    });
  }

  async candidateDraftForUpdating(message, behavior) {
    if (!['prefer-existing-if-pristine', 'prefer-existing'].includes(behavior)) {
      return null;
    }

    const messages =
      message.threadId === MessageStore.threadId()
        ? MessageStore.items()
        : await MessageStore.findAllByThreadId({ threadId: message.threadId });

    const candidateDrafts = messages.filter(
      other => other.replyToMessageId === message.id && other.draft === true
    );

    if (candidateDrafts.length === 0) {
      return null;
    }

    if (behavior === 'prefer-existing') {
      return candidateDrafts.pop();
    }
    if (behavior === 'prefer-existing-if-pristine') {
      DraftStore = DraftStore || require('./draft-store').default;
      const sessions = await Promise.all(
        candidateDrafts.map(candidateDraft => DraftStore.sessionForClientId(candidateDraft.id))
      );
      for (const session of sessions) {
        if (session.draft().pristine) {
          return session.draft();
        }
      }
      return null;
    }
  }

  updateDraftForReply(draft, { type, message }) {
    if (!(message && draft)) {
      throw new Error('updateDraftForReply: Expected message and existing draft.');
    }

    const updated = { to: [].concat(draft.to), cc: [].concat(draft.cc) };
    const replySet = message.participantsForReply();
    const replyAllSet = message.participantsForReplyAll();
    let targetSet = null;

    if (type === 'reply') {
      targetSet = replySet;

      // Remove participants present in the reply-all set and not the reply set
      for (const key of ['to', 'cc']) {
        updated[key] = _.reject(updated[key], contact => {
          const inReplySet = _.findWhere(replySet[key], { email: contact.email });
          const inReplyAllSet = _.findWhere(replyAllSet[key], { email: contact.email });
          return inReplyAllSet && !inReplySet;
        });
      }
    } else {
      // Add participants present in the reply-all set and not on the draft
      // Switching to reply-all shouldn't really ever remove anyone.
      targetSet = replyAllSet;
    }

    for (const key of ['to', 'cc']) {
      for (const contact of targetSet[key]) {
        if (!_.findWhere(updated[key], { email: contact.email })) {
          updated[key].push(contact);
        }
      }
    }

    draft.to = updated.to;
    draft.cc = updated.cc;
    return draft;
  }

  _fromContactForReply(message) {
    const account = AccountStore.accountForId(message.accountId);
    const defaultMe = account.defaultMe();

    let result = defaultMe;

    for (const aliasString of account.aliases) {
      const alias = account.meUsingAlias(aliasString);
      for (const recipient of [].concat(message.to, message.cc)) {
        const emailIsNotDefault = alias.email !== defaultMe.email;
        const emailsMatch = recipient.email === alias.email;
        const nameIsNotDefault = alias.name !== defaultMe.name;
        const namesMatch = recipient.name === alias.name;

        // No better match is possible
        if (emailsMatch && emailIsNotDefault && namesMatch && nameIsNotDefault) {
          return alias;
        }

        // A better match is possible. eg: the user may have two aliases with the same
        // email but different phrases, and we'll get an exact match on the other one.
        // Continue iterating and wait to see.
        if ((emailsMatch && emailIsNotDefault) || (namesMatch && nameIsNotDefault)) {
          result = alias;
        }
      }
    }
    return result;
  }

  _accountForNewDraft() {
    const defAccountId = AppEnv.config.get('core.sending.defaultAccountIdForSend');
    const account = AccountStore.accountForId(defAccountId);
    if (account) {
      return account;
    }
    const focusedAccountId = FocusedPerspectiveStore.current().accountIds[0];
    if (focusedAccountId) {
      return AccountStore.accountForId(focusedAccountId);
    }
    return AccountStore.accounts()[0];
  }
}

export default new DraftFactory();
