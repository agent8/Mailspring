import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { remote } from 'electron';
import mkdirp from 'mkdirp';
import MailspringStore from 'mailspring-store';
import { Constant } from 'mailspring-exports';
import ExpandMessageAttachmentTask from '../tasks/expand-message-attachment-task';
import DraftStore from './draft-store';
import Actions from '../actions';
import File from '../models/file';
import Message from '../models/message';
import Utils from '../models/utils';
import mime from 'mime-types';
import DatabaseStore from './database-store';
import AttachmentProgress from '../models/attachment-progress';
import { autoGenerateFileName } from '../../fs-utils';
import uuid from 'uuid';
import _ from 'underscore';
import tnef from '@ruoxijiang/node-tnef';
let taskQueue = null;
const TaskQueue = () => {
  taskQueue = taskQueue || require('./task-queue').default;
  return taskQueue;
};

const { AttachmentDownloadState } = Constant;
Promise.promisifyAll(fs);

const mkdirpAsync = Promise.promisify(mkdirp);

const fileAcessibleAtPath = filePath => {
  try {
    const result = fs.existsSync(filePath);
    return result;
  } catch (ex) {
    return false;
  }
};

// TODO make this list more exhaustive
const NonPreviewableExtensions = [
  'jpg',
  'bmp',
  'gif',
  'png',
  'jpeg',
  'zip',
  'tar',
  'gz',
  'bz2',
  'dmg',
  'exe',
  'ics',
];

const attachmentCategoryMap = {
  audio: {
    extensions: [
      'audio/aac',
      'audio/midi',
      'audio/x-midi',
      'audio/ogg',
      'audio/wav',
      'audio/3gpp',
      'audio/3gpp2',
      'application/vnd.google-apps.audio',
    ],
  },
  book: {
    extensions: ['application/vnd.amazon.ebook', 'application/epub+zip'],
  },
  calendar: {
    extensions: ['text/calendar', 'application/ics'],
  },
  code: {
    extensions: [
      'application/x-csh',
      'text/css',
      'application/ecmascript',
      'text/html',
      'text/x-c-code',
      'application/javascript',
      'application/json',
      'application/x-sh',
      'application/x-shockwave-flash',
      'application/typescript',
      'application/xhtml+xml',
      'application/xml',
      'application/vnd.google-apps.script',
    ],
  },
  doc: {
    extensions: [
      'application/x-abiword',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.oasis.opendocument.text',
      'application/rtf',
      'text/plain',
      'application/vnd.google-apps.document',
    ],
  },
  font: {
    extensions: [
      'application/vnd.ms-fontobject',
      'font/otf',
      'font/ttf',
      'font/woff',
      'font/woff2',
    ],
  },
  image: {
    extensions: [
      'image/bmp',
      'image/gif',
      'image/x-icon',
      'image/jpeg',
      'image/png',
      'image/svg+xml',
      'image/tiff',
      'image/webp',
      'image/heic',
      'application/vnd.google-apps.drawing',
      'application/vnd.google-apps.photo',
    ],
  },
  pdf: {
    extensions: ['application/pdf'],
  },
  ppt: {
    extensions: [
      'application/vnd.oasis.opendocument.presentation',
      'application/vnd.ms-powerpoint',
      'application/vnd.ms-powerpoint',
      'application/vnd.google-apps.presentation',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
  },
  xls: {
    extensions: [
      'text/csv',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.google-apps.spreadsheet',
    ],
  },
  video: {
    extensions: [
      'video/x-msvideo',
      'video/mpeg',
      'video/ogg',
      'video/webm',
      'video/3gpp',
      'video/3gpp2',
      'application/vnd.google-apps.video',
      'video/mp4',
    ],
  },
  zip: {
    extensions: [
      'application/x-bzip',
      'application/x-bzip2',
      'application/x-rar-compressed',
      'application/x-tar',
      'application/zip',
      'application/x-7z-compressed',
    ],
  },
  // Other: {
  //   extensions: [
  //     'application/octet-stream',
  //     'application/java-archive',
  //     'application/ogg',
  //     'application/vnd.apple.installer+xml',
  //     'application/vnd.visio',
  //     'application/vnd.mozilla.xul+xml',
  //     'application/vnd.google-apps.file',
  //     'application/vnd.google-apps.folder',
  //   ],
  // },
};

const extMapping = {
  pdf: 'pdf',
  xls: 'xls',
  xlsx: 'xls',
  ppt: 'ppt',
  pptx: 'ppt',
  doc: 'doc',
  docx: 'doc',
  mpeg4: 'video',
  mp4: 'video',
  avi: 'video',
  mov: 'video',
  rar: 'zip',
  zip: 'zip',
  gz: 'zip',
  tar: 'zip',
  '7z': 'zip',
  c: 'code',
  cpp: 'code',
  php: 'code',
  rb: 'code',
  java: 'code',
  coffee: 'code',
  pl: 'code',
  js: 'code',
  ts: 'code',
  html: 'code',
  htm: 'code',
  py: 'code',
  go: 'code',
  ics: 'calendar',
  ifb: 'calendar',
  pkpass: 'pass',
};

const colorMapping = {
  xls: '#2AC941', // Spreadsheet
  ppt: '#FFA115', // Slides
  video: '#FF475F', // Video
  pdf: '#FC3259', // PDF
  calendar: '#FC3259', // Calendar
  code: '#59DCE4', // Code
  doc: '#1393FC', // Doc
  book: '#FFA115',
  image: '#b6bdc2',
  audio: '#648096',
  font: '#b6bdc2',
  other: '#b6bdc2', // Other
};

const PREVIEW_FILE_SIZE_LIMIT = 2000000; // 2mb
const THUMBNAIL_WIDTH = 320;

const AttachmentState = {
  ready: 1,
  beingCopied: 2,
  copying: 3,
  deleting: 4,
  deleted: -1,
  error: -2,
};
export const DraftAttachmentState = {
  ready: 1,
  busy: 2,
  deleted: -1,
  error: -2,
};
const AccountAttachmentsState = {
  ready: 1,
  busy: 2,
  deleted: -1,
  error: -2,
};

class DraftAttachment {
  constructor({ fileId = '', filePath = '', state = AttachmentState.ready, callback = null } = {}) {
    this.fileId = fileId;
    this.filePath = filePath;
    this.state = state;
    this.callback = callback;
    this.filePathReady = false;
    this.queuedCallBack = [];
    if (!fileId) {
      throw new Error('fileId cannot be empty');
    }
  }
  isReady() {
    return this.state === AttachmentState.ready;
  }
  isBusy() {
    return this.state > AttachmentState.ready;
  }
  isDeleted() {
    return this.state === AttachmentState.deleted;
  }

  _mkdir(cb = null) {
    fs.mkdir(path.dirname(this.filePath), { recursive: true }, err => {
      if (!err) {
        this.filePathReady = true;
        console.log(`file path ${this.filePath} ready`);
        if (cb) {
          cb();
        }
      } else {
        AppEnv.logError(err, { errorData: this }, { grabLogs: true });
        this.setState({ state: AttachmentState.error });
        if (cb) {
          cb();
        }
      }
    });
  }
  copyFrom({ originalPath = '', cb = null, ...rest } = {}) {
    if (typeof originalPath !== 'string' || originalPath.length === 0) {
      AppEnv.logError(new Error('copyFrom originalPath incorrect'));
      return;
    }
    this._mkdir(() => {
      this._copy({ originalPath, cb, ...rest });
    });
  }
  _copy({ originalPath = '', cb, ...rest } = {}) {
    this.setState({ state: AttachmentState.copying, extra: rest });
    fs.copyFile(originalPath, this.filePath, err => {
      if (err) {
        AppEnv.logError(err, { errorData: this }, { grabLogs: true });
        this.setState({ state: AttachmentState.ready, extra: rest });
        if (cb) {
          cb({ fileId: this.fileId, filePath: this.filePath });
        }
        return;
      }
      this.setState({ state: AttachmentState.ready, extra: rest });
      AppEnv.logDebug(`File copied, state set ${this.fileId}`);
      if (cb) {
        cb({ fileId: this.fileId, filePath: this.filePath });
      }
    });
  }
  copyFromAttachment({ sourceAttachment = null, cb, ...rest } = {}) {
    if (!sourceAttachment) {
      AppEnv.logError(new Error('target Attachment is null'));
      return;
    }
    const done = data => {
      this.setState({ state: AttachmentState.ready, ...rest });
      sourceAttachment.setState({ state: AttachmentState.ready, ...rest });
      if (cb) {
        cb(data);
      }
    };
    const originalPath = sourceAttachment.filePath;
    sourceAttachment.setState({ state: AttachmentState.beingCopied });
    this.copyFrom({ originalPath, fileId: this.fileId, cb: done });
  }
  markForDelete(cb = null) {
    if (this.state === AttachmentState.deleted) {
      if (cb) {
        cb();
      }
      return;
    } else if (this.state === AttachmentState.deleting) {
      if (cb) {
        this.queuedCallBack.push(cb);
      }
      console.log('Attachment is deleting, queued');
      return;
    }
    if (this.state !== AttachmentState.ready) {
      this.queuedCallBack.push(() => {
        this._deleteAttachment(cb);
      });
      console.log(`Attachment is ${this.fileId} busy, queued`);
      return;
    }
    this._deleteAttachment(cb);
  }
  _deleteAttachment(cb = null) {
    this.setState({ state: AttachmentState.deleting });
    if (this.fileId.indexOf('local-') !== 0) {
      console.log(`Attachment from server, fake deleted`);
      this.setState({ state: AttachmentState.deleted });
      if (cb) {
        cb();
      }
      return;
    }
    fs.unlink(this.filePath, err => {
      if (err) {
        AppEnv.logError(err, { errorData: this }, { grabLogs: true });
      }
      console.log(`Attachment deleted`);
      this.setState({ state: AttachmentState.deleted });
      if (cb) {
        cb();
      }
    });
  }
  setState({ state, extra = {} } = {}) {
    if (!state) {
      AppEnv.logError(new Error('Attachment setState state cannot be null'));
      return;
    }
    if (state === this.state) {
      AppEnv.logWarning(`Attachment state not changed, ${state}`);
      return;
    }
    this.state = state;
    if (state === AttachmentState.ready || state === AttachmentState.deleted) {
      this.queuedCallBack.forEach(cb => {
        if (cb) {
          cb();
        }
      });
      this.queuedCallBack = [];
    }
    this.trigger(extra);
  }
  trigger(data = {}) {
    if (!this.callback) {
      return;
    }
    this.callback({ fileId: this.fileId, filePath: this.filePath, fileState: this.state, ...data });
  }
}

class DraftAttachments {
  constructor({ messageId, headerMessageId, accountId, callback = null } = {}) {
    this.messageId = messageId;
    this.hearderMessageId = headerMessageId;
    this.accountId = accountId;
    this.callback = callback;
    this.state = DraftAttachmentState.ready;
    this.attachments = [];
    this.busyCount = 0;
    this.queuedCallback = null;
  }
  isBusy() {
    return this.state === DraftAttachmentState.busy;
  }
  isReady() {
    return this.state === DraftAttachmentState.ready;
  }
  isDeleted() {
    return this.state === DraftAttachmentState.deleted;
  }
  addFrom({ originalPath = '', cb = null, dstFile = null, ...rest } = {}) {
    if (!dstFile) {
      AppEnv.logError(new Error('Add From in DraftAttachments missing dstFile'));
      return;
    }
    if (!originalPath) {
      AppEnv.logError(new Error('Add From in DraftAttachments missing source'));
      return;
    }
    const attachment = new DraftAttachment({
      filePath: dstFile.filePath,
      fileId: dstFile.id || dstFile.fileId,
      callback: this.onAttachmentCallBack,
    });
    this.attachments.push(attachment);
    console.log(`attachment ${dstFile.id || dstFile.fileId} added to draft ${this.messageId}`);
    this._addFrom({ originalPath, attachment, cb, ...rest });
  }
  _addFrom({ originalPath = '', attachment, cb = null, ...rest }) {
    if (!attachment) {
      AppEnv.logError('missing attachment');
      return;
    }
    const done = data => {
      this.setState({ state: DraftAttachmentState.ready, ...rest });
      if (cb) {
        cb(data);
      }
    };
    this.setState({ state: DraftAttachmentState.busy, ...rest });
    attachment.copyFrom({ originalPath, cb: done });
  }
  addFromAttachment({ sourceAttachment, cb, dstFile, ...rest }) {
    if (!sourceAttachment) {
      AppEnv.logError('missing source attachment');
      return;
    }
    if (!dstFile) {
      AppEnv.logError(new Error('Add From in DraftAttachments missing dstFile'));
      return;
    }
    const done = () => {
      this.setState({ state: DraftAttachmentState.ready, ...rest });
      if (cb) {
        cb();
      }
    };
    const attachment = new DraftAttachment({
      filePath: dstFile.filePath,
      fileId: dstFile.fileId,
      callback: this.onAttachmentCallBack,
    });
    this.attachments.push(attachment);
    attachment.copyFromAttachment({ sourceAttachment, cb: done, ...rest });
  }
  deleteAttachmentByFileId({ fileId, cb } = {}) {
    const attachment = this.findAttachmentById(fileId);
    if (!attachment) {
      AppEnv.logError(`Attachment with id: ${fileId} not found in message ${this.messageId}`);
      return;
    }
    this._deleteAttachment({ attachment, cb });
  }
  _deleteAttachment({ attachment = null, cb }) {
    if (!attachment) {
      return;
    }
    const done = () => {
      this.setState({ state: DraftAttachmentState.ready });
      console.log(`attachment ${attachment.fileId} for draft: ${this.messageId} deleted`);
      this.attachments = this.attachments.filter(i => i.fileId !== attachment.fileId);
      if (cb) {
        cb();
      }
    };
    attachment.markForDelete(done);
    this.setState({ state: DraftAttachmentState.busy });
    console.log(`attachment ${attachment.fileId} for draft: ${this.messageId} marked for delete`);
  }
  markForDelete(cb) {
    if (this.state === DraftAttachmentState.busy) {
      this.queuedCallback = () => {
        this._deleteDraft(cb);
      };
      console.log(`Draft ${this.messageId} busy, queued`);
      return;
    } else {
      this._deleteDraft(cb);
    }
  }
  _deleteDraft(cb) {
    const total = this.attachments.length;
    let processed = 0;
    this.setState({ state: DraftAttachmentState.busy });
    if (total === processed) {
      console.log('no attachments, delete  draft');
      this.setState({ state: DraftAttachmentState.deleted });
      if (cb) {
        cb();
      }
    } else {
      console.log('deleting all attachments');
      const done = () => {
        processed++;
        if (processed === total) {
          this.setState({ state: DraftAttachmentState.deleted });
          if (cb) {
            cb();
          }
        }
      };
      this.attachments.forEach(attachment => {
        attachment.markForDelete(done);
      });
    }
  }
  findAttachmentById(id) {
    return this.attachments.find(item => item.fileId === id);
  }
  addReadyAttachment({ fileId, filePath }) {
    let attachment = this.findAttachmentById(fileId);
    if (!attachment) {
      attachment = new DraftAttachment({
        filePath,
        fileId,
        state: AttachmentState.ready,
        callback: this.onAttachmentCallBack,
      });
      this.attachments.push(attachment);
    }
    return attachment;
  }
  onAttachmentCallBack = ({ fileId, fileState } = {}) => {
    const data = { fileId, fileState };
    this.trigger(data);
  };
  setState({ state, ...extra } = {}) {
    if (!state) {
      AppEnv.logWarning(`DraftAttachments set state is wrong: ${state}`);
      return;
    }
    if (state === this.state) {
      AppEnv.logWarning(`state is the same ${state}, ignored`);
      return;
    }
    if (state === DraftAttachmentState.busy) {
      this.busyCount++;
    } else {
      this.busyCount--;
    }
    if (state !== DraftAttachmentState.busy && this.busyCount > 0) {
      AppEnv.logDebug(`Draft Attachments still busy ${this.busyCount}`);
      return;
    }
    this.state = state;
    if (state === DraftAttachmentState.ready) {
      if (this.queuedCallback) {
        this.queuedCallback();
        this.queuedCallback = null;
      }
    }
    this.trigger(extra);
  }
  trigger(extra) {
    if (this.callback) {
      this.callback({
        messageId: this.messageId,
        headerMessageId: this.hearderMessageId,
        accountId: this.accountId,
        draftState: this.state,
        ...extra,
      });
    }
  }
}

class AccountDrafts {
  constructor({ callback = null }) {
    this.accounts = { push: this._push };
    this.callback = callback;
  }
  _push = item => {
    if (!item || !item.accountId) {
      AppEnv.logError(`Push item does not have accountId`);
    }
    if (!this.accounts[item.accountId]) {
      this.accounts[item.accountId] = [];
    }
    this.accounts[item.accountId].push(item);
    console.log(`draft ${item.messageId} added to account ${item.accountId}`);
  };

  removeDraftCache({ accountId, messageId, headerMessageId, reason = '' }) {
    const draft = this.findDraft({ accountId, messageId, headerMessageId });
    if (draft) {
      this.accounts[accountId] = this.accounts[accountId].filter(
        item => item.messageId !== draft.messageId
      );
    }
    console.log(`Removed ${messageId} from draft attachment cache, reason: ${reason}`);
  }
  addDraft({ accountId, messageId, headerMessageId }) {
    let draft = this.findDraft({ accountId, messageId, headerMessageId });
    if (!draft) {
      draft = new DraftAttachments({
        messageId,
        headerMessageId,
        accountId,
        callback: this._onDraftStateChange,
      });
      this.accounts.push(draft);
      console.log(`draft ${messageId} added to cache`);
    } else {
      console.log(`draft ${messageId} already in cache`);
    }
    return draft;
  }
  addDraftWithAttachments(draft) {
    if (!draft) {
      AppEnv.logError(new Error(`Draft is null, cannot add draft with attachments to cache`));
      return;
    }
    const accountId = draft.accountId;
    const messageId = draft.id;
    const headerMessageId = draft.headerMessageId;
    if (!accountId || (!messageId && !headerMessageId)) {
      AppEnv.logError(
        new Error(`Draft data incorrect, cannot remove draft from attachment cache`),
        draft
      );
      return;
    }
    const draftCache = this.addDraft({ accountId, messageId, headerMessageId });
    if (!draftCache) {
      AppEnv.reportError(
        new Error(`adding draft to cache failed`),
        { errorData: { accountId, messageId, headerMessageId } },
        { grabLogs: true }
      );
      return;
    }
    if (Array.isArray(draft.attachmentCache) && draft.attachmentCache.length > 0) {
      console.log('adding attachment with draft to cache');
      draft.attachmentCache.forEach(f => {
        draftCache.addReadyAttachment(f);
      });
    }
    delete draft.attachmentCache;
  }
  copyAttachment({ accountId, messageId, headerMessageId, dstFile, sourceFile, originalPath, cb }) {
    if (!this.accounts[accountId]) {
      this.accounts[accountId] = [];
    }
    let draft = this.findDraft({ accountId, messageId, headerMessageId });
    if (!draft) {
      draft = new DraftAttachments({
        messageId,
        headerMessageId,
        accountId,
        callback: this._onDraftStateChange,
      });
      this.accounts.push(draft);
    }
    const doneFromOutside = data => {
      if (cb) {
        cb(data);
      }
      this.trigger({ accountId, messageId, headerMessageId, dstFile, sourceFile, originalPath });
    };
    if (draft.isDeleted()) {
      if (cb) {
        cb();
      }
      AppEnv.logError(
        new Error(
          `Draft ${messageId},${headerMessageId} is already deleted, will not add attachment`
        )
      );
      return;
    }
    if (sourceFile && !originalPath) {
      const sourceAccountId = sourceFile.accountId;
      const sourceMessageId = sourceFile.messageId;
      const sourceHeaderMessageId = sourceFile.headerMessageId;
      const sourceFileId = sourceFile.fileId;
      const sourceFilePath = sourceFile.filePath;
      if (
        !sourceAccountId ||
        (!sourceMessageId && !sourceHeaderMessageId) ||
        !sourceFileId ||
        !sourceFilePath
      ) {
        AppEnv.logError(new Error(`copy attachment missing data`));
        return;
      }
      let sourceDraft = this.findDraft({
        accountId: sourceAccountId,
        messageId: sourceMessageId,
        headerMessageId: sourceHeaderMessageId,
      });
      if (!sourceDraft) {
        sourceDraft = this.addDraft({
          accountId: sourceAccountId,
          messageId: sourceMessageId,
          headerMessageId: sourceHeaderMessageId,
        });
      }
      let sourceAttachment = sourceDraft.findAttachmentById(sourceFileId);
      if (!sourceAttachment) {
        sourceAttachment = sourceDraft.addReadyAttachment({
          fileId: sourceFileId,
          filePath: sourceFilePath,
        });
      }
      const doneFromMessage = () => {
        sourceDraft.setState({ state: DraftAttachmentState.ready });
        if (cb) {
          cb();
        }
        this.trigger({ accountId, messageId, headerMessageId, dstFile, sourceFile, originalPath });
      };
      sourceDraft.setState({ state: DraftAttachmentState.busy });
      console.log(
        `copying attachment ${sourceAttachment.fileId} from message to ${dstFile.fileId}`
      );
      draft.addFromAttachment({ sourceAttachment, dstFile, cb: doneFromMessage });
    } else if (originalPath && !sourceFile) {
      console.log(`copying attachment from outside to ${dstFile.fileId}`);
      draft.addFrom({ originalPath, dstFile, cb: doneFromOutside });
    }
  }
  deleteAttachment({ accountId, messageId, headerMessageId, fileId, cb }) {
    const draft = this.findDraft({ accountId, messageId, headerMessageId });
    if (!draft) {
      AppEnv.logWarning(
        `AccountsDraft does not have draft: ${accountId}, ${messageId}, ${headerMessageId}`
      );
      return;
    }
    const done = () => {
      console.log(`file: ${fileId} for message: ${messageId} deleted`);
      if (cb) {
        cb();
      }
    };
    console.log(`file: ${fileId} for message: ${messageId} mark for deletion`);
    draft.deleteAttachmentByFileId({ fileId, cb: done });
  }
  deleteDraft({ accountId, messageId, headerMessageId, cb, reason = '' } = {}) {
    console.log(
      `trying to delete draft ${accountId}, ${messageId}, ${headerMessageId} because ${reason}`
    );
    const draft = this.findDraft({ accountId, messageId, headerMessageId });
    if (!draft) {
      AppEnv.logWarning(
        `Accounts does not have draft: ${accountId}, ${messageId}, ${headerMessageId}`
      );
      return;
    }
    const done = () => {
      if (!this) {
        console.log(`removing draft ${messageId} from account: ${accountId}, no this`);
        return;
      }
      if (!this.accounts[accountId]) {
        console.log(
          `removing draft ${messageId} from account: ${accountId} not needed, accounts doesn't exist`
        );
        return;
      }
      console.log(`removing draft ${messageId} from account: ${accountId}`);
      this.accounts[accountId] = this.accounts[accountId].filter(
        item => item.messageId !== draft.messageId
      );
      if (cb) {
        cb();
      }
    };
    console.log(`marking draft ${messageId} from account: ${accountId} for removal`);
    draft.markForDelete(done);
  }
  findDraft({ accountId, messageId, headerMessageId }) {
    if (!accountId) {
      AppEnv.logError(`Find Draft missing accountId`);
      return null;
    }
    if (!this.accounts[accountId]) {
      {
      }
      AppEnv.logDebug(`Accounts missing accountId ${accountId}`);
      return null;
    }
    return this.accounts[accountId].find(
      draft =>
        (messageId && draft.messageId === messageId) ||
        (headerMessageId && draft.headerMessageId === headerMessageId)
    );
  }
  _onDraftStateChange = data => {
    this.trigger(data);
  };

  trigger(data = {}) {
    if (!this.callback) {
      return;
    }
    this.callback(data);
  }
}

class AttachmentStore extends MailspringStore {
  constructor() {
    super();

    // viewing messages
    this.listenTo(Actions.fetchFile, this._fetch);
    this.listenTo(Actions.fetchAndOpenFile, this._fetchAndOpen);
    this.listenTo(Actions.fetchAndSaveFile, this._saveFileToUserDir);
    this.listenTo(Actions.fetchAndSaveAllFiles, this._saveAllFilesToUserDir);
    this.listenTo(Actions.abortFetchFile, this._abortFetchFile);
    this.listenTo(Actions.fetchAttachments, this._onFetchAttachments);
    this.listenTo(Actions.extractTnefFile, this._extractTnefFile);

    // sending
    this.listenTo(Actions.addAttachment, this._onAddAttachment);
    this.listenTo(Actions.addAttachments, this._onAddAttachments);
    this.listenTo(Actions.selectAttachment, this._onSelectAttachment);
    this.listenTo(Actions.removeAttachment, this._onRemoveAttachment);
    this.listenTo(Actions.removeAttachments, this._onRemoveAttachments);
    this.listenTo(Actions.bulkUpdateDraftFiles, this.bulkUpdateDraftFiles);
    if (AppEnv.isMainWindow()) {
      this.listenTo(Actions.syncAttachmentToMain, this._onAddAttachmentFromNonMainWindow);
      this.listenTo(Actions.removeAttachmentToMain, this._onRemoveAttachmentMainWindow);
      this.listenTo(Actions.removeAttachmentsToMain, this._onRemoveAttachmentsMainWindow);
    }
    this._attachementCache = Utils.createCircularBuffer(200);
    this._draftAttachmentProgress = new AccountDrafts({
      callback: this._onDraftAttachmentStateChanged,
    });
    this._missingDataAttachmentIds = new Set();
    this._queryFileDBTimer = null;
    this._filePreviewPaths = {};
    this._filesDirectory = path.join(AppEnv.getConfigDirPath(), 'files');
    this._saveFileQueue = [];
    this._saveAllFilesQueue = [];
    this._extractingTnefFile = {};
    this._fileProcess = new Map();
    this._fileSaveSuccess = new Map();
    mkdirp(this._filesDirectory);

    DatabaseStore.listen(change => {
      if (change.objectClass === AttachmentProgress.name) {
        this._onPresentChange(change.objects);
      }
    });
    this._triggerDebounced = _.debounce(() => this.trigger(), 20);
  }
  _onDraftAttachmentStateChanged = data => {
    console.log(`draft attachment state changed `, data);
    Actions.broadcastDraftAttachmentState(data);
  };
  copyAttachmentsToDraft({ draft, fileData = [], cb }) {
    if (!draft) {
      AppEnv.logError(new Error(`Draft is null, add to attachment ignored`));
      return;
    }
    if (!Array.isArray(fileData)) {
      AppEnv.logError(`fileData is not array, ignoring add to attachment`);
      return;
    }
    const accountId = draft.accountId;
    const messageId = draft.id;
    const headerMessageId = draft.headerMessageId;
    if (!accountId || !messageId || !headerMessageId) {
      AppEnv.reportError(
        new Error(`Draft data is incorrect,`),
        { errorData: draft },
        { grabLogs: true }
      );
      return;
    }
    fileData.forEach(f => {
      const { dstFile, sourceFile, originalPath } = f;
      this.copyAttachmentToDraft({
        accountId,
        messageId,
        headerMessageId,
        dstFile,
        sourceFile,
        originalPath,
        cb,
      });
    });
  }
  copyAttachmentToDraft({
    accountId,
    messageId,
    headerMessageId,
    dstFile,
    sourceFile,
    originalPath,
    cb,
  }) {
    this._draftAttachmentProgress.copyAttachment({
      accountId,
      messageId,
      headerMessageId,
      dstFile,
      sourceFile,
      originalPath,
      cb,
    });
  }
  deleteDraftAttachments({ draft, fileIds = [], cb }) {
    if (!draft) {
      AppEnv.logError(new Error(`Draft is null, delete draft attachments ignored`));
      return;
    }
    if (!Array.isArray(fileIds)) {
      AppEnv.logError(new Error(`fileData is not array, ignoring add to attachment`));
      return;
    }
    const accountId = draft.accountId;
    const messageId = draft.id;
    const headerMessageId = draft.headerMessageId;
    if (!accountId || !messageId || !headerMessageId) {
      AppEnv.reportError(
        new Error(`Draft data is incorrect,`),
        { errorData: draft },
        { grabLogs: true }
      );
      return;
    }
    fileIds.forEach(fileId => {
      this.deleteDraftAttachment({
        accountId,
        messageId,
        headerMessageId,
        fileId,
        cb,
      });
    });
  }
  deleteDraftAttachment({ accountId, messageId, headerMessageId, fileId, cb }) {
    this._draftAttachmentProgress.deleteAttachment({
      accountId,
      messageId,
      headerMessageId,
      fileId,
      cb,
    });
  }
  deleteDraft({ accountId, messageId, headerMessageId, cb, reason = '' }) {
    if (!accountId) {
      const keys = Object.keys(this._draftAttachmentProgress.accounts);
      for (let id of keys) {
        if (id === 'push') {
          continue;
        }
        let draft = this._draftAttachmentProgress.findDraft({
          accountId: id,
          messageId,
          headerMessageId,
        });
        if (draft) {
          accountId = id;
          break;
        }
      }
    }
    console.log(`using account ${accountId} to remove draft because: ${reason}`);
    this._draftAttachmentProgress.deleteDraft({
      accountId,
      messageId,
      headerMessageId,
      cb,
      reason,
    });
  }
  addDraftToAttachmentCache(draft) {
    if (!draft) {
      AppEnv.logError(new Error(`Draft is null, cannot add draft to attachment cache`));
      return;
    }
    const accountId = draft.accountId;
    const messageId = draft.id;
    const headerMessageId = draft.headerMessageId;
    if (!accountId || (!messageId && !headerMessageId)) {
      AppEnv.logError(
        new Error(`Draft data incorrect, cannot remove draft from attachment cache`),
        draft
      );
      return;
    }
    if (Array.isArray(draft.files) && draft.files.length > 0) {
      draft.attachmentCache = draft.files.map(f => {
        return { filePath: this.pathForFile(f), fileId: f.id };
      });
    }
    this._draftAttachmentProgress.addDraftWithAttachments(draft);
  }
  removeDraftAttachmentCache(draft) {
    if (!draft) {
      AppEnv.logError(new Error(`Draft is null, cannot remove draft from attachment cache`));
      return;
    }
    const accountId = draft.accountId;
    const messageId = draft.id;
    const headerMessageId = draft.headerMessageId;
    if (!accountId || (!messageId && !headerMessageId)) {
      AppEnv.logError(`Draft data incorrect, cannot remove draft from attachment cache`, draft);
      return;
    }
    this._draftAttachmentProgress.removeDraftCache({ accountId, messageId, headerMessageId });
  }
  _queryFilesFromDB = () => {
    if (this._queryFileDBTimer) {
      this._queryFileDBTimer = null;
    }
    if (this._missingDataAttachmentIds.size === 0) {
      return;
    }
    const fileIds = [];
    for (let id of this._missingDataAttachmentIds.values()) {
      fileIds.push(id);
    }
    if (fileIds.length > 0) {
      this._missingDataAttachmentIds.clear();
      // console.log(`Querying db for file ids ${fileIds}`);
      this.findAllByFileIds(fileIds).then(files => {
        const attachmentChange = [];
        files.forEach(file => {
          if (!file) {
            return;
          }
          file.missingData = false;
          if (file.messageId) {
            attachmentChange.push({ fileId: file.id, messageId: file.messageId });
          }
          this._attachementCache.set(file.id, file);
        });
        if (attachmentChange.length > 0) {
          console.log(`Attachment cache updated`);
          this.trigger({ attachmentChange });
        }
      });
    }
  };

  _addToMissingDataAttachmentIds = fileId => {
    this._missingDataAttachmentIds.add(fileId);
    if (!this._queryFileDBTimer) {
      this._queryFileDBTimer = setImmediate(this._queryFilesFromDB);
    }
  };

  findAll() {
    return DatabaseStore.findAll(File, [
      File.attributes.state.in([Constant.FileState.Normal, Constant.FileState.IgnoreMissing]),
    ]);
  }
  findAllByFileIds(fileIds) {
    return this.findAll().where([File.attributes.id.in(fileIds)]);
  }

  getAttachment(fileId) {
    const ret = this._attachementCache.get(fileId);
    if (ret) {
      return ret;
    }
    this._addToMissingDataAttachmentIds(fileId);
    return null;
  }

  // Returns a path on disk for saving the file. Note that we must account
  // for files that don't have a name and avoid returning <downloads/dir/"">
  // which causes operations to happen on the directory (badness!)
  //
  pathForFile(file) {
    if (!file) {
      return null;
    }
    const id = file.id.toLowerCase();
    return path.join(
      this._filesDirectory,
      id.substr(0, 2),
      id.substr(2, 2),
      id,
      file.safeDisplayName()
    );
  }
  pathForFileFolder(file) {
    if (!file) {
      return null;
    }
    const id = file.id.toLowerCase();
    return path.join(this._filesDirectory, id.substr(0, 2), id.substr(2, 2), id);
  }

  fileIdForPath(filePath) {
    const relative = path.relative(this._filesDirectory, filePath);
    const fileId = relative.split('/')[2];
    return fileId;
  }

  filterOutMissingAttachments = files => {
    if (!Array.isArray(files)) {
      return [];
    }
    const ret = [];
    files.forEach(file => {
      const filePath = this.pathForFile(file);
      if (filePath) {
        if (fileAcessibleAtPath(filePath)) {
          ret.push(file);
        }
      }
    });
    return ret;
  };

  getExtIconName(filePath) {
    const contentType = mime.lookup(filePath);
    return this.getExtIconNameByContentType(contentType);
  }

  getExtIconNameByContentType(contentType) {
    contentType = contentType && contentType.toLowerCase();
    let extName = 'other';
    for (let key in attachmentCategoryMap) {
      if (attachmentCategoryMap[key].extensions.includes(contentType)) {
        extName = key;
        break;
      }
    }
    const color = colorMapping[extName];
    return {
      iconName: `attachment-${extName}.svg`,
      color,
    };
  }

  isVideo(filePath) {
    if (!filePath) {
      return false;
    }
    let extName = path.extname(filePath).slice(1);
    extName = extMapping[extName && extName.toLowerCase()];
    return extName === 'video';
  }

  getDownloadDataForFile = fileId => {
    return this._fileProcess.get(fileId) || {};
  };

  getDownloadDataForFileByPath = filePath => {
    const fileId = this.fileIdForPath(filePath);
    return this._fileProcess.get(fileId) || {};
  };

  // Returns a hash of download objects keyed by fileId
  getDownloadDataForFiles(fileIds = []) {
    const downloadData = {};
    fileIds.forEach(fileId => {
      downloadData[fileId] = this.getDownloadDataForFile(fileId);
    });
    return downloadData;
  }

  previewPathsForFiles(fileIds = []) {
    const previewPaths = {};
    fileIds.forEach(fileId => {
      previewPaths[fileId] = this.previewPathForFile(fileId);
    });
    return previewPaths;
  }

  previewPathForFile(fileId) {
    return this._filePreviewPaths[fileId];
  }

  async _prepareAndResolveFilePath(file) {
    let filePath = this.pathForFile(file);

    if (fileAcessibleAtPath(filePath)) {
      this._generatePreview(file);
    } else {
      // try to find the file in the directory (it should be the only file)
      // this allows us to handle obscure edge cases where the sync engine
      // the file with an altered name.
      const dir = path.dirname(filePath);
      const items = fs
        .readdirSync(dir)
        .filter(i => i !== '.DS_Store' && !i.endsWith('.part') && !i.endsWith('.partns'));
      if (items.length === 1) {
        filePath = path.join(dir, items[0]);
      }
    }

    return filePath;
  }
  _extractTnefFile(file, message) {
    if (!(file instanceof File)) {
      AppEnv.logError('AttachmentStore:extractTnefFile file must be instance of File');
      return;
    }
    if (!(message instanceof Message)) {
      AppEnv.logError('AttachmentStore:extractTnefFile message must be instance of Message');
      return;
    }
    if (file.state === Constant.FileState.Removed) {
      AppEnv.logError(`File is already marked as removed, will not extract`);
      return;
    }
    if (!file.isTNEFType()) {
      AppEnv.logWarning(`File ${file.id} is not tnef file, ignoring`);
      return;
    }
    if (this._extractingTnefFile[file.id]) {
      AppEnv.logWarning(`File ${file.id} is currently being extracted, ignoring`);
      return;
    }
    this._extractingTnefFile[file.id] = true;
    return new Promise((resolve, reject) => {
      fs.access(this.pathForFile(file), err => {
        if (err) {
          AppEnv.logError(`File ${file.id} access failed ${err}`);
          delete this._extractingTnefFile[file.id];
          reject(err);
          return;
        }
        const tmpPath = path.join(this.pathForFileFolder(file), 'tmp');
        fs.mkdir(tmpPath, err => {
          if (err) {
            if (err.code !== 'EEXIST') {
              AppEnv.logError(`Creating path ${tmpPath} for ${file.id} failed ${err}`);
              delete this._extractingTnefFile[file.id];
              reject(err);
              return;
            }
          }
          tnef
            .extractFiles(this.pathForFile(file), tmpPath)
            .then(filesInfo => {
              const total = filesInfo.length;
              const newFiles = [];
              let processed = 0;
              const onAllProcessed = () => {
                const task = new ExpandMessageAttachmentTask({
                  originalAttachmentId: file.id,
                  accountId: message.accountId,
                  files: newFiles,
                  messageId: message.id,
                });
                if (task) {
                  TaskQueue()
                    .waitForPerformLocal(task, { sendTask: true, timeout: 500 })
                    .then(() => {
                      delete this._extractingTnefFile[file.id];
                      resolve(newFiles);
                    })
                    .catch(err => {
                      delete this._extractingTnefFile[file.id];
                      reject();
                    });
                } else {
                  delete this._extractingTnefFile[file.id];
                  reject();
                }
              };
              filesInfo.forEach(fileInfo => {
                const newFile = new File({
                  id: uuid(),
                  messageId: message.id,
                  filename: fileInfo.name,
                  contentType: fileInfo.contentType,
                  contentId: fileInfo.contentId,
                  isInline: !!fileInfo.contentId,
                  size: fileInfo.sizeInBytes,
                  state: Constant.FileState.IgnoreMissing,
                });
                const newFolderDest = this.pathForFileFolder(newFile);
                fs.mkdir(newFolderDest, { recursive: true }, err => {
                  if (err) {
                    AppEnv.logError(
                      `Creating new path ${newFolderDest} for ${file.id} failed ${err}`
                    );
                    delete this._extractingTnefFile[file.id];
                    reject(err);
                    return;
                  }
                  if (fileInfo && (fileInfo.path || fileInfo.name)) {
                    const copyPath = path.join(tmpPath, fileInfo.path || fileInfo.name);
                    const destPath = this.pathForFile(newFile);
                    fs.copyFile(copyPath, destPath, err => {
                      if (err) {
                        AppEnv.logError(
                          `AttachmentStore:extractTnefFiles: error while copying extracted file ${fileInfo.name} from ${copyPath} to ${destPath}, ${err}`
                        );
                      } else {
                        newFiles.push(newFile);
                      }
                      fs.unlink(path.join(tmpPath, fileInfo.path || fileInfo.name), err => {
                        if (err) {
                          AppEnv.logDebug(
                            `AttachmentStore:extractTnefFiles: error while removing extracted copy ${err}`
                          );
                        }
                      });
                      processed++;
                      if (processed === total) {
                        onAllProcessed();
                      }
                    });
                  } else {
                    processed++;
                    if (processed === total) {
                      onAllProcessed();
                    }
                  }
                });
              });
            })
            .catch(error => {
              delete this._extractingTnefFile[file.id];
              reject(error);
            });
        });
      });
    });
  }

  async _generatePreview(file) {
    if (process.platform !== 'darwin') {
      return Promise.resolve();
    }
    if (!AppEnv.config.get('core.attachments.displayFilePreview')) {
      return Promise.resolve();
    }
    if (NonPreviewableExtensions.includes(file.displayExtension())) {
      return Promise.resolve();
    }
    if (file.size > PREVIEW_FILE_SIZE_LIMIT) {
      return Promise.resolve();
    }

    const filePath = this.pathForFile(file);
    const previewPath = `${filePath}.png`;

    if (fileAcessibleAtPath(previewPath)) {
      // If the preview file already exists, set our state and bail
      this._filePreviewPaths[file.id] = previewPath;
      this.trigger();
      return Promise.resolve();
    }

    // If the preview file doesn't exist yet, generate it
    const fileDir = `"${path.dirname(filePath)}"`;
    const escapedPath = `"${filePath}"`;

    return new Promise(resolve => {
      const previewSize = THUMBNAIL_WIDTH * (11 / 8.5);
      exec(
        `qlmanage -t -f ${window.devicePixelRatio} -s ${previewSize} -o ${fileDir} ${escapedPath}`,
        (error, stdout, stderr) => {
          if (error) {
            // Ignore errors, we don't really mind if we can't generate a preview
            // for a file
            AppEnv.reportError(error);
            resolve();
            return;
          }
          if (stdout.match(/No thumbnail created/i) || stderr) {
            resolve();
            return;
          }
          this._filePreviewPaths[file.id] = previewPath;
          this.trigger();
          resolve();
        }
      );
    });
  }

  // Section: Retrieval of Files

  _fetch = file => {
    return (
      this._prepareAndResolveFilePath(file)
        .catch(this._catchFSErrors)
        // Passively ignore
        .catch(() => {})
    );
  };

  _fetchAndOpen = file => {
    return this._prepareAndResolveFilePath(file)
      .then(filePath => remote.shell.openPath(filePath))
      .catch(this._catchFSErrors)
      .catch(error => {
        return this._presentError({ file, error });
      });
  };

  _writeToExternalPath = (filePath, savePath) => {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath);
      stream.pipe(fs.createWriteStream(savePath));
      stream.on('error', err => reject(err));
      stream.on('end', () => resolve());
    });
  };

  _saveFileToUserDir = async ({ file, accountId }) => {
    const defaultFileName = file.safeDisplayName();
    const savePath = await AppEnv.getFilePathForSaveFile({ defaultPath: defaultFileName });
    if (!savePath) {
      return;
    }
    const defaultExtension = path.extname(defaultFileName);
    const saveExtension = path.extname(savePath);
    const didLoseExtension = defaultExtension !== '' && saveExtension === '';
    const actualSavePath = `${savePath}${didLoseExtension ? defaultExtension : ''}`;
    this._pushSaveFileToQueue({
      file: file,
      accountId,
      savePath: actualSavePath,
    });
  };

  _saveAllFilesToUserDir = async ({ files, accountId }) => {
    const options = {
      title: 'Save Into...',
      buttonLabel: 'Download All',
    };
    const saveDirPath = await AppEnv.getDirPathForSaveFile(options);
    if (!saveDirPath) {
      return;
    }
    const saveTask = {
      files: files,
      // File save path must be generated when saving
      // Because different files may have the same path
      dirPath: saveDirPath,
      accountId,
    };

    this._pushSaveAllFilesToQueue(saveTask);
  };

  _filesNotDownloaded(files) {
    return files.filter(file => {
      const filePath = this.pathForFile(file);
      if (filePath && fs.existsSync(filePath)) {
        this._onPresentSuccess([file.id]);
        return false;
      }
      return true;
    });
  }

  _pushSaveFileToQueue(task) {
    const taskFileId = task && task.file && task.file.id ? task.file.id : '';
    const filesNotDownloaded = this._filesNotDownloaded([task.file]);
    // del the old task that has some file with now task
    const pureTasks = this._saveFileQueue.filter(
      t => t && t.file && t.file.id && t.file.id !== taskFileId
    );
    if (filesNotDownloaded.length > 0) {
      this._saveFileQueue = [...pureTasks, task];
      Actions.fetchAttachments({
        accountId: task.accountId,
        missingItems: filesNotDownloaded.map(f => f.id),
        needProgress: true,
        source: 'Click',
      });
    } else {
      this._saveFileQueue = [...pureTasks];
      this._saveFileForTask(task);
    }
  }

  _pushSaveAllFilesToQueue(task) {
    const taskFilesId = task.files.map(file => file.id).join('|');
    const filesNotDownloaded = this._filesNotDownloaded(task.files);
    // del the old task that has some files with now task
    const pureTasks = this._saveAllFilesQueue.filter(t => {
      let strDelFilesId = taskFilesId;
      t.files.forEach(file => {
        strDelFilesId = strDelFilesId.replace(file.id, '');
      });
      return strDelFilesId.replace(/\|/g, '') !== '';
    });
    if (filesNotDownloaded.length > 0) {
      this._saveAllFilesQueue = [...pureTasks, task];
      Actions.fetchAttachments({
        accountId: task.accountId,
        missingItems: filesNotDownloaded.map(f => f.id),
        needProgress: true,
        source: 'Click',
      });
    } else {
      this._saveAllFilesQueue = [...pureTasks];
      this._saveAllFilesForTask(task);
    }
  }

  _consumeSaveQueue() {
    this._consumeSaveFileQueue();
    this._consumeSaveAllFilesQueue();
  }

  _consumeSaveFileQueue() {
    this._saveFileQueue = this._saveFileQueue.filter(task => {
      const downloadState = this.getDownloadDataForFile(task.file.id);
      if (downloadState.state === AttachmentDownloadState.done) {
        this._saveFileForTask(task);
        return false;
      }
      return true;
    });
  }

  _consumeSaveAllFilesQueue() {
    this._saveAllFilesQueue = this._saveAllFilesQueue.filter(task => {
      const allFileDownload = task.files.every(file => {
        const downloadState = this.getDownloadDataForFile(file.id);
        return downloadState.state === AttachmentDownloadState.done;
      });
      if (allFileDownload) {
        this._saveAllFilesForTask(task);
        return false;
      }
      return true;
    });
  }

  _saveFileForTask(task) {
    const { file, savePath } = task;
    // Return a method is for to handle errors in promise's catch
    const beforeSaveFn = () => {
      return {
        file: file,
        fileSavePath: savePath,
      };
    };

    this._saveAllFiles({ beforeSaveFns: [beforeSaveFn], dirPath: path.dirname(savePath) });
  }

  _saveAllFilesForTask(task) {
    const { files, dirPath } = task;
    const beforeSaveFns = files.map(file => {
      // Return a method is for to handle errors in promise's catch
      return () => {
        const fileSaveName = autoGenerateFileName(dirPath, file.safeDisplayName());
        const savePath = path.join(dirPath, fileSaveName);
        return {
          file: file,
          fileSavePath: savePath,
        };
      };
    });
    this._saveAllFiles({ beforeSaveFns: beforeSaveFns, dirPath: dirPath });
  }

  _saveAllFiles(SaveData) {
    const { beforeSaveFns, dirPath } = SaveData;
    const files = [];
    const lastSavePaths = [];
    const stopAccessingSecurityScopedResource = AppEnv.startAccessingForFile(dirPath);
    const savePromises = beforeSaveFns.map(fn => {
      return (async () => {
        const { file, fileSavePath } = fn();
        if (!file || !fileSavePath) {
          return;
        }
        const filePath = await this._prepareAndResolveFilePath(file);
        await this._writeToExternalPath(filePath, fileSavePath);
        files.push(file);
        lastSavePaths.push(fileSavePath);
      })();
    });
    Promise.all(savePromises)
      .then(() => {
        if (
          lastSavePaths.length > 0 &&
          AppEnv.config.get('core.attachments.openFolderAfterDownload')
        ) {
          remote.shell.showItemInFolder(lastSavePaths[0]);
        }
        this._onSaveSuccess(files);
        if (stopAccessingSecurityScopedResource) {
          stopAccessingSecurityScopedResource();
        }
      })
      .catch(this._catchFSErrors)
      .catch(error => {
        if (stopAccessingSecurityScopedResource) {
          stopAccessingSecurityScopedResource();
        }
        return this._presentError({ error });
      });
  }

  _onSaveSuccess = files => {
    if (files && files.length) {
      files.forEach(file => {
        this._onToggleSaveSuccessState(file.id);
      });
    }
  };

  _onToggleSaveSuccessState = fileId => {
    if (this._fileSaveSuccess.get(fileId)) {
      this._fileSaveSuccess.delete(fileId);
    } else {
      this._fileSaveSuccess.set(fileId, true);
      setTimeout(() => {
        this._onToggleSaveSuccessState(fileId);
      }, 1600);
    }
    this.trigger();
  };

  getSaveSuccessState = fileId => {
    if (this._fileSaveSuccess.get(fileId)) {
      return true;
    } else {
      return false;
    }
  };

  refreshAttachmentsState = ({ fileId = '', filePath = '' } = {}) => {
    // const file = this.getAttachment(fileId);
    // const filePath = this.pathForFile(file);
    if (filePath && fs.existsSync(filePath)) {
      this._onPresentSuccess([fileId]);
    }
  };

  _abortFetchFile = () => {
    // file
    // put this back if we ever support downloading individual files again
    return;
  };

  _onFetchAttachments = ({ missingItems, needProgress, source }) => {
    if (needProgress && (source || '').toLocaleLowerCase() === 'click') {
      this._onPresentStart(missingItems);
    }
  };

  _onPresentStart = ids => {
    const fileIds = ids || [];
    if (fileIds.length) {
      let changed = false;
      fileIds.forEach(id => {
        const oldProcess = this.getDownloadDataForFile(id);
        if (
          oldProcess &&
          (oldProcess.state === AttachmentDownloadState.downloading ||
            oldProcess.state === AttachmentDownloadState.done)
        ) {
          return;
        }
        changed = true;
        this._fileProcess.set(id, {
          state: AttachmentDownloadState.downloading,
          percent: 0,
        });
      });
      if (changed) {
        this._triggerDebounced();
      }
    }
  };

  _onPresentChange = changes => {
    if (changes && changes.length) {
      const failFileIds = [];
      const successFileIds = [];
      changes.forEach(obj => {
        if (obj) {
          const pid = obj.pid;
          if (!pid) {
            return;
          }
          const nowState = this.getDownloadDataForFile(pid);
          if (nowState && nowState.state === AttachmentDownloadState.done) {
            return;
          }
          // const matchGroup = (obj.errormsg || '').match(/errCode\s*=\s*([0-9]*)\s*,(.*)/);
          // const errCode = matchGroup && matchGroup[1] ? Number(matchGroup[1]) : 0;
          // const errMsg = matchGroup && matchGroup[2] ? matchGroup[2].trim() : '';
          if (obj.state === AttachmentDownloadState.fail) {
            // download faild
            failFileIds.push(pid);
            return;
          }
          if (obj.state === AttachmentDownloadState.done) {
            // download success
            successFileIds.push(pid);
            return;
          }
          const nowPercent = nowState && nowState.percent ? nowState.percent : 0;
          const percent = obj.cursize && obj.maxsize ? obj.cursize / obj.maxsize : 0;
          const maxPercent = Math.min(Math.max(parseInt(percent * 100), nowPercent), 100);
          this._fileProcess.set(pid, {
            state: AttachmentDownloadState.downloading,
            percent: maxPercent,
          });
        }
      });
      if (failFileIds.length) {
        this._onPresentFail(failFileIds);
      }
      if (successFileIds.length) {
        this._onPresentSuccess(successFileIds);
      }
      this._triggerDebounced();
    }
  };

  _onPresentSuccess = ids => {
    const fileIds = ids || [];
    if (fileIds.length) {
      fileIds.forEach(id => {
        this._fileProcess.set(id, {
          state: AttachmentDownloadState.done,
          percent: 100,
        });
      });
      this._consumeSaveQueue();
      this._triggerDebounced();
    }
  };

  _onPresentFail = ids => {
    const fileIds = ids || [];
    if (fileIds.length) {
      fileIds.forEach(id => {
        this._fileProcess.set(id, {
          state: AttachmentDownloadState.fail,
          percent: 0,
        });
      });
      this._triggerDebounced();
    }
  };

  _presentError({ file, error } = {}) {
    const name = file ? file.displayName() : 'one or more files';
    const errorString = error ? error.toString() : '';

    return remote.dialog.showMessageBox({
      type: 'warning',
      message: 'Download Failed',
      detail: `Unable to download ${name}. Check your network connection and try again. ${errorString}`,
      buttons: ['OK'],
    });
  }

  _catchFSErrors(error) {
    let message = null;
    if (['EPERM', 'EMFILE', 'EACCES'].includes(error.code)) {
      message =
        'EdisonMail could not save an attachment. Check that permissions are set correctly and try restarting EdisonMail if the issue persists.';
    }
    if (['ENOSPC'].includes(error.code)) {
      message = 'EdisonMail could not save an attachment because you have run out of disk space.';
    }

    if (message) {
      remote.dialog.showMessageBox({
        type: 'warning',
        message: 'Download Failed',
        detail: `${message}\n\n${error.message}`,
        buttons: ['OK'],
      });
      return Promise.resolve();
    }
    return Promise.reject(error);
  }

  // Section: Adding Files

  _assertIdPresent(messageId) {
    if (!messageId) {
      throw new Error('You need to pass the ID of the message (draft) this Action refers to');
    }
  }

  _getFileStats(filepath) {
    return fs
      .statAsync(filepath)
      .catch(() =>
        Promise.reject(
          new Error(`${filepath} could not be found, or has invalid file permissions.`)
        )
      );
  }

  createNewFile({ data, inline = false, filename = null, contentType = null, extension = null }) {
    const id = extension ? `${Utils.generateTempId()}.${extension}` : Utils.generateTempId();
    const file = new File({
      id: id,
      filename: filename || id,
      contentType: contentType,
      messageId: null,
      contentId: inline ? Utils.generateContentId() : null,
      isInline: inline,
    });
    return this._writeToInternalPath(data, this.pathForFile(file)).then(stats => {
      file.size = stats.size;
      return Promise.resolve(file);
    });
  }

  _writeToInternalPath(data, targetPath) {
    const buffer = new Uint8Array(Buffer.from(data));
    const parentPath = path.dirname(targetPath);
    return new Promise((resolve, reject) => {
      mkdirpAsync(parentPath).then(() => {
        fs.writeFile(targetPath, buffer, err => {
          if (err) {
            reject(err);
          } else {
            fs.stat(targetPath, (error, stats) => {
              if (error) {
                reject(error);
              } else {
                resolve(stats);
              }
            });
          }
        });
      });
    });
  }

  _copyToInternalPath(originPath, targetPath) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(originPath);
      const writeStream = fs.createWriteStream(targetPath);

      readStream.on('error', () => reject(new Error(`Could not read file at path: ${originPath}`)));
      writeStream.on('error', () =>
        reject(new Error(`Could not write ${path.basename(targetPath)} to files directory.`))
      );
      readStream.on('end', () => resolve());
      readStream.pipe(writeStream);
    });
  }

  async _deleteFile(file) {
    try {
      // Delete the file and it's containing folder. Todo: possibly other empty dirs?
      let removeFinishedCount = 0;
      const filePath = this.pathForFile(file);
      fs.unlink(filePath, err => {
        if (err) {
          AppEnv.reportError('Delete attachment failed: ', err);
        }
        removeFinishedCount++;
        if (removeFinishedCount === 2) {
          fs.rmdir(path.dirname(filePath), err => {
            if (err) {
              AppEnv.reportError('Delete attachment failed: ', err);
            }
          });
        }
      });
      fs.unlink(filePath + '.png', err => {
        if (err) {
          if (err.code !== 'ENOENT') {
            AppEnv.reportError('Delete attachment failed: ', err);
          }
        }
        removeFinishedCount++;
        if (removeFinishedCount === 2) {
          fs.rmdir(path.dirname(filePath), err => {
            if (err) {
              AppEnv.reportError('Delete attachment failed: ', err);
            }
          });
        }
      });
    } catch (err) {
      throw new Error(`Error deleting file file ${file.filename}:\n\n${err.message}`);
    }
  }

  async _applySessionChanges(messageId, changeFunction, { skipSaving = false } = {}) {
    const session = await DraftStore.sessionForClientId(messageId);
    const files = changeFunction(session.draft().files);
    console.log(`update attachments with applySession changes`, files);
    session.changes.add({ files }, { skipSaving });
    session.updateAttachments(files, { commit: !skipSaving });
    // session.changes.commit();
  }

  // Handlers

  _onSelectAttachment = ({ messageId, accountId, onCreated = () => {}, type = '*' }) => {
    this._assertIdPresent(messageId);

    // When the dialog closes, it triggers `Actions.addAttachment`
    const cb = paths => {
      if (paths == null) {
        return;
      }
      let pathsToOpen = paths;
      if (typeof pathsToOpen === 'string') {
        pathsToOpen = [pathsToOpen];
      }
      if (pathsToOpen.length > 1) {
        Actions.addAttachments({
          messageId,
          accountId,
          filePaths: pathsToOpen,
          onCreated,
          inline: type === 'image',
        });
      } else {
        Actions.addAttachment({
          messageId,
          accountId,
          filePath: pathsToOpen[0],
          onCreated,
          inline: type === 'image',
        });
      }
    };
    if (type === 'image') {
      return AppEnv.showImageSelectionDialog(cb);
    }
    return AppEnv.showOpenDialog({ properties: ['openFile', 'multiSelections'] }, cb);
  };
  bulkUpdateDraftFiles = ({ messageId = '', newFiles = [], onCreated = () => {} }) => {
    const newFilesSize = newFiles.reduce((c, f) => {
      const newSize = parseInt(f.size);
      return c + (isNaN(newSize) ? 0 : newSize);
    }, 0);
    this._applySessionChanges(messageId, files => {
      if (
        files.reduce((c, f) => {
          const newSize = parseInt(f.size);
          return c + (isNaN(newSize) ? 0 : newSize);
        }, 0) +
          newFilesSize >=
        25 * 1000000
      ) {
        AppEnv.trackingEvent('largeAttachmentSize');
        throw new Error(`Sorry, you can't attach more than 25MB of attachments`);
      }
      return files.concat(newFiles);
    })
      .then(() => {
        console.log('bulk updated files');
        onCreated(newFiles);
      })
      .catch(e => {
        AppEnv.showErrorDialog({
          title: 'Attachments not added',
          message: e.message,
        });
      });
  };
  _onAddAttachments = async ({
    messageId,
    accountId,
    inline = false,
    filePaths = [],
    onCreated = () => {},
  }) => {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      throw new Error('_onAddAttachments must have an array of filePaths');
    }
    this._assertIdPresent(messageId);
    try {
      const total = filePaths.length;
      // const createdFiles = [];
      const newFiles = [];
      let processed = 0;
      filePaths.forEach(filePath => {
        const filename = path.basename(filePath);
        this._getFileStats(filePath)
          .then(stats => {
            if (stats.isDirectory()) {
              throw new Error(
                `${filename} is a directory. Try compressing it and attaching it again.`
              );
            } else if (stats.size > 25 * 1000000) {
              AppEnv.trackingEvent('largeAttachmentSize');
              throw new Error(`${filename} cannot be attached because it is larger than 25MB.`);
            }
            const file = new File({
              id: `local-${uuid()}`,
              messageId,
              accountId,
              filename: filename,
              size: stats.size,
              contentType: null,
              contentId: inline ? Utils.generateContentId() : null,
              isInline: inline,
            });
            const dstPath = this.pathForFile(file);
            const tmpData = {
              accountId,
              messageId,
              originalPath: filePath,
              dstFile: { fileId: file.id, filePath: dstPath },
            };
            if (AppEnv.isMainWindow()) {
              this.copyAttachmentToDraft(tmpData);
            } else {
              Actions.syncAttachmentToMain(tmpData);
            }
            processed++;
            newFiles.push(file);
            if (processed === total) {
              this.bulkUpdateDraftFiles({ messageId, newFiles, onCreated });
              if (newFiles.length < total) {
                const num = total - newFiles.length;
                AppEnv.showErrorDialog({
                  title: 'Not all attachments are added',
                  message: `${total - newFiles.length} attachment ${
                    num > 1 ? 's are' : ''
                  } not added`,
                });
              }
            }
          })
          .catch(e => {
            processed++;
            if (processed === total) {
              this.bulkUpdateDraftFiles({ messageId, newFiles, onCreated });
              if (newFiles.length < total) {
                const num = total - newFiles.length;
                AppEnv.showErrorDialog({
                  title: 'Not all attachments are added',
                  message: `${total - newFiles.length} attachment ${
                    num > 1 ? 's are' : ''
                  } not added`,
                });
              }
            }
            AppEnv.logError(e);
          });
      });
    } catch (err) {
      AppEnv.logError(err);
      AppEnv.showErrorDialog(err.message);
    }
  };

  _onAddAttachment = async ({
    accountId,
    messageId,
    filePath,
    inline = undefined,
    isSigOrTempAttachments = false,
    skipSaving = false,
    onCreated = () => {},
  }) => {
    this._assertIdPresent(messageId);

    try {
      const filename = path.basename(filePath);
      const stats = await this._getFileStats(filePath);
      if (stats.isDirectory()) {
        throw new Error(`${filename} is a directory. Try compressing it and attaching it again.`);
      } else if (stats.size > 25 * 1000000) {
        AppEnv.trackingEvent('largeAttachmentSize');
        throw new Error(`${filename} cannot be attached because it is larger than 25MB.`);
      }

      const file = new File({
        id: `local-${uuid()}`,
        filename: filename,
        size: stats.size,
        contentType: null,
        messageId,
        accountId,
        contentId: inline ? Utils.generateContentId() : null,
        isInline: inline,
      });
      // Is the attachment is in signature or template
      if (isSigOrTempAttachments) {
        file.isSigOrTempAttachments = true;
      }
      if (inline === undefined && Utils.shouldDisplayAsImage(file)) {
        console.log('should be image but not set as inline');
        file.isInline = true;
        file.contentId = Utils.generateContentId();
      }
      const dstPath = this.pathForFile(file);
      const tmpData = {
        accountId,
        messageId,
        originalPath: filePath,
        dstFile: { fileId: file.id, filePath: dstPath },
      };
      if (AppEnv.isMainWindow()) {
        this.copyAttachmentToDraft(tmpData);
      } else {
        Actions.syncAttachmentToMain(tmpData);
      }
      // await mkdirpAsync(path.dirname(this.pathForFile(file)));
      // await this._copyToInternalPath(filePath, this.pathForFile(file));

      await this._applySessionChanges(
        messageId,
        files => {
          const fileSize = parseInt(file.size);
          const totalSize =
            files.reduce((c, f) => {
              const newSize = parseInt(f.size);
              return c + (isNaN(newSize) ? 0 : newSize);
            }, 0) + (isNaN(fileSize) ? 0 : fileSize);

          if (totalSize >= 25 * 1000000) {
            AppEnv.trackingEvent('largeAttachmentSize');
            throw new Error(`Sorry, you can't attach more than 25MB of attachments`);
          }
          return files.concat([file]);
        },
        { skipSaving }
      );
      onCreated(file);
    } catch (err) {
      AppEnv.logError(err);
      AppEnv.showErrorDialog(err.message);
    }
  };

  addSigOrTempAttachments = async (attachments, messageId, accountId, skipSaving = false) => {
    const fileMap = new Map();
    const addPromise = (path, inline) => {
      return new Promise((resolve, reject) => {
        const onCreated = file => {
          resolve(file);
        };
        try {
          this._onAddAttachment({
            messageId: messageId,
            accountId: accountId,
            filePath: path,
            inline: inline,
            isSigOrTempAttachments: true,
            skipSaving,
            onCreated,
          });
        } catch (err) {
          reject(err);
        }
      });
    };
    for (const atta of attachments) {
      const file = await addPromise(atta.path, atta.inline);
      fileMap.set(atta.path, file);
    }
    return fileMap;
  };

  _onAddAttachmentFromNonMainWindow(data) {
    if (!AppEnv.isMainWindow()) {
      return;
    }
    this.copyAttachmentToDraft(data);
  }
  _onRemoveAttachments = ({ accountId, messageId, filesToRemove = [] }) => {
    if (!Array.isArray(filesToRemove) || filesToRemove.length === 0) {
      return;
    }
    const removeIds = filesToRemove.map(f => f.id);
    this._applySessionChanges(messageId, files => {
      return files.filter(({ id }) => !removeIds.includes(id));
    }).then(() => {
      if (AppEnv.isMainWindow()) {
        this._onRemoveAttachmentsMainWindow({ accountId, filesToRemove, messageId });
      } else {
        Actions.removeAttachmentsToMain({ accountId, filesToRemove, messageId });
      }
    });
  };

  _onRemoveAttachment = ({ accountId, messageId, fileToRemove }) => {
    if (!fileToRemove) {
      return;
    }
    console.log(`file to remove id: ${fileToRemove.id}`);
    this._applySessionChanges(messageId, files => {
      return files.filter(({ id }) => id !== fileToRemove.id);
    }).then(() => {
      if (AppEnv.isMainWindow()) {
        this._onRemoveAttachmentMainWindow({ accountId, messageId, fileToRemove });
      } else {
        Actions.removeAttachmentToMain({ accountId, messageId, fileToRemove });
      }
    });
  };
  _onRemoveAttachmentsMainWindow({ accountId, messageId, filesToRemove }) {
    if (!Array.isArray(filesToRemove) || filesToRemove.length === 0) {
      return;
    }
    filesToRemove.forEach(fileToRemove => {
      this._onRemoveAttachmentMainWindow({ accountId, messageId, fileToRemove });
    });
  }
  _onRemoveAttachmentMainWindow({ accountId, messageId, fileToRemove }) {
    console.log('removing file in main window', fileToRemove.id);
    this.deleteDraftAttachment({ accountId, messageId, fileId: fileToRemove.id });
  }
}

export default new AttachmentStore();
