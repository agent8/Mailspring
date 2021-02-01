import fs from 'fs';
import EventEmitter from 'events';
import MailspringStore from 'mailspring-store';
import { Conversion } from '../../components/composer-editor/composer-support';
import RegExpUtils from '../../regexp-utils';
import DraftCacheStore from './draft-cache-store';
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
import uuid from 'uuid';
import RestoreDraftTask from '../tasks/restore-draft-task';
import { WindowLevel } from '../../constant';

const { convertFromHTML, convertToHTML } = Conversion;
const MetadataChangePrefix = 'metadata.';
let DraftStore = null;
let attachmentStore = null;
const AttachmentStore = () => {
  attachmentStore = attachmentStore || require('./attachment-store').default;
  return attachmentStore;
};
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
      if (!changes.files || changes.files.every(f => !f.isSigOrTempAttachments)) {
        changes.pristine = false;
      }

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
    this._timer = setTimeout(() => this.commit('debounceCommit'), SaveAfterIdleMSec);
  }

  async commit(arg, force = false) {
    if (this.dirtyFields().length === 0 && !this._draftDirty && arg !== 'force' && !force) {
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
      _bodyHTMLCache = inHTML;
      try {
        draft.bodyEditorState = convertFromHTML(inHTML, draft.defaultValues);
      } catch (e) {
        AppEnv.reportError(e, { errorData: { htm: inHTML, id: (draft || {}).id } });
      }
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
    this._isChangingAccount = false;
    this.refOldDraftMessageId = '';
    this.lastSync = Date.now();
    let currentWindowLevel = WindowLevel.Composer;
    if (AppEnv.isMainWindow()) {
      currentWindowLevel = WindowLevel.Main;
    } else if (AppEnv.isThreadWindow()) {
      currentWindowLevel = WindowLevel.Thread;
    } else if (AppEnv.isComposerWindow()) {
      currentWindowLevel = WindowLevel.Composer;
    }
    // Because new draft window will first shown as main window type,
    // We need to check windowProps;
    const windowProps = AppEnv.getWindowProps();
    if (windowProps.draftJSON) {
      currentWindowLevel = WindowLevel.Composer;
    }

    this.messageId = messageId;
    this.changes = new DraftChangeSet({
      onAddChanges: changes => this.changeSetApplyChanges(changes),
      onCommit: arg => this.changeSetCommit(arg), // for specs
    });

    this._registerListeners();
    const needUpload = DraftStore.clearSaveOnRemoteTaskTimer(messageId);
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
      this.refOldDraftMessageId = draft.refOldDraftMessageId;
      if (needUpload) {
        this.needUpload = true;
      }
      this._draftPromise = Promise.resolve(draft);
      const thread = FocusedContentStore.focused('thread');
      const inFocusedThread = thread && thread.id === draft.threadId;
      if (currentWindowLevel === WindowLevel.Composer) {
        // Because new drafts can't be viewed in main window, we don't add it towards open count, if we are in mainWin
        // we want to trigger open count in composer window
        Actions.draftOpenCount({
          messageId: messageId,
          windowLevel: currentWindowLevel,
          source: `draft-editing-session, with draft level: ${currentWindowLevel}`,
        });
      } else if (draft.replyType !== Message.draftType.new) {
        if (currentWindowLevel === WindowLevel.Thread) {
          Actions.draftOpenCount({
            messageId: messageId,
            windowLevel: currentWindowLevel,
            source: `draft-editing-session, with draft level: ${currentWindowLevel}`,
          });
        } else if (currentWindowLevel === WindowLevel.Main && inFocusedThread) {
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
          AppEnv.reportWarning(`Draft ${this.messageId} could not be found in DB. Just deleted?`);
          draft = DraftCacheStore.findDraftById(this.messageId);
        }
        if (!draft) {
          AppEnv.reportWarning(`Draft ${this.messageId} could not be found in draft cache.`);
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
        this.refOldDraftMessageId = draft.refOldDraftMessageId;
        if (needUpload) {
          this.needUpload = true;
        }
        this._threadId = draft.threadId;
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
      return WindowLevel.Main;
    } else if (AppEnv.isThreadWindow()) {
      return WindowLevel.Thread;
    } else if (AppEnv.isComposerWindow()) {
      return WindowLevel.Composer;
    } else {
      return WindowLevel.Composer;
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
  changingAccount() {
    this._isChangingAccount = true;
  }

  setPopout(val) {
    if (val !== this._popedOut) {
      if (this.changes && !val) {
        this.changes.cancelCommit();
        this.changeSetCommit('setPopout');
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
    AppEnv.logDebug(`Freezing sessions ${this.messageId}`);
    this._removeListeners();
  }

  resumeSession() {
    this._registerListeners();
  }
  _restoreDraft = () => {
    if (
      this._draft &&
      !this._draft.savedOnRemote &&
      this._draft.refOldDraftMessageId &&
      !Message.compareMessageState(this._draft.syncState, Message.messageSyncState.failed) &&
      AppEnv.isMainWindow()
    ) {
      const task = new RestoreDraftTask({
        deleteMessageId: this._draft.id,
        restoreMessageId: this._draft.refOldDraftMessageId,
        accountId: this._draft.accountId,
      });
      Actions.queueTask(task);
      return true;
    }
    AppEnv.logDebug(`no need to restore draft`);
    return false;
  };
  closeSession({ cancelCommits = false, reason = 'unknown' } = {}) {
    if (cancelCommits) {
      this.changes.cancelCommit();
    } else {
      if (this.changes.isDirty() || this.needUpload) {
        this.changeSetCommit('unload');
        // } else if (this.needUpload) {
        //   if (!this._restoreDraft()) {
        //     console.warn('no need to restore draft');
        //     this.changeSetCommit('unload');
        //   }
      } else {
        this._restoreDraft();
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
    return new Promise(resolve => {
      if (this._draft) {
        this._draft.missingAttachments().then(ret => {
          if (ret && ret.totalMissing().length > 0) {
            warnings.push(`while attachments are still processing`);
          }
          resolve({ errors, warnings });
        });
      } else {
        resolve({ errors, warnings });
      }
    });
  }

  validateDraftForSending() {
    const warnings = [];
    const errors = [];
    const allRecipients = [].concat(this._draft.to, this._draft.cc, this._draft.bcc);
    const hasAttachment = Array.isArray(this._draft.files) && this._draft.files.length > 0;

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
      return Promise.resolve({ errors, warnings });
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
      //   // https://www.regexpal.com/?fam=99334
      //   // note: requires that the name is capitalized, to avoid catching "Hey guys"
      //   const englishSalutationPhrases = /(?:[y|Y]o|[h|H]ey|[h|H]i|[M|m]orning|[A|a]fternoon|[E|e]vening|[D|d]ear){1} ([A-Z][A-Za-zÀ-ÿ. ]+)[!_—,.\n\r< -]/;
      //   const match = englishSalutationPhrases.exec(cleaned);
      //   if (match) {
      //     const salutation = (match[1] || '').toLowerCase();
      //     if (!allNames.find(n => n === salutation || (n.length > 1 && salutation.includes(n)))) {
      //       warnings.push(
      //         `addressed to a name that doesn't appear to be a recipient ("${salutation}")`
      //       );
      //     }
      //   }
    }

    // Check third party warnings added via Composer extensions
    for (const extension of ComposerExtensionRegistry.extensions()) {
      if (!extension.warningsForSending) {
        continue;
      }
      warnings.push(...extension.warningsForSending({ draft: this._draft }));
    }
    return new Promise(resolve => {
      if (this._draft) {
        this._draft.missingAttachments().then(ret => {
          if (ret && ret.totalMissing().length > 0) {
            warnings.push(`while attachments are still processing`);
          }
          resolve({ errors, warnings });
        });
      } else {
        resolve({ errors, warnings });
      }
    });
  }

  _onPastMessageChange = pastMsgId => {
    if (!this._draft || !pastMsgId) {
      return;
    }
    if ((this._draft.pastMessageIds || []).includes(pastMsgId)) {
      console.log(`past draft changed ${pastMsgId}`);
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
    if (this._isChangingAccount) {
      AppEnv.logDebug(`${this.messageId} is changing account thus ${reason} for commit is ignored`);
      return Promise.resolve();
    }
    // if (this._destroyed || !this._draft || this._popedOut) {
    //   return;
    // }
    if (!this._draft) {
      return Promise.resolve();
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
      // this._draft.savedOnRemote = true;
    }
    if (this.changes._draftDirty) {
      this.changes._draftDirty = false;
    }
    const task = new SyncbackDraftTask({ draft: this._draft, source: reason });
    // We delay saveOnRemote
    if (reason === 'unload' && AppEnv.isMainWindow()) {
      DraftStore.pushSaveOnRemoteTask(task);
    } else {
      const needUpload = DraftStore.clearSaveOnRemoteTaskTimer(this._draft.id);
      if (needUpload) {
        this.needUpload = true;
      }
    }
    const taskPromise = TaskQueue.waitForPerformLocal(task, { sendTask: true });
    const draftCachePromise = new Promise(resolve => {
      //We give Actions.queueTasks time to trigger DraftCacheStore
      setTimeout(() => {
        const cache = DraftCacheStore.findDraft(this._draft);
        if (cache) {
          resolve({ draftCache: true });
        }
      }, 300);
    });
    return Promise.race([taskPromise, draftCachePromise]).then(data => {
      if (data && data.draftCache) {
        AppEnv.reportLog(`For ${this._draft.id}, draftCache returned first in commit 300ms`);
      }
      return Promise.resolve();
    });
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
  updateAttachments(files, { commit = true } = {}) {
    if (this._draft && Array.isArray(files)) {
      this._draft.files = files;
      this.needUpload = true;
      if (files.every(f => !f.isSigOrTempAttachments)) {
        this._draft.pristine = false;
      }
      this.needsSyncToMain = true;
      console.log(`commit ${commit}`);
      if (!AppEnv.isMainWindow()) {
        this.syncDraftDataToMainNow({ forceCommit: commit });
      } else if (commit) {
        this.changeSetCommit(`attachments change`);
      }
    } else {
      console.error(`either draft or files data incorrect, attachments for draft not updated`);
    }
  }
  removeMissingAttachments = () => {
    if (this._draft && Array.isArray(this._draft.files) && this._draft.files.length > 0) {
      return new Promise(resolve => {
        let processed = 0;
        const total = this._draft.files.length;
        const ret = [];
        this._draft.files.forEach(f => {
          const path = AttachmentStore().pathForFile(f);
          fs.access(path, fs.constants.R_OK, err => {
            processed++;
            if (!err) {
              ret.push(f);
            }
            if (processed === total) {
              this.updateAttachments(ret);
              resolve();
            }
          });
        });
      });
    } else {
      return Promise.resolve();
    }
  };

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
  };
  _onDraftAttachmentStateChange = ({ messageId, draftState }) => {
    if (!this._draft) {
      return;
    }
    if (messageId !== this._draft.id) {
      console.log(`${messageId} is not current draft ${this._draft.id}`);
      return;
    }
    this.trigger();
  };
  localSyncDraftDataBeforeSent = ({ syncData = {} } = {}) => {
    // DC-2104 we no longer need lastSync data, as localSyncDraftDataBeforeSent is only called right before send draft, thus this data is the newest
    // The original Date.now() is not always reliable since system time can be automatically updated by OS
    AppEnv.logDebug(
      `Applying draft sync data before sent draft ${syncData ? syncData.id : 'undefined'}`
    );
    this._applySyncDraftData({ syncData, sourceLevel: 0, broadcastDraftData: false });
  };

  _applySyncDraftData({
    syncData = {},
    sourceLevel = 0,
    broadcastDraftData = true,
    trigger = true,
    forceCommit = false,
  } = {}) {
    if (sourceLevel !== this.currentWindowLevel && syncData.id === this._draft.id) {
      AppEnv.logDebug(`apply sync draft data ${syncData.id} sourceLevel ${sourceLevel}`);
      const nothingChanged =
        this._draft['body'] === syncData.body &&
        JSON.stringify(this._draft.from) === JSON.stringify(syncData.from) &&
        JSON.stringify(this._draft.to) === JSON.stringify(syncData.to) &&
        JSON.stringify(this._draft.bcc) === JSON.stringify(syncData.bcc) &&
        JSON.stringify(this._draft.cc) === JSON.stringify(syncData.cc) &&
        this._draft.files.map(f => f.id).join('-') === syncData.files.map(f => f.id).join('-') &&
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
          AppEnv.logDebug(`things changed ${syncData.id}`);
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

  onDraftOpenCountChange = ({ messageId, data = {} }) => {
    AppEnv.logDebug(`draft open count change ${messageId}`);
    if (this._draft && messageId === this._draft.id) {
      AppEnv.logDebug(`draft open count change processing ${messageId} `);
      let level = WindowLevel.Composer;
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
