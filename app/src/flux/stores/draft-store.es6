import { ipcRenderer, remote } from 'electron';
import MailspringStore from 'mailspring-store';
import DraftEditingSession, { cloneForSyncDraftData } from './draft-editing-session';
import DraftFactory from './draft-factory';
import DatabaseStore from './database-store';
import SendActionsStore from './send-actions-store';
import SyncbackDraftTask from '../tasks/syncback-draft-task';
import SyncbackMetadataTask from '../tasks/syncback-metadata-task';
import SendDraftTask, { SendTaskDisplayErrors } from '../tasks/send-draft-task';
import DestroyDraftTask from '../tasks/destroy-draft-task';
import Thread from '../models/thread';
import Message from '../models/message';
import Contact from '../models/contact';
import Actions from '../actions';
import TaskQueue from './task-queue';
import MessageBodyProcessor from './message-body-processor';
import SoundRegistry from '../../registries/sound-registry';
import * as ExtensionRegistry from '../../registries/extension-registry';
import MessageStore from './message-store';
import UndoRedoStore from './undo-redo-store';
import TaskFactory from '../tasks/task-factory';
import ChangeDraftToFailingTask from '../tasks/change-draft-to-failing-task';
import ChangeDraftToFailedTask from '../tasks/change-draft-to-failed-task';
import FocusedContentStore from './focused-content-store';
import SentProgress from '../models/sent-progress';
let AttachmentStore = null;
const { DefaultSendActionKey } = SendActionsStore;
const SendDraftTimeout = 300000;
const DraftFailingBaseTimeout = 120000;
const SaveOnRemoteDelayInMs = 5000;

/*
Public: DraftStore responds to Actions that interact with Drafts and exposes
public getter methods to return Draft objects and sessions.

It also creates and queues {Task} objects to persist changes to the Nylas
API.

Remember that a "Draft" is actually just a "Message" with `draft: true`.

Section: Drafts
*/
class DraftStore extends MailspringStore {
  constructor() {
    super();
    this.listenTo(DatabaseStore, this._onDataChanged);
    this.listenTo(Actions.draftDeliveryFailed, this._onSendDraftFailed);
    this.listenTo(Actions.draftDeliverySucceeded, this._onSendDraftSuccess);
    this.listenTo(Actions.sendingDraft, this._onSendingDraft);
    this.listenTo(Actions.destroyDraftFailed, this._onDestroyDraftFailed);
    this.listenTo(Actions.destroyDraftSucceeded, this._onDestroyDraftSuccess);
    this.listenTo(Actions.destroyDraft, this._onDestroyDrafts);
    this.listenTo(Actions.sendDraft, this._onSendDraftAction);
    this.listenTo(Actions.changeDraftAccount, this._onDraftAccountChangeAction);
    this.listenTo(Actions.draftInlineAttachmentRemoved, this._onInlineItemRemoved);
    if (AppEnv.isMainWindow()) {
      this.listenTo(Actions.toMainSendDraft, this._onSendDraft);
      this.listenTo(Actions.toMainChangeDraftAccount, this._onDraftAccountChange);
      this.listenTo(Actions.composeReply, this._onComposeReply);
      this.listenTo(Actions.composeForward, this._onComposeForward);
      this.listenTo(Actions.cancelOutboxDrafts, this._onOutboxCancelDraft);
      this.listenTo(Actions.resendDrafts, this._onResendDraft);
      this.listenTo(Actions.editOutboxDraft, this._onEditOutboxDraft);
      this.listenTo(Actions.composeFailedPopoutDraft, this._onPopoutDraft);
      this.listenTo(Actions.composePopoutDraft, this._onPopoutDraft);
      this.listenTo(Actions.composeNewBlankDraft, this._onPopoutBlankDraft);
      this.listenTo(Actions.composeNewDraftToRecipient, this._onPopoutNewDraftToRecipient);
      this.listenTo(Actions.composeInviteDraft, this._onPopoutInviteDraft);
      this.listenTo(Actions.sendBugDraft, this._sendBugDraft);
      this.listenTo(Actions.composeFeedBackDraft, this._onPopoutFeedbackDraft);
      this.listenTo(Actions.sendQuickReply, this._onSendQuickReply);
      this.listenTo(Actions.failingDraft, this._startDraftFailingTimeout);
      this.listenTo(Actions.draftOpenCount, this._onDraftOpenCount);
      this.listenTo(Actions.draftWindowClosing, this._onDraftWindowClosing);
      this.listenTo(TaskQueue, this._restartTimerForOldSendDraftTasks);
      this._startTime = Date.now();
      ipcRenderer.on('new-message', () => {
        // From app menu and shortcut
        Actions.composeNewBlankDraft();
      });

      ipcRenderer.on('composeFeedBack', (event, data) => {
        const account = DraftFactory._accountForNewDraft();
        if (account) {
          data.subject += 'from ' + account.name;
        }
        data.body = `<br/><br/><br/>
                    [MacOS] ${AppEnv.getVersion()}<br/>
                    SupportId: ${AppEnv.config.get('core.support.id')}`;
        Actions.composeFeedBackDraft(data);
      });

      ipcRenderer.on('composeInvite', (event, data) => {
        Actions.composeInviteDraft(data);
      });

      // send mail Immediately
      ipcRenderer.on('action-send-now', (event, messageId, actionKey) => {
        Actions.sendDraft(messageId, { actionKey, delay: 0, source: 'Undo timeout' });
      });
    }
    ipcRenderer.on('action-send-cancelled', (event, messageId, actionKey) => {
      AppEnv.debugLog(`Undo Send received ${messageId}`);
      if (AppEnv.isMainWindow()) {
        AppEnv.debugLog(
          `Undo Send received ${messageId} main window sending draftDeliveryCancelled`
        );
        Actions.draftDeliveryCancelled({ messageId, actionKey });
      }
      this._onSendDraftCancelled({ messageId });
    });
    // popout closed
    // ipcRenderer.on('draft-close-window', this._onPopoutClosed);
    // ipcRenderer.on('draft-got-new-id', this._onDraftGotNewId);
    // ipcRenderer.on('draft-arp', this._onDraftArp);
    // ipcRenderer.on('draft-delete', this._onDraftDeleting);
    AppEnv.onBeforeUnload(this._onBeforeUnload);

    this._draftSessions = {};
    this._draftsSending = {};
    this._draftSendingTimeouts = {};
    this._draftFailingTimeouts = {};
    this._draftSaveOnRemoteDelays = {};
    this._draftsDeleting = {}; //Using messageId
    this._draftsDeleted = {};
    this._draftsOpenCount = {};
    ipcRenderer.on('mailto', this._onHandleMailtoLink);
    ipcRenderer.on('mailfiles', this._onHandleMailFiles);
  }

  findFailedByMessageId({ messageId = '' } = {}) {
    return DatabaseStore.findBy(Message, {
      id: messageId,
      draft: true,
      deleted: false,
    }).where([Message.attributes.syncState.in([Message.messageSyncState.failed])]);
  }

  findByMessageId({ messageId = '' } = {}) {
    return DatabaseStore.findBy(Message, {
      id: messageId,
      draft: true,
      hasCalendar: false,
      deleted: false,
    }).where([
      Message.attributes.syncState.in([
        Message.messageSyncState.normal,
        Message.messageSyncState.saving,
        Message.messageSyncState.sending,
        Message.messageSyncState.updatingNoUID,
        Message.messageSyncState.updatingHasUID,
        Message.messageSyncState.failing,
        Message.messageSyncState.failed,
      ]),
    ]);
  }

  findFailedByMessageIdWithBody({ messageId = '' } = {}) {
    return this.findFailedByMessageId({ messageId }).linkDB(Message.attributes.body);
  }

  findByMessageIdWithBody({ messageId = '' } = {}) {
    return this.findByMessageId({ messageId }).linkDB(Message.attributes.body);
  }

  findAllWithBodyInDescendingOrder() {
    return MessageStore.findAllWithBodyInDescendingOrder().where({
      draft: true,
      hasCalendar: false,
      inAllMail: true,
    });
  }

  /**
   Fetch a {DraftEditingSession} for displaying and/or editing the
   draft with `messageId`.

   @param {String} messageId - The messageId of the draft.
   @param options
   @returns {Promise} - Resolves to an {DraftEditingSession} for the draft once it has been prepared
   */
  async sessionForClientId(messageId, options = {}) {
    if (!messageId) {
      throw new Error('DraftStore::sessionForClientId requires a messageId');
    }
    if (!this._draftSessions[messageId]) {
      this._draftSessions[messageId] = this._createSession(messageId, null, options);
    } else {
      const draft = this._draftSessions[messageId].draft();
      if (!draft) {
        AppEnv.reportWarning('session exist, but not draft');
      } else if (!this._draftsOpenCount[messageId]) {
        AppEnv.reportLog(
          `draft and session exist, but draftOpenCount not available, ${messageId}, ${this._getCurrentWindowLevel()}`
        );
      } else {
        const thread = FocusedContentStore.focused('thread');
        const inFocusedThread = thread && thread.id === draft.threadId;
        if (AppEnv.isMainWindow() && inFocusedThread && !this._draftsOpenCount[messageId][1]) {
          AppEnv.logDebug(
            `Only trigger open draft count if in main window, in focus thread, and current opencount is not set`
          );
          this._onDraftOpenCount({
            messageId: messageId,
            windowLevel: this._getCurrentWindowLevel(),
            source: `draft store, session already exist ${messageId}, ${this._getCurrentWindowLevel()}`,
          });
        }
      }
    }
    AppEnv.logDebug(`waiting for ${messageId} session.prepare()`);
    await this._draftSessions[messageId].prepare();
    AppEnv.logDebug(`${messageId} session.prepare() returned`);
    if (AppEnv.isMainWindow()) {
      AttachmentStore = AttachmentStore || require('./attachment-store').default;
      AttachmentStore.addDraftToAttachmentCache(this._draftSessions[messageId].draft());
    }
    return this._draftSessions[messageId];
  }

  async sessionForServerDraft(draft) {
    if (this.isDraftWaitingSaveOnRemote(draft.id)) {
      AppEnv.logWarning(`Draft ${draft.id} is still waiting for saveOnRemote`);
      const needUpload = this.clearSaveOnRemoteTaskTimer(draft.id);
      const session = await this.sessionForClientId(draft.id);
      if (session && needUpload) {
        session.needUpload = true;
      }
      return session;
    }
    const newDraft = DraftFactory.createNewDraftForEdit(draft);
    await this._finalizeAndPersistNewMessage(newDraft);
    const session = this._draftSessions[newDraft.id];
    // if (session) {
    //   console.warn('need upload');
    //   session.needUpload = true;
    // }
    return session;
  }

  // Public: Look up the sending state of the given draft messageId.
  // In popout windows the existence of the window is the sending state.
  isSendingDraft(messageId) {
    return !!this._draftsSending[messageId] || false;
  }
  isDraftWaitingSaveOnRemote = messageId => {
    return this._draftSaveOnRemoteDelays[messageId];
  };
  clearSaveOnRemoteTaskTimer = messageId => {
    if (!messageId) {
      AppEnv.logError(new Error('MessageId is empty'));
      return false;
    }
    if (this._draftSaveOnRemoteDelays[messageId]) {
      if (this._draftSaveOnRemoteDelays[messageId].timer) {
        AppEnv.logDebug(`Clearing draftSaveOnRemoteDelays timer for ${messageId}`);
        clearTimeout(this._draftSaveOnRemoteDelays[messageId].timer);
      }
      AppEnv.logDebug(`Clearing draftSaveOnRemoteDelays cache for ${messageId}`);
      delete this._draftSaveOnRemoteDelays[messageId];
      return true;
    }
    return false;
  };
  pushSaveOnRemoteTask = task => {
    if (!AppEnv.isMainWindow()) {
      AppEnv.logDebug('Not in main window, ignoring saveOnRemote');
      return;
    }
    if (!task) {
      AppEnv.logError(new Error('Task is empty'));
      return;
    }
    this.clearSaveOnRemoteTaskTimer(task.messageId);
    const messageId = task.messageId;
    this._draftSaveOnRemoteDelays[messageId] = {
      timer: null,
      task: new SyncbackDraftTask({ draft: task.draft, ...task }),
    };
    this._draftSaveOnRemoteDelays[messageId].timer = setTimeout(() => {
      if (
        this._draftSaveOnRemoteDelays[messageId] &&
        this._draftSaveOnRemoteDelays[messageId].task
      ) {
        this._draftSaveOnRemoteDelays[messageId].task.saveOnRemote = true;
        AppEnv.logDebug(`Sending save on remote task for ${messageId}`);
        Actions.queueTasks([this._draftSaveOnRemoteDelays[messageId].task]);
      }
      AppEnv.logDebug(`Clearing draftSaveOnRemoteDelays cache for ${messageId}`);
      delete this._draftSaveOnRemoteDelays[messageId];
    }, SaveOnRemoteDelayInMs);
  };

  _restartTimerForOldSendDraftTasks() {
    if (!this._startTime) {
      AppEnv.logDebug(`previous tasks restarted, stop listening to taskQueue change`);
      this.stopListeningTo(TaskQueue);
      return;
    }
    AppEnv.logDebug(`restarting previous send draft tasks`);
    const pastSendDraftTasks = TaskQueue.queue().filter(t => {
      if (t instanceof SendDraftTask) {
        return t.createdAt && this._startTime && t.createdAt.getTime() < this._startTime;
      }
      return false;
    });
    this._startTime = null;
    pastSendDraftTasks.forEach(t => {
      if (t && t.draft) {
        AppEnv.logDebug(`Restarted SendDraft for draft: ${t.draft.id}`);
        this._draftsSending[t.draft.id] = true;
        this._startSendingDraftTimeouts({
          draft: t.draft,
          taskId: t.id,
          source: 'Restart SendDraft',
        });
      }
    });
  }
  _onInlineItemRemoved = contentId => {
    console.log('removing inline', contentId);
    if (!contentId) {
      return;
    }
    //We are assuming contentId will be unique within our store
    for (let session of Object.values(this._draftSessions)) {
      if (!session) {
        continue;
      }
      const draft = session.draft();
      if (draft && Array.isArray(draft.files)) {
        const matching = draft.files.some(f => f.contentId === contentId);
        if (matching) {
          console.log('match found for draft', draft.id);
          session.updateAttachments(draft.files.filter(f => f.contentId !== contentId));
          break;
        }
      }
    }
  };

  _onDraftAccountChangeAction = (data = {}) => {
    const { originalMessageId } = data;
    if (!originalMessageId) {
      AppEnv.logError(`no originalMessageId found`);
      return;
    }
    const session = this._draftSessions[originalMessageId];
    if (!session) {
      AppEnv.logError(`no originalMessageId session`);
      return;
    }
    const { errors, warnings } = session.validateDraftForChangeAccount();
    const dialog = remote.dialog;
    if (warnings.length > 0) {
      dialog
        .showMessageBox(remote.getCurrentWindow(), {
          type: 'warning',
          buttons: ['Yes', 'Cancel'],
          message: 'Draft not ready, change anyways? This will remove all draft attachments.',
          detail: `${warnings.join(' and ')}?`,
        })
        .then(({ response } = {}) => {
          if (response === 0) {
            session.changes.add({ files: [] });
            session.updateAttachments([]);
            if (AppEnv.isMainWindow()) {
              this._onDraftAccountChange(data);
            } else {
              this._onDraftAccountChanged_NotMainWindow(data);
            }
            return true;
          }
        });
      return false;
    }
    if (AppEnv.isMainWindow()) {
      this._onDraftAccountChange(data);
    } else {
      this._onDraftAccountChanged_NotMainWindow(data);
    }
  };

  _onDraftAccountChanged_NotMainWindow = ({
    originalMessageId,
    originalHeaderMessageId,
    newParticipants,
  }) => {
    const session = this._draftSessions[originalMessageId];
    if (AppEnv.isComposerWindow() || AppEnv.isThreadWindow()) {
      if (session) {
        session.syncDraftDataToMainNow();
        this._doneWithSession(session, 'draft account change');
      }
      Actions.toMainChangeDraftAccount({
        originalHeaderMessageId,
        originalMessageId,
        newParticipants,
      });
      return;
    }
  };

  _onDraftAccountChange = async ({
    originalMessageId,
    originalHeaderMessageId,
    newParticipants,
  }) => {
    const session = this._draftSessions[originalMessageId];
    await session.changes.commit();
    session.freezeSession();
    const oldDraft = session.draft();
    if (!oldDraft) {
      console.error('How can old not available');
      return;
    }
    oldDraft.cc = newParticipants.cc;
    oldDraft.bcc = newParticipants.bcc;
    const newDraft = await DraftFactory.copyDraftToAccount(oldDraft, newParticipants.from);
    const draftCount = this._draftsOpenCount[originalMessageId];
    await this._finalizeAndPersistNewMessage(newDraft, { popout: !draftCount[3] });
    Actions.changeDraftAccountComplete({
      newDraftJSON: newDraft.toJSON(),
      originalHeaderMessageId,
      originalMessageId,
    });
    this._onDestroyDrafts(
      [
        new Message(
          Object.assign({}, oldDraft, {
            headerMessageId: originalHeaderMessageId,
            id: originalMessageId,
          })
        ),
      ],
      { switchingAccount: true, canBeUndone: false, source: 'onDraftAccountChange' }
    );
  };

  _doneWithDraft(messageId, reason = 'unknown') {
    const session = this._draftSessions[messageId];
    if (session) {
      this._doneWithSession(session, reason);
    }
  }

  _doneWithSession(session, reason = 'unknown') {
    if (!session) {
      AppEnv.reportError(
        new Error('Calling _doneWithSession when session is null'),
        {
          errorData: {
            sending: this._draftsSending,
            deleting: this._draftsDeleting,
            deleted: this._draftsDeleted,
            openCount: this._draftsOpenCount,
            reason,
          },
        },
        { grabLogs: true }
      );
      return;
    }
    session.teardown();
    delete this._draftSessions[session.messageId];
    AppEnv.debugLog(`Session for ${session.messageId} removed, reason: ${reason}`);
  }

  _cleanupAllSessions() {
    Object.values(this._draftSessions).forEach(session => {
      this._doneWithSession(session, '_cleanupAllSessions');
    });
  }

  _onOutboxCancelDraft = ({ messages = [], source } = {}) => {
    const tasks = TaskFactory.tasksForCancellingOutboxDrafts({ messages, source });
    if (tasks && tasks.length > 0) {
      Actions.queueTasks(tasks);
    } else {
      AppEnv.reportError(
        new Error('Tasks for cancellingOutboxDraft is empty'),
        {
          errorData: {
            messages,
            source,
          },
        },
        { grabLogs: true }
      );
    }
    messages.forEach(message => {
      if (message) {
        const session = this._draftSessions[message.id];
        if (session) {
          this._doneWithSession(session, 'CancelDraft');
        }
        const sending = this._draftsSending[message.id];
        if (sending) {
          this._onSendDraftCancelled({
            messageId: message.id,
            resumeSession: false,
          });
        }
        const deleting = this._draftsDeleting[message.id];
        if (!deleting) {
          this._onDestroyDraft(message, { source: 'onCancelOutboxDraft' });
        }
      }
    });
  };

  _onResendDraft = async ({ messages = [], source = '' } = {}) => {
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const session = this._draftSessions[message.id];
      if (!session) {
        await this.sessionForClientId(message.id, { showFailed: true });
      }
      this._onSendDraft(message.id);
    }
  };
  _onDraftOpenCount = ({ messageId, windowLevel = 0, source = '' }) => {
    if (!AppEnv.isMainWindow()) {
      AppEnv.logWarning(`open count not main window source: ${source}`);
      return;
    }
    if (windowLevel === 0) {
      AppEnv.reportError(new Error('draftOpenCount action windowLevel is 0, wrong parameters'));
      return;
    }
    AppEnv.logDebug(`${messageId} open count source: ${source} windowLevel: ${windowLevel}`);
    if (!this._draftsOpenCount[messageId]) {
      this._draftsOpenCount[messageId] = {
        1: false,
        2: false,
        3: false,
      };
    }
    this._draftsOpenCount[messageId][windowLevel] = true;
    if (AppEnv.isMainWindow()) {
      if (windowLevel > 1) {
        const session = this._draftSessions[messageId];
        if (session) {
          session.setPopout(true);
        } else {
          AppEnv.debugLog(
            `No session but draft is open in none main window, ${messageId} from window ${windowLevel}`
          );
          this.sessionForClientId(messageId).then(session => {
            AppEnv.debugLog(
              `Session created in main because none main window draft open ${messageId}, window ${windowLevel}`
            );
            session.setPopout(true);
          });
        }
      }
      Actions.draftOpenCountBroadcast({
        messageId: messageId,
        data: this._draftsOpenCount[messageId],
      });
    }
  };

  _onDraftWindowClosing = ({ messageIds = [], windowLevel = 0, source = '' } = {}) => {
    if (!AppEnv.isMainWindow()) {
      AppEnv.logDebug(`draft closing, not main window source: ${source}`);
      return;
    }
    AppEnv.logDebug(`draft closing ${source}, ${messageIds}, window level ${windowLevel}`);
    messageIds.forEach(messageId => {
      if (this._draftsOpenCount[messageId]) {
        this._draftsOpenCount[messageId][windowLevel] = false;
      }
      const openDrafts = this._draftsOpenCount[messageId];
      if (!openDrafts) {
        return;
      }
      const allClosed = !openDrafts[`1`] && !openDrafts['2'] && !openDrafts['3'];
      if (allClosed) {
        delete this._draftsOpenCount[messageId];
        this._onLastOpenDraftClosed(messageId);
      } else {
        Actions.draftOpenCountBroadcast({
          messageId: messageId,
          data: this._draftsOpenCount[messageId],
        });
      }
    });
  };
  _onLastOpenDraftClosed = messageId => {
    if (this._draftsDeleted[messageId] || this._draftsDeleting[messageId]) {
      AppEnv.logDebug(`lastOpenDraftClosed draft ${messageId} was delete`);
      delete this._draftsDeleted[messageId];
      this._doneWithDraft(messageId, 'onLastOpenDraftClosed:reason draft was delete');
      return;
    }
    if (this._draftsSending[messageId]) {
      AppEnv.logDebug(`lastOpenDraftClosed draft ${messageId} was sending`);
      this._doneWithDraft(messageId, 'onLastOpenDraftClosed:draft was sending');
      return;
    }
    const session = this._draftSessions[messageId];
    if (!session) {
      AppEnv.reportError(
        `lastOpenDraftClosed draft session not available, messageId ${messageId}`,
        {
          errorData: {
            sending: this._draftsSending,
            deleting: this._draftsDeleting,
            deleted: this._draftsDeleted,
            openCount: this._draftsOpenCount,
          },
        },
        { grabLogs: true }
      );
      return;
    }
    const draft = session.draft();
    if (!draft) {
      AppEnv.reportError(
        new Error(`session has no draft, messageId ${messageId}`),
        {
          errorData: {
            sending: this._draftsSending,
            deleting: this._draftsDeleting,
            deleted: this._draftsDeleted,
            openCount: this._draftsOpenCount,
          },
        },
        { grabLogs: true }
      );
    }
    let cancelCommits = false;
    if (draft.pristine && !draft.hasRefOldDraftOnRemote) {
      if (this._draftsDeleting[draft.id] || this._draftsDeleted[draft.id]) {
        AppEnv.reportError(
          new Error(`Draft is deleting, should not have send delete again ${messageId}`),
          {
            errorData: {
              sending: this._draftsSending,
              deleting: this._draftsDeleting,
              deleted: this._draftsDeleted,
              openCount: this._draftsOpenCount,
            },
          },
          { grabLogs: true }
        );
      } else if (this._draftsSending[draft.id]) {
        AppEnv.reportError(
          new Error(`Draft is sending, should not have send delete again ${messageId}`),
          {
            errorData: {
              sending: this._draftsSending,
              deleting: this._draftsDeleting,
              deleted: this._draftsDeleted,
              openCount: this._draftsOpenCount,
            },
          },
          { grabLogs: true }
        );
      } else {
        // console.log('draft have no change and not on remote, destroying');
        Actions.destroyDraft([draft], { canBeUndone: false, source: 'onLastOpenDraftClosed' });
        cancelCommits = true;
      }
    }
    session.closeSession({ cancelCommits, reason: 'onLastOpenDraftClosed' });
    this._doneWithDraft(messageId, 'onLastOpenDraftClosed');
    if (!cancelCommits) {
      AttachmentStore = AttachmentStore || require('./attachment-store').default;
      AttachmentStore.removeDraftAttachmentCache(draft);
    }
  };
  _syncSessionDataToMain = () => {
    if (!AppEnv.isMainWindow()) {
      for (let key of Object.keys(this._draftSessions)) {
        if (!this.isSendingDraft(key) && !this._draftsDeleting[key] && !this._draftsDeleted[key]) {
          const session = this._draftSessions[key];
          if (session) {
            session.syncDraftDataToMainNow();
          }
        }
      }
    }
  };

  _onBeforeUnload = readyToUnload => {
    if (AppEnv.isOnboardingWindow() || AppEnv.isEmptyWindow() || AppEnv.isBugReportingWindow()) {
      console.log(`Is not proper window or is empty window ${AppEnv.isEmptyWindow()}`);
      return true;
    }
    const promises = [];
    if (!AppEnv.isMainWindow()) {
      AppEnv.debugLog('closing none main window');
      this._syncSessionDataToMain();
      if (AppEnv.isComposerWindow()) {
        const keys = Object.keys(this._draftSessions);
        if (keys.length > 1) {
          AppEnv.reportError(
            new Error(
              `More than one session remaining when closing composer window sessions: ${JSON.stringify(
                keys
              )}`,
              {},
              { grabLogs: true }
            )
          );
          return true;
        }
      }
      Actions.draftWindowClosing({
        messageIds: Object.keys(this._draftSessions),
        source: 'beforeUnload',
        windowLevel: this._getCurrentWindowLevel(),
      });
    } else {
      // Normally we'd just append all promises, even the ones already
      // fulfilled (nothing to save), but in this case we only want to
      // block window closing if we have to do real work. Calling
      // window.close() within on onbeforeunload could do weird things.
      Object.values(this._draftSessions).forEach(session => {
        const draft = session.draft();
        // if draft.id is empty, use headerMessageId
        if (!draft.id && draft.headerMessageId) {
          draft.id = draft.headerMessageId;
        }
        if (!draft || !draft.id) {
          return;
        }

        // Only delete pristine drafts and is not from server, aka savedOnRemote=0.
        // Because we are moving all actions to main window,
        // thus if main window is closed, we should be closing all other windows.
        if (draft.pristine && !draft.savedOnRemote) {
          if (!this._draftsDeleting[draft.id]) {
            promises.push(
              Actions.destroyDraft([draft], { canBeUndone: false, source: 'onBeforeUnload' })
            );
          }
        } else {
          promises.push(session.closeSession({ reason: 'onBeforeUnload' }));
        }
        // else if (
        //   AppEnv.isMainWindow() &&
        //   (session.changes.isDirty() || session.needUpload()) &&
        //   !session.isPopout() &&
        //   !this._draftsDeleting[draft.id]
        // ) {
        //   promises.push(session.changes.commit('unload'));
        // } else if (
        //   !AppEnv.isMainWindow() &&
        //   (session.changes.isDirty() || session.needUpload()) &&
        //   !session.isPopout() &&
        //   !this._draftsDeleting[draft.id]
        // ) {
        //   promises.push(session.changes.commit('unload'));
        // }
        // promises.push(ipcRenderer.send('close-window', {
        //   headerMessageId: draft.headerMessageId,
        //   threadId: draft.threadId,
        //   windowLevel: this._getCurrentWindowLevel(),
        //   additionalChannelParam: 'draft',
        // }));
      });
    }
    if (promises.length > 0) {
      let done = () => {
        done = null;
        this._draftSessions = {};
        // We have to wait for accumulateAndTrigger() in the DatabaseStore to
        // send events to ActionBridge before closing the window.
        setTimeout(readyToUnload, 15);
        AppEnv.debugLog('running done()');
      };

      // Stop and wait before closing, but never wait for more than 700ms.
      // We may not be able to save the draft once the main window has closed
      // and the mailsync bridge is unavailable, don't want to hang forever.
      setTimeout(() => {
        if (done) {
          AppEnv.debugLog('we waited long enough');
          done();
        }
      }, 700);
      Promise.all(promises).then(() => {
        if (done) done();
      });
      return false;
    }

    // Continue closing
    return true;
  };

  _onSentProgress = progress => {
    if (!AppEnv.isMainWindow()) {
      console.log('not main window, ignoring');
      return;
    }
    if (!progress) {
      console.log('progress empty, ignoring');
      return;
    }
    if (!(progress instanceof SentProgress)) {
      console.log('progress not SentProgress, ignoring');
      return;
    }
    const messageId = progress.id;
    const sendingTimeouts = this._draftSendingTimeouts[messageId];
    if (sendingTimeouts) {
      AppEnv.logDebug(`Restarting draft failed timout for ${messageId}`);
      const taskId = sendingTimeouts.taskId;
      this._cancelDraftFailedTimeout({ messageId });
      this._startSendingDraftFailedTimeout({
        draft: { accountId: progress.accountId, id: messageId },
        taskId,
        source: 'restart on sent progress',
      });
    }
  };

  _onDataChanged = change => {
    if (change.objectClass === SentProgress.name) {
      change.objects.forEach(progress => this._onSentProgress(progress));
      return;
    }
    if (change.objectClass !== Message.name) {
      return;
    }
    const pastMessageIds = [];
    Object.values(this._draftSessions).forEach(session => {
      const draft = session.draft();
      if (draft && Array.isArray(draft.pastMessageIds)) {
        pastMessageIds.push(...draft.pastMessageIds);
      }
    });
    const drafts = change.objects.filter(
      msg => (msg.draft && !msg.calendarReply) || pastMessageIds.includes(msg.id)
    );
    if (drafts.length === 0) {
      return;
    }

    // if the user has canceled an undo send, ensure we no longer show "sending..."
    // this is a fake status!
    for (const draft of drafts) {
      if (this._draftsSending[draft.id]) {
        const m = draft.metadataForPluginId('send-later');
        if (m && m.isUndoSend && !m.expiration) {
          this._cancelSendingDraftTimeout({ messageId: draft.id });
        }
      }
    }

    // allow draft editing sessions to update
    this.trigger(change);
    // update drafts that are not in view;
    // this._onDraftIdChange(change);
  };

  _onSendQuickReply = async ({ thread, threadId, message, messageId }, body) => {
    if (AppEnv.config.get('core.sending.sounds')) {
      SoundRegistry.playSound('hit-send');
    }
    const msg = await MessageStore.findByMessageIdWithBody({ messageId: message.id });
    if (msg) {
      message.body = msg.body;
    }
    return Promise.props(this._modelifyContext({ thread, threadId, message, messageId }))
      .then(({ message: m, thread: t }) => {
        return DraftFactory.createDraftForReply({ message: m, thread: t, type: 'reply' });
      })
      .then(draft => {
        draft.body = `${body}\n\n${draft.body}`;
        draft.pristine = false;

        // const t = new SyncbackDraftTask({ draft });
        // // console.error('send quickly');
        // Actions.queueTask(t);
        // TaskQueue.waitForPerformLocal(t)

        this._finalizeAndPersistNewMessage(draft)
          .then(() => {
            Actions.sendDraft(draft.id, { source: 'SendQuickReply' });
          })
          .catch(e => {
            AppEnv.reportError(
              new Error('SyncbackDraft Task not returned'),
              { errorData: e },
              { grabLogs: true }
            );
          });
      });
  };

  _onComposeReply = ({ thread, threadId, message, messageId, popout, type, behavior }) => {
    return Promise.props(this._modelifyContext({ thread, threadId, message, messageId }))
      .then(({ message: m, thread: t }) => {
        return DraftFactory.createOrUpdateDraftForReply({ message: m, thread: t, type, behavior });
      })
      .then(draft => {
        return this._finalizeAndPersistNewMessage(
          draft,
          { popout },
          {
            originalMessageId: message ? message.id : null,
            messageType: type,
          }
        );
      });
  };

  _onComposeForward = async ({ thread, threadId, message, messageId, popout }) => {
    return Promise.props(this._modelifyContext({ thread, threadId, message, messageId }))
      .then(({ thread: t, message: m }) => {
        return DraftFactory.createDraftForForward({ thread: t, message: m });
      })
      .then(draft => {
        return this._finalizeAndPersistNewMessage(
          draft,
          { popout },
          {
            originalMessageId: message ? message.id : null,
            messageType: 'forward',
          }
        );
      });
  };

  _modelifyContext({ thread, threadId, message, messageId }) {
    const queries = {};
    if (thread) {
      if (!(thread instanceof Thread)) {
        throw new Error(
          'newMessageWithContext: `thread` present, expected a Model. Maybe you wanted to pass `threadId`?'
        );
      }
      queries.thread = thread;
    } else if (threadId != null) {
      queries.thread = DatabaseStore.find(Thread, threadId);
    } else {
      throw new Error('newMessageWithContext: `thread` or `threadId` is required.');
    }

    if (message) {
      if (!(message instanceof Message)) {
        throw new Error(
          'newMessageWithContext: `message` present, expected a Model. Maybe you wanted to pass `messageId`?'
        );
      }
      queries.message = message;
    } else if (messageId != null) {
      queries.message = MessageStore.findByMessageIdWithBody({ messageId });
    } else {
      queries.message = MessageStore.findAllByThreadIdWithBodyInDescendingOrder({
        threadId: threadId || thread.id,
      })
        .limit(10)
        .then(messages => {
          return messages.find(m => !m.isHidden());
        });
    }

    return queries;
  }

  _finalizeAndPersistNewMessage(draft, { popout } = {}, { originalMessageId, messageType } = {}) {
    // Give extensions an opportunity to perform additional setup to the draft
    ExtensionRegistry.Composer.extensions().forEach(extension => {
      if (!extension.prepareNewDraft) {
        return;
      }
      extension.prepareNewDraft({ draft });
    });

    // Optimistically create a draft session and hand it the draft so that it
    // doesn't need to do a query for it a second from now when the composer wants it.
    const session = this._createSession(draft.id, draft);
    const task = new SyncbackDraftTask({ draft });
    const needUpload = this.clearSaveOnRemoteTaskTimer(draft.id);
    if (needUpload) {
      session.needUpload = true;
    }
    return TaskQueue.waitForPerformLocal(task, { sendTask: true })
      .then(() => {
        if (popout) {
          console.log('\n-------\n draft popout\n');
          this._onPopoutDraft(draft.id);
        }
        if (originalMessageId) {
          Actions.draftReplyForwardCreated({ messageId: originalMessageId, type: messageType });
        }
        return { messageId: draft.id, draft };
      })
      .catch(t => {
        AppEnv.reportError(
          new Error('SyncbackDraft Task not returned'),
          { errorData: task },
          { grabLogs: true }
        );
        return { messageId: draft.id, draft };
      });
  }

  _createSession(messageId, draft, options = {}) {
    // console.error('creat draft session');
    this._draftSessions[messageId] = new DraftEditingSession(messageId, draft, options);
    return this._draftSessions[messageId];
  }

  _sendBugDraft = async ({ logId, userFeedback }) => {
    const draft = await DraftFactory.createReportBugDraft(logId, userFeedback);
    if (draft) {
      const task = SendDraftTask.forSending(draft);
      if (task) {
        Actions.queueTask(task);
      }
    }
  };

  _onPopoutInviteDraft = async ({ to, subject = '', body } = {}) => {
    const draftData = {
      subject,
    };
    if (to) {
      const toContact = Contact.fromObject(to);
      draftData.to = [toContact];
    }
    if (body) {
      draftData.body = body;
    }
    AppEnv.logDebug(`Creating invite draft`);
    const draft = await DraftFactory.createInviteDraft(draftData);
    await this._finalizeAndPersistNewMessage(draft, { popout: true });
    AppEnv.logDebug(`Created invite draft: ${draft.id}`);
  };

  _onPopoutFeedbackDraft = async ({ to, subject = '', body } = {}) => {
    const draftData = {
      subject,
    };
    if (to) {
      const toContact = Contact.fromObject(to);
      draftData.to = [toContact];
    }
    if (body) {
      draftData.body = body;
    }
    const draft = await DraftFactory.createDraft(draftData);
    await this._finalizeAndPersistNewMessage(draft, { popout: true });
  };

  _onPopoutNewDraftToRecipient = async contact => {
    const draft = await DraftFactory.createDraft({ to: [contact] });
    await this._finalizeAndPersistNewMessage(draft, { popout: true });
  };

  _onPopoutBlankDraft = async () => {
    const draft = await DraftFactory.createDraft();
    const { messageId } = await this._finalizeAndPersistNewMessage(draft);
    await this._onPopoutDraft(messageId, { newDraft: true });
    Actions.composedNewBlankDraft();
  };

  _onEditOutboxDraft = async (messageId, options = {}) => {
    if (messageId == null) {
      throw new Error('DraftStore::onPopoutDraftId - You must provide a messageId');
    }
    this._onPopoutDraft(messageId, {
      source: 'edit outbox draft',
      forceCommit: true,
      showFailed: true,
    });
  };

  _onPopoutDraft = async (messageId, options = {}) => {
    if (messageId == null) {
      throw new Error('DraftStore::onPopoutDraftId - You must provide a messageId');
    }
    if (options.source) {
      AppEnv.logDebug(`Draft ${messageId} popedout because ${options.source}`);
    }
    const session = await this.sessionForClientId(messageId, options);
    const draft = session.draft();
    if (!draft) {
      AppEnv.reportError(
        new Error(
          `DraftStore::onPopoutDraft - session.draft() is false, draft not ready. messageId: ${messageId} because ${options.source}`
        ),
        { errorData: { options } },
        { grabLogs: true }
      );
      return;
    }
    if (draft.savedOnRemote) {
      this._doneWithSession(session, 'savedOnRemote');
      this.sessionForServerDraft(draft).then(newSession => {
        const newDraft = newSession.draft();
        newSession.setPopout(true);
        // console.warn('need upload');
        // newSession.needUpload = true;
        const draftJSON = newSession.draft().toJSON();
        AppEnv.newWindow({
          hidden: true, // We manually show in ComposerWithWindowProps::onDraftReady
          messageId: newDraft.id,
          windowType: 'composer',
          windowKey: `composer-${newDraft.id}`,
          windowProps: Object.assign(options, {
            messageId: newDraft.id,
            draftJSON,
          }),
          title: ' ',
          threadId: newSession.draft().threadId,
        });
        AttachmentStore = AttachmentStore || require('./attachment-store').default;
        AttachmentStore.removeDraftAttachmentCache({
          accountId: draft.accountId,
          id: draft.id,
          reason: 'sessionForServerDraft',
        });
      });
    } else {
      const messageId = session.draft().id;
      if (this._draftsDeleting[messageId] || this.isSendingDraft(messageId)) {
        AppEnv.reportError(
          new Error(
            `Attempting to open draft-id:${messageId} when it is being deleted or sending. this._draftDeleting: ${this._draftsDeleting}, this._draftSending: ${this._draftsSending}`
          )
        );
        return;
      }
      if (options.forceCommit) {
        await session.changes.commit('force');
      } else {
        await session.changes.commit();
      }
      session.setPopout(true);
      const draftJSON = session.draft().toJSON();
      // Since we pass a windowKey, if the popout composer draft already
      // exists we'll simply show that one instead of spawning a whole new
      // window.
      AppEnv.debugLog(`Draft popout, draft was not savedOnRemote ${messageId}`);
      AppEnv.newWindow({
        hidden: true, // We manually show in ComposerWithWindowProps::onDraftReady
        messageId: messageId,
        windowType: 'composer',
        windowKey: `composer-${messageId}`,
        windowProps: Object.assign(options, { messageId, draftJSON }),
        title: ' ',
        threadId: session.draft().threadId,
      });
    }
  };

  _onHandleMailtoLink = async (event, urlString) => {
    // returned promise is just used for specs
    const draft = await DraftFactory.createDraftForMailto(urlString);
    try {
      await this._finalizeAndPersistNewMessage(draft, { popout: true });
    } catch (err) {
      AppEnv.showErrorDialog(err.toString());
    }
  };

  _onHandleMailFiles = async (event, paths) => {
    // returned promise is just used for specs
    const draft = await DraftFactory.createDraft();
    const { messageId } = await this._finalizeAndPersistNewMessage(draft);

    let remaining = paths.length;
    const callback = () => {
      remaining -= 1;
      if (remaining === 0) {
        this._onPopoutDraft(messageId);
      }
    };

    paths.forEach(path => {
      Actions.addAttachment({
        filePath: path,
        accountId: draft.accountId,
        messageId,
        onCreated: callback,
      });
    });
  };

  _onDestroyDrafts = (messages = [], opts = {}) => {
    if (AppEnv.isThreadWindow()) {
      // console.log('on destroy draft is thread window');
      return;
    }
    if (AppEnv.isComposerWindow() && messages.length === 1) {
      if (this._draftSessions[messages[0].id] && !opts.switchingAccount) {
        AppEnv.logDebug(`Closing composer because of destroy draft ${messages[0].id}`);
        AppEnv.close({
          messageId: messages[0].id,
          threadId: messages[0].threadId,
          windowLevel: this._getCurrentWindowLevel(),
          additionalChannelParam: 'draft',
          deleting: true,
        });
      } else {
        AppEnv.logDebug(
          `${messages[0].id} not this draft or is switching account ${opts.switchingAccount}`
        );
      }
      return;
    }
    if (!AppEnv.isMainWindow()) {
      // console.log('on destroy draft is not main window');
      return;
    }
    // console.log('destroying draft');
    const tasks = [];
    if (!Array.isArray(messages) && messages instanceof Message) {
      messages = [messages];
      AppEnv.reportWarning(new Error('destroy draft still using single draft'));
    } else if (!Array.isArray(messages)) {
      return;
    }
    const failedDrafts = [];
    const normalDrafts = [];
    messages.forEach(message => {
      if (Message.compareMessageState(message.syncState, Message.messageSyncState.failed)) {
        failedDrafts.push(message);
      } else {
        normalDrafts.push(message);
      }
      this._onDestroyDraft(message, opts);
    });
    tasks.push(
      ...TaskFactory.tasksForMessagesByAccount(normalDrafts, ({ accountId, messages: msgs }) => {
        const ids = [];
        msgs.forEach(msg => {
          ids.push(msg.id);
        });
        return new DestroyDraftTask({
          canBeUndone: opts.canBeUndone,
          accountId,
          messageIds: ids,
          source: opts.source || '',
        });
      }),
      ...TaskFactory.tasksForCancellingOutboxDrafts({
        messages: failedDrafts,
        source: 'on user destroy draft',
      })
    );
    if (tasks.length > 0) {
      Actions.queueTasks(tasks);
    }
  };

  _onDestroyDraft = (message = {}, opts = { source: 'Unknown' }) => {
    // console.log('on destroy draft');
    const { id: messageId } = message;
    if (this._draftsDeleting[messageId] || this._draftsDeleted[messageId]) {
      AppEnv.reportError(new Error(`Draft is already deleting`), {
        errorData: { draftsDeleting: this._draftsDeleting, currentDraft: message },
      });
      return;
    }
    let draftDeleting = false;
    if (messageId) {
      draftDeleting = !!this._draftsDeleting[messageId];
      this._draftsDeleting[messageId] = messageId;
    }
    const session = this._draftSessions[messageId];
    if (session && !draftDeleting) {
      if (this._draftsSending[messageId]) {
        return;
      }
      const openCount = this._draftsOpenCount[messageId];
      if (!openCount) {
        if (['onLastOpenDraftClosed', 'onCancelOutboxDraft'].includes(opts.source)) {
          AppEnv.logError(`no open count in destroy draft from source ${opts.source}`);
        }
      } else if (openCount['3'] && opts.allowNewDraft) {
        const oldDraft = session.draft();
        if (!oldDraft) {
          AppEnv.logError('session does not have draft for composer opened draft');
        } else {
          // const oldHeaderMessageId = oldDraft.headerMessageId;
          // const oldMessageId = oldDraft.id;
          const draft = DraftFactory.duplicateDraftBecauseOfNewId(oldDraft);
          if (draft) {
            this._finalizeAndPersistNewMessage(draft).then(() => {
              // console.log('new draft');
              this._onPopoutDraft(draft.id, { newDraft: false });
            });
          }
        }
      }
      session.closeSession({ cancelCommits: true, reason: `${opts.source}:onDestroyDraft` });
    }
    if (messageId) {
      if (!draftDeleting) {
        this.trigger({ messageId: messageId });
      }
    } else {
      AppEnv.reportError(new Error('Tried to delete a draft that had no ID assigned yet.'));
    }
  };
  _onDestroyDraftSuccess = ({ messageIds, accountId }) => {
    AppEnv.logDebug('destroy draft succeeded');
    if (Array.isArray(messageIds)) {
      const triggerMessageIds = [];
      messageIds.forEach(id => {
        if (id) {
          const messageId = this._draftsDeleting[id];
          if (messageId) {
            triggerMessageIds.push(messageId);
            delete this._draftsDeleting[messageId];
            if (AppEnv.isMainWindow()) {
              AttachmentStore = AttachmentStore || require('./attachment-store').default;
              AttachmentStore.removeDraftAttachmentCache({
                id,
                accountId,
                reason: 'Destroy Draft success',
              });
            }
          }
          delete this._draftsDeleting[id];
        }
      });
      this.trigger({ messageIds: triggerMessageIds });
      triggerMessageIds.forEach(messageId => {
        if (this._draftsOpenCount[messageId]) {
          this._draftsDeleted[messageId] = true;
        }
      });
    }
  };

  _onDestroyDraftFailed = ({ messageIds, key, debuginfo, accountId }) => {
    AppEnv.logDebug('destroy draft failed');
    if (Array.isArray(messageIds)) {
      const triggerMessageIds = [];
      messageIds.forEach(id => {
        if (id) {
          const messageId = this._draftsDeleting[id];
          triggerMessageIds.push(messageId);
          delete this._draftsDeleting[messageId];
          delete this._draftsDeleting[id];
          if (AppEnv.isMainWindow()) {
            AttachmentStore = AttachmentStore || require('./attachment-store').default;
            AttachmentStore.removeDraftAttachmentCache({
              id,
              accountId,
              reason: 'Destroy draft failed',
            });
          }
        }
      });
      this.trigger({ messageIds: triggerMessageIds });
    }
  };
  _cancelSendingDraftTimeout = ({ messageId, trigger = false, changeSendStatus = true } = {}) => {
    this._cancelDraftFailingTimeout({ messageId });
    this._cancelDraftFailedTimeout({ messageId });
    if (changeSendStatus) {
      delete this._draftsSending[messageId];
    } else {
      AppEnv.reportError(
        new Error(`Sending draft: ${messageId}, took more than ${SendDraftTimeout / 1000} seconds`),
        {},
        { grabLogs: true }
      );
    }
    if (trigger) {
      this.trigger({ messageId });
    }
  };
  _startSendingDraftTimeouts = ({ draft, taskId, source = '' }) => {
    this._startSendingDraftFailedTimeout({ draft, taskId, source });
    this._startDraftFailingTimeout({ messages: [draft] });
  };
  _startSendingDraftFailedTimeout = ({ draft, taskId = '', source = '' } = {}) => {
    if (this._draftSendingTimeouts[draft.id]) {
      clearTimeout(this._draftSendingTimeouts[draft.id].handler);
    }
    this._draftSendingTimeouts[draft.id] = { handler: null, taskId };
    this._draftSendingTimeouts[draft.id].handler = setTimeout(() => {
      this._cancelSendingDraftTimeout({
        messageId: draft.id,
        trigger: true,
        changeSendStatus: false,
        source,
      });
      const task = new ChangeDraftToFailedTask({
        messageIds: [draft.id],
        accountId: draft.accountId,
        sendDraftTaskIds: [taskId],
      });
      Actions.queueTask(task);
    }, SendDraftTimeout);
    AppEnv.logDebug(
      `Started SendingDraftFailedTimeout, draftID: ${draft.id}, taskId: ${taskId}, source: ${source} `
    );
  };
  _cancelDraftFailedTimeout = ({ messageId, source = '' } = {}) => {
    if (this._draftSendingTimeouts[messageId]) {
      clearTimeout(this._draftSendingTimeouts[messageId].handler);
      delete this._draftSendingTimeouts[messageId];
    }
  };
  _cancelDraftFailingTimeout = ({ messageId, source = '' }) => {
    if (this._draftFailingTimeouts[messageId]) {
      clearTimeout(this._draftFailingTimeouts[messageId]);
      delete this._draftFailingTimeouts[messageId];
    }
  };
  _startDraftFailingTimeout = ({ messages = [], source = '' }) => {
    messages.forEach(msg => {
      if (msg && msg.draft) {
        if (this._draftFailingTimeouts[msg.id]) {
          clearTimeout(this._draftFailingTimeouts[msg.id]);
        }
        this._draftFailingTimeouts[msg.id] = setTimeout(() => {
          const task = new ChangeDraftToFailingTask({ messages: [msg], accountId: msg.accountId });
          Actions.queueTask(task);
        }, DraftFailingBaseTimeout);
      }
    });
  };
  _onSendingDraft = async ({ messageId, windowLevel }) => {
    if (AppEnv.isComposerWindow()) {
      if (this._draftSessions[messageId]) {
        AppEnv.close({
          messageId: messageId,
          windowLevel: this._getCurrentWindowLevel(),
        });
      } else {
        AppEnv.logDebug(`${messageId} not this draft sending`);
      }
      return;
    }
    if (this._getCurrentWindowLevel() !== windowLevel) {
      const session = await this.sessionForClientId(messageId);
      if (session) {
        if (AppEnv.isMainWindow()) {
          const draft = session.draft();
          if (draft) {
            this._draftsSending[draft.id] = true;
            // this._startSendingDraftTimeouts({ draft: session.draft });
          } else {
            AppEnv.reportWarning(
              new Error(`session no longer have draft for ${messageId} at window: ${windowLevel}`)
            );
          }
        } else {
          // At this point it is thread
          AppEnv.debugLog(`Thread window triggered send ${messageId}`);
          this._draftsSending[messageId] = true;
        }
        this._doneWithSession(session, 'onSendingDraft');
      } else {
        console.log('session not here');
        if (AppEnv.isMainWindow()) {
          AppEnv.reportError(
            new Error(`session not found for ${messageId} at window: ${windowLevel}`)
          );
        }
      }
      this.trigger({ messageId });
    }
  };
  _onSendDraftAction = (messageId, options = {}) => {
    if (AppEnv.isMainWindow()) {
      this._onSendDraft(messageId, options);
    } else {
      this._notMainSendDraft(messageId, options);
    }
  };
  _notMainSendDraft = (messageId, options = {}) => {
    if (AppEnv.isMainWindow()) {
      return;
    }
    const session = this._draftSessions[messageId];
    if (session && session.draft()) {
      AppEnv.logInfo('syncing draft data to main window');
      const syncData = cloneForSyncDraftData(session.draft());
      Actions.toMainSendDraft(messageId, options, syncData);
      if (AppEnv.isComposerWindow()) {
        if (AppEnv.isFullScreen()) {
          AppEnv.minimize();
        } else {
          AppEnv.hide();
        }
      }
    }
    return;
  };

  _onSendDraft = async (messageId, options = {}, syncData) => {
    if (!AppEnv.isMainWindow()) {
      AppEnv.logDebug('send draft, not main window');
      return;
    }
    if (this._draftsSending[messageId]) {
      AppEnv.reportError(
        new Error(
          `sending draft when draft is already sending ${messageId} at window: ${this._getCurrentWindowLevel()}`
        ),
        {
          errorData: {
            sending: this._draftsSending,
            deleting: this._draftsDeleting,
            deleted: this._draftsDeleted,
            openCount: this._draftsOpenCount,
            options: options,
          },
        },
        { grabLogs: true }
      );
      return;
    }
    if (this._draftsDeleted[messageId] || this._draftsDeleting[messageId]) {
      AppEnv.reportError(
        new Error(
          `sending draft when draft is already deleting/deleted ${messageId} at window: ${this._getCurrentWindowLevel()}`,
          {
            errorData: {
              sending: this._draftsSending,
              deleting: this._draftsDeleting,
              deleted: this._draftsDeleted,
              openCount: this._draftsOpenCount,
              options: options,
            },
          },
          { grabLogs: true }
        )
      );
      return;
    }
    const {
      delay = AppEnv.config.get('core.task.delayInMs'),
      actionKey = DefaultSendActionKey,
    } = options;

    const sendAction = SendActionsStore.sendActionForKey(actionKey);

    if (!sendAction) {
      throw new Error(`Cant find send action ${actionKey} `);
    }

    const sendLaterMetadataValue = {
      expiration: new Date(Date.now() + delay),
      isUndoSend: true,
      actionKey: actionKey,
    };
    const session = this._draftSessions[messageId];
    if (!session) {
      AppEnv.reportError(
        new Error(`session missing ${messageId}`),
        {
          errorData: {
            sending: this._draftsSending,
            deleting: this._draftsDeleting,
            deleted: this._draftsDeleted,
            openCount: this._draftsOpenCount,
            options: options,
          },
        },
        { grabLogs: true }
      );
      return;
    }
    let bodyString = '';
    try {
      if (syncData) {
        AppEnv.logInfo(
          'We have syncData from none main window and main window draft data is not updated yet'
        );
        session.localApplySyncDraftData({ syncData });
      }
    } catch (e) {
      AppEnv.reportError(
        new Error('localApplySyncDraftData failed'),
        { errorData: { error: e, syncData } },
        { grabLogs: true }
      );
      bodyString = syncData.body;
    }
    session.cancelCommit();

    // get the draft session, apply any last-minute edits and get the final draft.
    // We need to call `changes.commit` here to ensure the body of the draft is
    // completely saved and the user won't see old content briefly.
    // const session = await this.sessionForClientId(headerMessageId);
    // if (session.isPopout()) {
    //   // Do nothing if session have popouts
    //   return;
    // }

    // move the draft to another account if necessary to match the from: field
    // await session.ensureCorrectAccount();

    let draft = session.draft();

    // remove inline attachments that are no longer in the body
    const files = draft.files.filter(f => {
      return !(f.contentId && f.isInline && !draft.body.includes(`cid:${f.contentId}`));
    });
    if (files.length !== draft.files.length) {
      session.changes.add({ files });
    }
    draft.files = files;

    // attach send-later metadata if a send delay is enabled
    // if (sendLaterMetadataValue) {
    //   session.changes.addPluginMetadata('send-later', sendLaterMetadataValue);
    // }
    await session.changes.commit('send draft');
    AppEnv.logDebug(`Committing draft before sending for ${messageId}`);
    // ensureCorrectAccount / commit may assign this draft a new ID. To move forward
    // we need to have the final object with it's final ID.
    // draft = await DatabaseStore.findBy(Message, { headerMessageId, draft: true, state: 0 }).include(
    //   Message.attributes.body,
    // );
    // Directly update the message body cache so the user immediately sees
    // the new message text (and never old draft text or blank text) sending.
    await MessageBodyProcessor.updateCacheForMessage(draft);

    this._doneWithSession(session, 'onSendDraft');
    // Notify all windows that draft is being send out.
    Actions.sendingDraft({ messageId, windowLevel: this._getCurrentWindowLevel() });
    this._draftsSending[draft.id] = true;
    // At this point the message UI enters the sending state and the composer is unmounted.
    this.trigger({ messageId });
    // To be able to undo the send, we need to pretend that we added the send-later
    // metadata as it's own task so that the undo action is clear. We don't actually
    // want a separate SyncbackMetadataTask to be queued because a stray SyncbackDraftTask
    // could overwrite the metadata value back to null.
    if (sendLaterMetadataValue) {
      const sendDraftTask = SendDraftTask.forSending(draft);
      if (bodyString.length > 0) {
        sendDraftTask.draft.body = bodyString;
      }
      const undoTask = SyncbackMetadataTask.forSaving({
        pluginId: 'send-later',
        model: draft,
        value: sendLaterMetadataValue,
        undoValue: { expiration: null, isUndoSend: true },
        lingerAfterTimeout: true,
        priority: UndoRedoStore.priority.critical,
        delayedTasks: [sendDraftTask],
        delayTimeoutCallback: () => {
          this._startSendingDraftTimeouts({
            draft,
            taskId: sendDraftTask.id,
            source: 'Send draft wait time expired',
          });
        },
        taskPurged: () => {
          this._onSendDraftCancelled({ messageId });
        },
      });
      AppEnv.logDebug(
        `Sending draft to undo queue ${messageId} from source: ${options && options.source}`
      );
      Actions.queueUndoOnlyTask(undoTask);
      AttachmentStore = AttachmentStore || require('./attachment-store').default;
      AttachmentStore.removeDraftAttachmentCache(draft);
      // ipcRenderer.send('send-later-manager', 'send-later', headerMessageId, delay, actionKey, draft.threadId);
    } else {
      // Immediately send the draft
      // await sendAction.performSendAction({ draft });
    }
  };

  _onSendDraftSuccess = ({ messageId }) => {
    this._cancelSendingDraftTimeout({ messageId });
    this.trigger({ messageId });
  };
  _onSendDraftCancelled = ({ messageId }) => {
    this._cancelSendingDraftTimeout({ messageId });
    this.trigger({ messageId });
  };

  _onSendDraftFailed = ({ messageId, threadId, errorMessage, errorDetail, errorKey }) => {
    this._cancelSendingDraftTimeout({ messageId });
    this.trigger({ messageId });

    if (
      AppEnv.isMainWindow() &&
      errorDetail &&
      errorMessage &&
      Object.keys(SendTaskDisplayErrors).includes(errorKey) &&
      errorKey !== SendTaskDisplayErrors.ErrorSendMessage
    ) {
      // We delay so the view has time to update the restored draft. If we
      // don't delay the modal may come up in a state where the draft looks
      // like it hasn't been restored or has been lost.
      //
      // We also need to delay because the old draft window needs to fully
      // close. It takes windows currently (June 2016) 100ms to close by
      setTimeout(() => {
        const focusedThread = FocusedContentStore.focused('thread');
        if (threadId && focusedThread && focusedThread.id === threadId) {
          AppEnv.showErrorDialog(errorMessage, { detail: errorDetail });
        }
      }, 300);
    }
  };
  _getCurrentWindowLevel = () => {
    if (AppEnv.isComposerWindow()) {
      return 3;
    } else if (AppEnv.isThreadWindow()) {
      return 2;
    } else {
      return 1;
    }
  };
}

export default new DraftStore();
