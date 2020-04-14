import EventEmitter from 'events';
import MailspringStore from 'mailspring-store';
import { Conversion } from '../../components/composer-editor/composer-support';
import RegExpUtils from '../../regexp-utils';
import TaskQueue from './task-queue';
import Message from '../models/message';
import Utils from '../models/utils';
import Actions from '../actions';
import AccountStore from './account-store';
import ContactStore from './contact-store';
import FocusedContentStore from './focused-content-store';
import { Composer as ComposerExtensionRegistry } from '../../registries/extension-registry';
import QuotedHTMLTransformer from '../../services/quoted-html-transformer';
import SyncbackDraftTask from '../tasks/syncback-draft-task';
import DestroyDraftTask from '../tasks/destroy-draft-task';
import uuid from 'uuid';
import { ipcRenderer } from 'electron';
import _ from 'underscore';
import { DraftAttachmentState } from './attachment-store';

const { convertFromHTML, convertToHTML } = Conversion;
const MetadataChangePrefix = 'metadata.';
let DraftStore = null;

/**
 Public: As the user interacts with the draft, changes are accumulated in the
 DraftChangeSet associated with the store session.

 This class used to be more complex - now it's mostly a holdover from when
 we implemented undo/redo manually and just functions as a pass-through.

 Section: Drafts
 */
const SaveAfterIdleMSec = 10000;
const SaveAfterIdleSlushMSec = 2000;

class DraftChangeSet extends EventEmitter {
  constructor(callbacks) {
    super();
    this.callbacks = callbacks;
    this._timer = null;
    this._lastModifiedTimes = {};
    this._lastCommitTime = 0;
    this._draftDirty = false;
  }

  cancelCommit() {
    // console.log('cancel commits');
    if (this._timer) {
      clearTimeout(this._timer);
      this._timerStarted = null;
      this._timer = null;
    } else {
      console.log('no timer');
    }
  }

  add(changes, { skipSaving = false } = {}) {
    if (!skipSaving) {
      changes.pristine = false;
      changes.needUpload = true;
      // update the per-attribute flags that track our dirty state
      for (const key of Object.keys(changes)) this._lastModifiedTimes[key] = Date.now();
      if (changes.bodyEditorState) this._lastModifiedTimes.body = Date.now();
      if (changes.body) this._lastModifiedTimes.bodyEditorState = Date.now();
      changes.date = new Date();
      this.debounceCommit();
    }

    this.callbacks.onAddChanges(changes);
  }

  addPluginMetadata(pluginId, metadata) {
    this._lastModifiedTimes.pluginMetadata = Date.now();
    this.callbacks.onAddChanges({ [`${MetadataChangePrefix}${pluginId}`]: metadata });
    this.debounceCommit();
  }

  isDirty() {
    return this.dirtyFields().length > 0 || this._draftDirty;
  }
  onNewDraftFromOtherWindow() {
    this._draftDirty = true;
    this.debounceCommit();
  }

  dirtyFields() {
    return Object.keys(this._lastModifiedTimes).filter(
      key => this._lastModifiedTimes[key] > this._lastCommitTime
    );
  }

  debounceCommit() {
    if (!AppEnv.isMainWindow()) {
      return;
    }
    const now = Date.now();

    // If there's already a timer going and we started it recently,
    // it means it'll fire a bit early but that's ok. It's actually
    // pretty expensive to re-create a timer on every keystroke.
    if (this._timer && now - this._timerStarted < SaveAfterIdleSlushMSec) {
      return;
    }
    this.cancelCommit();
    this._timerStarted = now;
    this._timer = setTimeout(() => this.commit(), SaveAfterIdleMSec);
  }

  async commit(arg) {
    if (this.dirtyFields().length === 0 && !this._draftDirty && arg !== 'force') {
      return;
    }
    if (this._timer) {
      clearTimeout(this._timer);
    }
    await this.callbacks.onCommit(arg);
    this._lastCommitTime = Date.now();
    this._timer = null;
    this._lastModifiedTimes = {};
    this._draftDirty = false;
  }
}

function hotwireDraftBodyState(draft) {
  // Populate the bodyEditorState and override the draft properties
  // so that they're kept in sync with minimal recomputation
  // DC-107 work around when draft doesn't have body
  let _bodyHTMLCache = draft.body || '';
  let _bodyEditorState = null;

  draft.__bodyPropDescriptor = {
    configurable: true,
    get: function() {
      if (!_bodyHTMLCache) {
        console.log('building HTML body cache');
        _bodyHTMLCache = convertToHTML(_bodyEditorState);
      }
      return _bodyHTMLCache;
    },
    set: function(inHTML) {
      let nextValue = convertFromHTML(inHTML);
      if (draft.bodyEditorState) {
        // DC-1243 When doing full body replace, we first get the first block, and if it's not a div, we upwrap it, insert fragment, and then rewrap it, otherwise the first line will be unwrapped for some unknown reason.
        const firstBlock = draft.bodyEditorState
          .change()
          .value.document.getBlocks()
          .get(0);
        const firstParentBlock = draft.bodyEditorState
          .change()
          .value.document.getFurthestBlock(firstBlock.key);
        let blockType = 'div';
        if (firstParentBlock) {
          blockType = firstParentBlock.type;
        } else if (firstBlock) {
          blockType = firstBlock.type;
        }
        let newEditor = draft.bodyEditorState
          .change()
          .selectAll()
          .delete()
          .selectAll()
          .collapseToStart();
        if (blockType !== 'div') {
          newEditor = newEditor
            .unwrapBlock(blockType)
            .selectAll()
            .delete();
        }
        nextValue = newEditor
          .insertFragment(nextValue.document)
          .selectAll()
          .collapseToStart();
        if (blockType !== 'div') {
          nextValue = nextValue
            .wrapBlock(blockType)
            .selectAll()
            .collapseToStart();
        }
        nextValue = nextValue.value;
      }
      draft.bodyEditorState = nextValue;
      _bodyHTMLCache = inHTML;
    },
  };

  draft.__bodyEditorStatePropDescriptor = {
    configurable: true,
    get: function() {
      return _bodyEditorState;
    },
    set: function(next) {
      if (_bodyEditorState !== next) {
        _bodyHTMLCache = null;
      }
      _bodyEditorState = next;
    },
  };

  Object.defineProperty(draft, 'body', draft.__bodyPropDescriptor);
  Object.defineProperty(draft, 'bodyEditorState', draft.__bodyEditorStatePropDescriptor);
  draft.body = _bodyHTMLCache;
}

function fastCloneDraft(draft) {
  const next = new Message();
  for (const key of Object.getOwnPropertyNames(draft)) {
    if (key === 'body' || key === 'bodyEditorState') {
      continue;
    }
    next[key] = draft[key];
  }
  Object.defineProperty(next, 'body', next.__bodyPropDescriptor);
  Object.defineProperty(next, 'bodyEditorState', next.__bodyEditorStatePropDescriptor);
  return next;
}
export function cloneForSyncDraftData(draft) {
  const next = new Message();
  for (const key of Object.getOwnPropertyNames(draft)) {
    if (key === 'body' || key === 'bodyEditorState') {
      continue;
    }
    next[key] = draft[key];
  }
  next['body'] = draft.body;
  next['lastSync'] = Date.now();
  return next;
}

/**
 Public: DraftEditingSession is a small class that makes it easy to implement components
 that display Draft objects or allow for interactive editing of Drafts.

 1. It synchronously provides an instance of a draft via `draft()`, and
 triggers whenever that draft instance has changed.

 2. It provides an interface for modifying the draft that transparently
 batches changes, and ensures that the draft provided via `draft()`
 always has pending changes applied.

 Section: Drafts
 */
export default class DraftEditingSession extends MailspringStore {
  static DraftChangeSet = DraftChangeSet;

  constructor(messageId, draft = null, options = {}) {
    super();
    this._draft = false;
    this._destroyed = false;
    this._popedOut = false;
    this._needsSyncWithMain = false;
    this.lastSync = Date.now();
    let currentWindowLevel = 3;
    if (AppEnv.isMainWindow()) {
      currentWindowLevel = 1;
    } else if (AppEnv.isThreadWindow()) {
      currentWindowLevel = 2;
    } else if (AppEnv.isComposerWindow()) {
      currentWindowLevel = 3;
    }
    // Because new draft window will first shown as main window type,
    // We need to check windowProps;
    const windowProps = AppEnv.getWindowProps();
    if (windowProps.draftJSON) {
      currentWindowLevel = 3;
    }

    this.messageId = messageId;
    this.changes = new DraftChangeSet({
      onAddChanges: changes => this.changeSetApplyChanges(changes),
      onCommit: arg => this.changeSetCommit(arg), // for specs
    });

    this._registerListeners();
    if (draft) {
      hotwireDraftBodyState(draft);
      if (!Array.isArray(draft.from) || draft.from.length === 0) {
        const myAccount = AccountStore.accountForId(draft.accountId);
        if (myAccount) {
          draft.from = [myAccount.me()];
        } else {
          draft.from = [];
        }
      }
      if (draft.from[0] && !draft.from[0].accountId) {
        draft.from[0].accountId = draft.accountId;
      }
      this._draft = draft;
      this._draftPromise = Promise.resolve(draft);
      this._isDraftMissingAttachments();
      const thread = FocusedContentStore.focused('thread');
      const inFocusedThread = thread && thread.id === draft.threadId;
      if (currentWindowLevel === 3) {
        // Because new drafts can't be viewed in main window, we don't add it towards open count, if we are in mainWin
        // we want to trigger open count in composer window
        Actions.draftOpenCount({
          messageId: messageId,
          windowLevel: currentWindowLevel,
          source: `draft-editing-session, with draft level: ${currentWindowLevel}`,
        });
      } else if (draft.replyType !== Message.draftType.new) {
        if (currentWindowLevel === 2) {
          Actions.draftOpenCount({
            messageId: messageId,
            windowLevel: currentWindowLevel,
            source: `draft-editing-session, with draft level: ${currentWindowLevel}`,
          });
        } else if (currentWindowLevel === 1 && inFocusedThread) {
          Actions.draftOpenCount({
            messageId: messageId,
            windowLevel: currentWindowLevel,
            source: `draft-editing-session, with draft level: ${currentWindowLevel}`,
          });
        }
      }
    } else {
      let localPromise = DraftStore.findByMessageIdWithBody({
        messageId: this.messageId,
      }).limit(1);
      if (options.showFailed) {
        localPromise = DraftStore.findFailedByMessageIdWithBody({
          messageId: this.messageId,
        }).limit(1);
      }
      this._draftPromise = localPromise.then(draft => {
        if (this._destroyed) {
          AppEnv.reportWarning(`Draft loaded but session has been torn down.`);
          return;
        }
        if (!draft) {
          AppEnv.reportWarning(`Draft ${this.messageId} could not be found. Just deleted?`);
          return;
        }
        // if (Message.compareMessageState(draft.state, Message.messageState.failed)) {
        //   AppEnv.logDebug(`Draft ${draft.headerMessageId} state is failed, setting it to normal`);
        //   draft.state = Message.messageState.normal;
        // }
        if (!draft.body) {
          draft.waitingForBody = true;
          Actions.fetchBodies({ messages: [draft], source: 'draft' });
        }
        if (!Array.isArray(draft.from) || draft.from.length === 0) {
          const myAccount = AccountStore.accountForId(draft.accountId);
          if (myAccount) {
            draft.from = [myAccount.defaultMe()];
          } else {
            draft.from = [];
          }
        }
        if (draft.from[0] && !draft.from[0].accountId) {
          draft.from[0].accountId = draft.accountId;
        }
        if (Array.isArray(draft.from) && draft.from.length === 1) {
          if (draft.from[0].email.length === 0) {
            const currentAccount = AccountStore.accountForId(draft.accountId);
            if (currentAccount) {
              draft.from = [currentAccount.me()];
            }
          }
        }
        hotwireDraftBodyState(draft);
        if (draft.remoteUID) {
          draft.setOrigin(Message.EditExistingDraft);
        }
        this._draft = draft;
        this._threadId = draft.threadId;
        this._isDraftMissingAttachments();
        const thread = FocusedContentStore.focused('thread');
        const inFocusedThread = thread && thread.id === draft.threadId;
        if (currentWindowLevel === 2 || (currentWindowLevel === 1 && inFocusedThread)) {
          Actions.draftOpenCount({
            messageId: messageId,
            windowLevel: currentWindowLevel,
            source: `draft editing session, no draft ${currentWindowLevel}`,
          });
        }
        this.trigger();
      });
    }
  }

  get currentWindowLevel() {
    if (AppEnv.isMainWindow()) {
      return 1;
    } else if (AppEnv.isThreadWindow()) {
      return 2;
    } else if (AppEnv.isComposerWindow()) {
      return 3;
    } else {
      return 3;
    }
  }

  // Public: Returns the draft object with the latest changes applied.
  //
  draft() {
    return this._draft;
  }

  threadId() {
    return this._threadId;
  }

  prepare() {
    return this._draftPromise;
  }

  isPopout() {
    return this._popedOut;
  }
  isDestroyed() {
    return this._destroyed;
  }

  setPopout(val) {
    if (val !== this._popedOut) {
      if (this.changes && !val) {
        this.changes.cancelCommit();
        this.changeSetCommit();
      }
      this._popedOut = val;
      this.trigger();
    }
  }

  teardown() {
    this._destroyed = true;
    this._removeListeners();
  }

  freezeSession() {
    this._removeListeners();
  }

  resumeSession() {
    this._registerListeners();
  }
  closeSession({ cancelCommits = false, reason = 'unknown' } = {}) {
    if (cancelCommits) {
      this.changes.cancelCommit();
    } else {
      if (this.changes.isDirty() || this.needUpload) {
        this.changeSetCommit('unload');
      }
    }
    AppEnv.logDebug(
      `closing session of ${this.messageId} for ${reason} windowLevel: ${this.currentWindowLevel}`
    );
    this.teardown();
  }

  _registerListeners = () => {
    DraftStore = DraftStore || require('./draft-store').default;
    this.listenTo(DraftStore, this._onDraftChanged);
    this.listenTo(Actions.draftOpenCountBroadcast, this.onDraftOpenCountChange);
    this.listenTo(Actions.broadcastDraftAttachmentState, this._onDraftAttachmentStateChange);
    if (!AppEnv.isMainWindow()) {
      this.listenTo(Actions.broadcastDraftData, this._applySyncDraftData);
      // this.listenTo(Actions.syncDraftAttachments, this._onSyncAttachmentData);
    } else {
      this.listenTo(Actions.syncDraftDataToMain, this._applySyncDraftData);
      // this.listenTo(Actions.updateDraftAttachments, this.updateAttachments);
    }
  };
  _removeListeners = () => {
    this.stopListeningToAll();
    this.changes.cancelCommit();
  };

  validateDraftForChangeAccount() {
    const warnings = [];
    const errors = [];
    if (this._draft.waitingForAttachment) {
      warnings.push(`Attachments are still processing`);
    }
    return { errors, warnings };
  }

  validateDraftForSending() {
    const warnings = [];
    const errors = [];
    const allRecipients = [].concat(this._draft.to, this._draft.cc, this._draft.bcc);
    const hasAttachment = Array.isArray(this._draft.files) && this._draft.files.length > 0;
    if (this._draft.waitingForAttachment) {
      warnings.push(`Attachments are still processing`);
    }

    const allNames = [].concat(Utils.commonlyCapitalizedSalutations);
    let unnamedRecipientPresent = false;

    for (const contact of allRecipients) {
      if (!ContactStore.isValidContact(contact)) {
        errors.push(
          `${contact.email} is not a valid email address - please remove or edit it before sending.`
        );
      }
      const name = contact.fullName();
      if (name && name.length && name !== contact.email) {
        allNames.push(name.toLowerCase()); // ben gotow
        allNames.push(...name.toLowerCase().split(' ')); // ben, gotow
        allNames.push(contact.nameAbbreviation().toLowerCase()); // bg
        allNames.push(name.toLowerCase()[0]); // b
        allNames.push(...contact.nameSpecialCharacterStripping().map(n => n.toLocaleLowerCase()));
        allNames.push(...contact.nameOnlyLetters().map(n => n.toLocaleLowerCase()));
      } else {
        unnamedRecipientPresent = true;
      }
      if (Utils.likelyNonHumanEmail(contact.email)) {
        unnamedRecipientPresent = true;
      }
    }

    if (allRecipients.length === 0) {
      errors.push('You need to provide one or more recipients before sending the message.');
    }

    if (errors.length > 0) {
      return { errors, warnings };
    }

    if (this._draft.subject.length === 0) {
      warnings.push('without a subject line');
    }

    let cleaned = QuotedHTMLTransformer.removeQuotedHTML(this._draft.body.trim());
    const sigIndex = cleaned.search(RegExpUtils.mailspringSignatureRegex());
    cleaned = sigIndex > -1 ? cleaned.substr(0, sigIndex) : cleaned;

    const signatureIndex = cleaned.indexOf('<edo-signature>');
    if (signatureIndex !== -1) {
      cleaned = cleaned.substr(0, signatureIndex - 1);
    }

    if (cleaned.toLowerCase().includes('attach') && !hasAttachment) {
      warnings.push('without an attachment');
    }

    if (!unnamedRecipientPresent) {
      // https://www.regexpal.com/?fam=99334
      // note: requires that the name is capitalized, to avoid catching "Hey guys"
      const englishSalutationPhrases = /(?:[y|Y]o|[h|H]ey|[h|H]i|[M|m]orning|[A|a]fternoon|[E|e]vening|[D|d]ear){1} ([A-Z][A-Za-zÀ-ÿ. ]+)[!_—,.\n\r< -]/;
      const match = englishSalutationPhrases.exec(cleaned);
      if (match) {
        const salutation = (match[1] || '').toLowerCase();
        if (!allNames.find(n => n === salutation || (n.length > 1 && salutation.includes(n)))) {
          warnings.push(
            `addressed to a name that doesn't appear to be a recipient ("${salutation}")`
          );
        }
      }
    }

    // Check third party warnings added via Composer extensions
    for (const extension of ComposerExtensionRegistry.extensions()) {
      if (!extension.warningsForSending) {
        continue;
      }
      warnings.push(...extension.warningsForSending({ draft: this._draft }));
    }

    return { errors, warnings };
  }

  _isDraftMissingAttachments = () => {
    if (typeof this._draft.missingAttachments !== 'function') {
      console.error('missing attachments is not a function');
      return;
    }
    this._draft.missingAttachments().then(missingAttachments => {
      if (!this) {
        return;
      }
      if (!this._draft) {
        return;
      }
      if (this._destroyed) {
        return;
      }
      let totalMissing =
        missingAttachments.inline.needToDownload.length +
        missingAttachments.inline.downloading.length +
        missingAttachments.normal.needToDownload.length +
        missingAttachments.normal.downloading.length;
      if (totalMissing > 0) {
        if (!this._draft.waitingForAttachment) {
          this._draft.waitingForAttachment = true;
          console.log('attachment state changed');
          this.trigger();
        }
      } else {
        if (this._draft.waitingForAttachment || this._draft.waitingForAttachment === undefined) {
          this._draft.waitingForAttachment = false;
          console.log('attachment state changed to false');
          this.trigger();
        }
      }
    });
  };
  _onPastMessageChange = pastMsgId => {
    if (!this._draft || !pastMsgId) {
      return;
    }
    if ((this._draft.pastMessageIds || []).includes(pastMsgId)) {
      console.log(`past draft changed ${pastMsgId}`);
      this._isDraftMissingAttachments();
      this.trigger();
    }
  };

  _onDraftChanged = change => {
    if (change === undefined || change.type !== 'persist') {
      return;
    }
    if (!this._draft) {
      // We don't accept changes unless our draft object is loaded
      console.log(`draft not ready @ windowLevel ${this.currentWindowLevel}`);
      return;
    }

    // Some change events just tell us that the state of the draft (eg sending state)
    // have changed and don't include a payload.
    if (change.messageId) {
      if (change.messageId === this._draft.id) {
        // console.log('triggered data change');
        this.trigger();
      } else {
        this._onPastMessageChange(change.id);
      }
      return;
    }
    if (Array.isArray(change.messageIds)) {
      if (change.messageIds.includes(this.draft.id)) {
        this.trigger();
      }
      return;
    }

    const nextDraft = change.objects.filter(obj => obj.id === this._draft.id).pop();

    if (!nextDraft) {
      for (let msg of change.objects) {
        this._onPastMessageChange(msg.id);
      }
      return;
    }
    let changed = false;
    // if (nextDraft.id !== this._draft.id) {
    //   this._draft.id = nextDraft.id;
    //   ipcRenderer.send('draft-got-new-id', {
    //     newHeaderMessageId: this._draft.headerMessageId,
    //     oldHeaderMessageId: this._draft.headerMessageId,
    //     newMessageId: this._draft.id,
    //     referenceMessageId: this._draft.referenceMessageId,
    //     threadId: this._draft.threadId,
    //     windowLevel: this.currentWindowLevel,
    //   });
    //   changed = true;
    // }
    if (this._draft.waitingForBody || !this._draft.body) {
      DraftStore.findByMessageIdWithBody({
        messageId: this.messageId,
      })
        .limit(1)
        .then(draft => {
          if (this._destroyed) {
            console.warn(`Draft loaded but session has been torn down.`);
            return;
          }
          if (!draft) {
            console.warn(`Draft ${this.messageId} could not be found. Just deleted?`);
            return;
          }
          hotwireDraftBodyState(draft);
          if (this._draft) {
            draft.waitingForAttachment = this._draft.waitingForAttachment;
          }
          this._draft = draft;
          this.trigger();
        });
      return;
    }

    // If the session has unsaved changes for a given field (eg: 'to' or 'body'),
    // we don't accept changes from the database. All changes to the draft should
    // be made through the editing session and we don't want to overwrite the user's
    // work under any scenario.
    // Above does not apply when current session is "poped out",
    // meaning user is not changing session in current window,
    // thus we should reflect all changes from database
    const lockedFields = this.changes.dirtyFields();
    for (const [key] of Object.entries(Message.attributes)) {
      if (key === 'headerMessageId') continue;
      if (key === 'id') continue;
      if (nextDraft[key] === undefined) continue;
      if ((this._draft || {})[key] === nextDraft[key]) continue;
      if (lockedFields.includes(key) && !this.isPopout()) continue;

      if (changed === false) {
        this._draft = fastCloneDraft(this._draft);
        changed = true;
      }
      if (key === 'body' && nextDraft[key].length === 0) {
        console.log('body is empty, ignoring');
        continue;
      }
      if (key === 'pastMessageIds') {
        console.log('ignoring pastMessageIds change');
        continue;
      }
      if (key === 'from' && Array.isArray(nextDraft.from) && nextDraft.from.length > 0) {
        nextDraft.from[0].accountId = nextDraft.accountId;
      }
      (this._draft || {})[key] = nextDraft[key];
    }

    if (changed) {
      // console.log('triggered data change');
      this.trigger();
    } else {
      // console.log('no changes');
    }
  };
  cancelCommit() {
    this.changes.cancelCommit();
  }

  async changeSetCommit(reason = '') {
    // if (this._destroyed || !this._draft || this._popedOut) {
    //   return;
    // }
    if (!this._draft) {
      return;
    }
    //if id is empty, we assign uuid to id;
    if (!this._draft.id || this._draft.id === '') {
      AppEnv.reportError(
        new Error(`Draft id is empty assigning new id for draft ${JSON.stringify(this._draft)}`)
      );
      this._draft.id = uuid();
    }
    if (reason === 'unload') {
      this._draft.hasNewID = false;
      this.needUpload = false;
      this._draft.savedOnRemote = true;
    }
    if (this.changes._draftDirty) {
      this.changes._draftDirty = false;
    }
    const task = new SyncbackDraftTask({ draft: this._draft, source: reason });
    task.saveOnRemote = reason === 'unload';
    try {
      await TaskQueue.waitForPerformLocal(task, { sendTask: true });
    } catch (e) {
      AppEnv.reportError(
        new Error('SyncbackDraft Task not returned'),
        { errorData: task },
        { grabLogs: true }
      );
    }
  }
  set needUpload(val) {
    this._draft.needUpload = val;
  }

  get needUpload() {
    return this._draft.needUpload;
  }
  set needsSyncToMain(val) {
    if (!AppEnv.isMainWindow()) {
      this._needsSyncWithMain = val;
    } else {
      this._needsSyncWithMain = false;
    }
  }
  get needsSyncToMain() {
    return !AppEnv.isMainWindow() && this._needsSyncWithMain;
  }
  updateAttachments(files) {
    if (this._draft && Array.isArray(files)) {
      this._draft.files = files;
      this.needUpload = true;
      this._draft.pristine = false;
      this.needsSyncToMain = true;
      if (!AppEnv.isMainWindow()) {
        this.syncDraftDataToMainNow({ forceCommit: true });
      } else {
        this.changeSetCommit(`attachments change`);
      }
      //
      // this._syncAttachmentData();
    } else {
      console.error(`either draft or files data incorrect, attachments for draft not updated`);
    }
  }

  changeSetApplyChanges = changes => {
    if (this._destroyed) {
      return;
    }
    if (!this._draft) {
      throw new Error('DraftChangeSet was modified before the draft was prepared.');
    }

    this._draft = fastCloneDraft(this._draft);

    for (const [key, val] of Object.entries(changes)) {
      if (key.startsWith(MetadataChangePrefix)) {
        this._draft.directlyAttachMetadata(key.split(MetadataChangePrefix).pop(), val);
      } else {
        this._draft[key] = val;
      }
    }
    this.trigger();
    this.needsSyncToMain = true;
    this._syncDraftDataToMain();
  };
  // _syncAttachmentData = () => {
  //   if(!this._draft){
  //     AppEnv.reportError(new Error(`Draft is null, cannot trigger attachment sync`), {}, {grabLogs: true});
  //     return;
  //   }
  //   if(AppEnv.isMainWindow()){
  //     console.log(`syncing attachments ${this._draft.headerMessageId} to none main window`);
  //     Actions.syncDraftAttachments({headerMessageId: this._draft.headerMessageId, files: this._draft.files});
  //   } else {
  //     AppEnv.logWarning('called in none main window, sync ignored');
  //   }
  // };
  // _onSyncAttachmentData = ({headerMessageId, files}) => {
  //   if(!this._draft){
  //     AppEnv.reportError(new Error(`Draft is null, cannot trigger attachment sync`), {}, {grabLogs: true});
  //     return;
  //   }
  //   if(AppEnv.isMainWindow()){
  //     AppEnv.logWarning('called in none main window, sync ignored');
  //     return;
  //   }
  //   if(!headerMessageId || !Array.isArray(files)){
  //     AppEnv.reportError(new Error(`headerMessageId or files incorrect, igonring`), {errorData: {headerMessageId, files}}, {grabLogs: true});
  //     return;
  //   }
  //   if(headerMessageId === this._draft.headerMessageId){
  //     this._draft.files = files;
  //     this.needUpload = true;
  //     this._draft.pristine = false;
  //     console.log(`non main window attachment updated`);
  //     this.trigger()
  //   }
  // };
  _onDraftAttachmentStateChange = ({ messageId, draftState }) => {
    if (!this._draft) {
      return;
    }
    if (messageId !== this._draft.id) {
      console.log(`${messageId} is not current draft ${this._draft.id}`);
      return;
    }
    this._isDraftMissingAttachments();
    // const iswaitingForAttachment = draftState === DraftAttachmentState.busy;
    // if(iswaitingForAttachment !== this._draft.waitingForAttachment){
    //   this._draft.waitingForAttachment = iswaitingForAttachment;
    //   console.log(`Attachment state changed to ${iswaitingForAttachment}`);
    //   this.trigger()
    // } else {
    //   console.log(`Attachment state not changed because target is ${iswaitingForAttachment} current is ${this._draft.waitingForAttachment}`);
    // }
  };
  localApplySyncDraftData = ({ syncData = {} } = {}) => {
    if (syncData && typeof syncData.lastSync === 'number' && syncData.lastSync > this.lastSync) {
      this._applySyncDraftData({ syncData, sourceLevel: 0, broadcastDraftData: false });
    } else {
      AppEnv.logInfo(`syncData.lastSync ${syncData.lastSync}, local lastSync ${this.lastSync}`);
    }
  };

  _applySyncDraftData({
    syncData = {},
    sourceLevel = 0,
    broadcastDraftData = true,
    trigger = true,
    forceCommit = false,
  } = {}) {
    if (sourceLevel !== this.currentWindowLevel && syncData.id === this._draft.id) {
      AppEnv.logDebug('apply sync draft data');
      const nothingChanged =
        this._draft['body'] === syncData.body &&
        JSON.stringify(this._draft.from) === JSON.stringify(syncData.from) &&
        JSON.stringify(this._draft.to) === JSON.stringify(syncData.to) &&
        JSON.stringify(this._draft.bcc) === JSON.stringify(syncData.bcc) &&
        JSON.stringify(this._draft.cc) === JSON.stringify(syncData.cc) &&
        JSON.stringify(this._draft.files) === JSON.stringify(syncData.files) &&
        this._draft.subject === syncData.subject;
      for (const key of Object.getOwnPropertyNames(syncData)) {
        if (key === 'body' || key === 'bodyEditorState' || key === 'waitingForAttachment') {
          continue;
        }
        if (key === 'from' && Array.isArray(syncData.from) && syncData.from.length > 0) {
          syncData.from[0].accountId = syncData.accountId;
        }
        this._draft[key] = syncData[key];
      }
      this._draft['body'] = syncData.body;
      this.lastSync = syncData.lastSync;
      if (trigger) {
        this.trigger();
      }
      if (AppEnv.isMainWindow()) {
        if (broadcastDraftData) {
          Actions.broadcastDraftData({ syncData, sourceLevel });
        }

        if (!nothingChanged) {
          AppEnv.logDebug('things changed');
          this.needUpload = true;
          if (forceCommit) {
            this.changeSetCommit('forced to commit by applySyncDraftData');
          } else {
            this.changes.onNewDraftFromOtherWindow();
          }
        }
      }
    }
  }

  syncDraftDataToMainNow = ({ forceCommit = false } = {}) => {
    if (this.needsSyncToMain) {
      AppEnv.logDebug('sync draft to main');
      this.needsSyncToMain = false;
      const syncData = cloneForSyncDraftData(this._draft);
      Actions.syncDraftDataToMain({ syncData, sourceLevel: this.currentWindowLevel, forceCommit });
    }
  };

  _syncDraftDataToMain = _.debounce(this.syncDraftDataToMainNow, 1500);

  onDraftOpenCountChange = ({ messageId, data = {} }) => {
    AppEnv.logDebug(`draft open count change ${messageId}`);
    if (this._draft && messageId === this._draft.id) {
      AppEnv.logDebug('draft open count change');
      let level = 3;
      let changedToTrue = false;
      while (level > this.currentWindowLevel) {
        if (data[level]) {
          this.setPopout(true);
          changedToTrue = true;
          break;
        }
        level = level - 1;
      }
      if (!changedToTrue) {
        this.setPopout(false);
      }
    }
  };
}
