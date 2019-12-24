import _ from 'underscore';
import Actions from '../actions';
import DatabaseStore from './database-store';
import AccountStore from './account-store';
import ContactStore from './contact-store';
import MessageStore from './message-store';
import FocusedPerspectiveStore from './focused-perspective-store';
import uuid from 'uuid';

import Contact from '../models/contact';
import Message from '../models/message';
import MessageUtils from '../models/message-utils';
import Utils from '../models/utils';
import InlineStyleTransformer from '../../services/inline-style-transformer';
import SanitizeTransformer from '../../services/sanitize-transformer';
import DOMUtils from '../../dom-utils';

let DraftStore = null;

async function prepareBodyForQuoting(body) {
  // const cidRE = MessageUtils.cidRegexString;

  // Be sure to match over multiple lines with [\s\S]*
  // Regex explanation here: https://regex101.com/r/vO6eN2/1
  // let transformed = (body || '').replace(new RegExp(`<img.*${cidRE}[\\s\\S]*?>`, 'igm'), '');
  // We no longer remove inline attachments from quoted body
  let transformed = body;
  transformed = await SanitizeTransformer.run(transformed, SanitizeTransformer.Preset.UnsafeOnly);
  transformed = await InlineStyleTransformer.run(transformed);
  return transformed;
}
const removeAttachmentWithNoContentId = files => {
  if (!Array.isArray(files)) {
    return [];
  }
  const ret = [];
  files.forEach(file => {
    // Because in the end, we use contentId to id which attachment goes where
    if (file && (typeof file.contentId === 'string') && file.contentId.length > 0) {
      ret.push(file);
    }
  });
  return ret;
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

class DraftFactory {
  async createDraft(fields = {}) {
    const account = this._accountForNewDraft();
    // const uniqueId = `${Math.floor(Date.now() / 1000)}.${Utils.generateTempId()}`;
    const uniqueId = uuid();
    const defaults = {
      body: '<br/>',
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
      replyOrForward: Message.draftType.new,
      hasNewID: false,
      accountId: account.id,
    };

    const merged = Object.assign(defaults, fields);
    if (merged.forwardedHeaderMessageId) {
      merged.referenceMessageId = merged.forwardedHeaderMessageId;
      delete merged.forwardedHeaderMessageId;
    } else {
      merged.referenceMessageId = merged.replyToHeaderMessageId;
    }
    await mergeDefaultBccAndCCs(merged, account);
    // const autoContacts = await ContactStore.parseContactsInString(account.autoaddress.value);
    // if (account.autoaddress.type === 'cc') {
    //   merged.cc = (merged.cc || []).concat(autoContacts);
    // }
    // if (account.autoaddress.type === 'bcc') {
    //   merged.bcc = (merged.bcc || []).concat(autoContacts);
    // }

    return new Message(merged);
  }
  async createInviteDraft(draftData){
    const draft = await this.createDraft(draftData);
    draft.noSave = true;
    return draft;
  }
  createNewDraftForEdit(draft){
    const uniqueId = uuid();
    const account = AccountStore.accountForId(draft.accountId);
    if (!account) {
      throw new Error(
        'DraftEditingSession::createNewDraftForEdit - you can only send drafts from a configured account.',
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
      hasRefOldDraftOnRemote: true,
      refOldDraftHeaderMessageId: draft.headerMessageId
    });
    return new Message(defaults);
  }

  async createReportBugDraft(logId, userFeedBack) {
    try {
      const account = this._accountForNewDraft();
      if (!account) {
        return null;
      }
      const body = `<div>
            <div>
            ${userFeedBack.replace(/[\r|\n]/g, '</br>')}
            </div>
            <div>
            [MacOS] ${AppEnv.config.get('core.support.native')}
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
  duplicateDraftBecauseOfNewId(draft){
    const uniqueId = uuid();
    const account = AccountStore.accountForId(draft.accountId);
    if (!account) {
      throw new Error(
        'DraftEditingSession::createNewDraftForEdit - you can only send drafts from a configured account.',
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
      refOldDraftHeaderMessageId: ''
    });
    return new Message(defaults);
  }
  async createOutboxDraftForEdit(draft){
    const uniqueId = uuid();
    const account = AccountStore.accountForId(draft.accountId);
    if (!account) {
      throw new Error(
        'DraftEditingSession::createOutboxDraftForEdit - you can only send drafts from a configured account.',
      );
    }
    const defaults = Object.assign({}, draft, {
      body: draft.body,
      version: 0,
      unread: false,
      starred: false,
      headerMessageId: `${uniqueId}@edison.tech`,
      id: uniqueId,
      date: new Date(),
      pristine: false,
      hasNewID: false,
      accountId: account.id
    });
    await mergeDefaultBccAndCCs(defaults, account);
    // const autoContacts = await ContactStore.parseContactsInString(account.autoaddress.value);
    // if (account.autoaddress.type === 'cc') {
    //   defaults.cc = (defaults.cc || []).concat(autoContacts);
    // }
    // if (account.autoaddress.type === 'bcc') {
    //   defaults.bcc = (defaults.bcc || []).concat(autoContacts);
    // }
    return new Message(defaults);
  }

  async copyDraftToAccount(draft, from) {
    const uniqueId = uuid();
    const account = AccountStore.accountForEmail(from[0].email);
    if (!account) {
      throw new Error(
        'DraftEditingSession::ensureCorrectAccount - you can only send drafts from a configured account.',
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
      replyOrForward: Message.draftType.new,
      threadId: '',
      replyToHeaderMessageId: '',
      forwardedHeaderMessageId: '',
      refOldDraftHeaderMessageId: '',
      savedOnRemote: false,
      hasRefOldDraftOnRemote: false,
      hasNewID: false,
      accountId: account.id,
    });
    await mergeDefaultBccAndCCs(defaults, account);
    return new Message(defaults);
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

    return this.createDraft({
      subject: Utils.subjectWithPrefix(message.subject, 'Re:'),
      to: participants.to,
      cc: participants.cc,
      from: [this._fromContactForReply(message)],
      files: removeAttachmentWithNoContentId(message.files),
      threadId: thread.id,
      accountId: message.accountId,
      replyOrForward: Message.draftType.reply,
      replyToHeaderMessageId: message.headerMessageId,
      msgOrigin: type === 'reply' ? Message.ReplyDraft : Message.ReplyAllDraft,
      body: `
        <br/>
        <br/>
        <div class="gmail_quote_attribution">${DOMUtils.escapeHTMLCharacters(
        message.replyAttributionLine(),
      )}</div>
        <blockquote class="gmail_quote" data-edison="true"
          style="margin:0 0 0 .8ex;border-left:1px #ccc solid;padding-left:1ex;">
          ${prevBody}
          <br/>
        </blockquote>
        `,
    });
  }
  async createReplyForEvent({ message, file, replyStatus, tos, me, replyEvent }) {
    return this.createDraft({
      subject: replyEvent.summary,
      to: tos,
      from: [this._fromContactForReply(message)],
      threadId: '',
      accountId: message.accountId,
      replyToHeaderMessageId: '',
      body: `${me.name} have replied with a status of ${replyStatus.label}`,
      files: [file],
      calTarStat: replyStatus.code,
      calendarReply: true
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

    return this.createDraft({
      subject: Utils.subjectWithPrefix(message.subject, 'Fwd:'),
      from: [this._fromContactForReply(message)],
      files: message.files,
      threadId: thread.id,
      accountId: message.accountId,
      forwardedHeaderMessageId: message.id,
      replyOrForward: Message.draftType.forward,
      msgOrigin: Message.ForwardDraft,
      body: `
        <br/>
        <div class="gmail_quote">
          <br>
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
    let replyToHeaderMessageId = threadMessageId;

    if (!replyToHeaderMessageId) {
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
      replyToHeaderMessageId = (msg && msg.headerMessageId) || '';
    }

    return this.createDraft({
      from: [new Contact({ email: account.emailAddress, name: `${account.name} via EdisonMail` })],
      to: [account.defaultMe()],
      cc: [],
      pristine: false,
      subject: thread.subject,
      threadId: thread.id,
      accountId: thread.accountId,
      replyToHeaderMessageId: replyToHeaderMessageId,
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
      other => other.replyToHeaderMessageId === message.headerMessageId && other.draft === true,
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
        candidateDrafts.map(candidateDraft =>
          DraftStore.sessionForClientId(candidateDraft.headerMessageId),
        ),
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
