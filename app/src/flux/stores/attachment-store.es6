import os from 'os';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { remote } from 'electron';
import mkdirp from 'mkdirp';
import MailspringStore from 'mailspring-store';
import DraftStore from './draft-store';
import Actions from '../actions';
import File from '../models/file';
import Utils from '../models/utils';
import mime from 'mime-types';
import DatabaseStore from './database-store';
import AttachmentProgress from '../models/attachment-progress';
import { autoGenerateFileName } from '../../fs-utils';
import ca from 'moment/locale/ca';

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

class AttachmentStore extends MailspringStore {
  constructor() {
    super();

    // viewing messages
    this.listenTo(Actions.fetchFile, this._fetch);
    this.listenTo(Actions.fetchAndOpenFile, this._fetchAndOpen);
    this.listenTo(Actions.fetchAndSaveFile, this._fetchAndSave);
    this.listenTo(Actions.fetchAndSaveAllFiles, this._fetchAndSaveAll);
    this.listenTo(Actions.abortFetchFile, this._abortFetchFile);
    this.listenTo(Actions.fetchAttachments, this._onFetchAttachments);

    // sending
    this.listenTo(Actions.addAttachment, this._onAddAttachment);
    this.listenTo(Actions.addAttachments, this._onAddAttachments);
    this.listenTo(Actions.selectAttachment, this._onSelectAttachment);
    this.listenTo(Actions.removeAttachment, this._onRemoveAttachment);
    this._attachementCache = Utils.createCircularBuffer(200);
    this._missingDataAttachmentIds = new Set();
    this._queryFileDBTimer = null;
    this._filePreviewPaths = {};
    this._filesDirectory = path.join(AppEnv.getConfigDirPath(), 'files');
    this._fileProcess = new Map();
    this._fileSaveSuccess = new Map();
    mkdirp(this._filesDirectory);

    DatabaseStore.listen(change => {
      if (change.objectClass === AttachmentProgress.name) {
        this._onPresentChange(change.objects);
      }
    });
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
    return DatabaseStore.findAll(File);
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
  setAttachmentData(attachmentData) {
    if (attachmentData.mimeType) {
      return this.addAttachmentPartialData(attachmentData);
    } else if (attachmentData.missingData) {
      const cachedAttachment = this._attachementCache.get(attachmentData.id);
      if (cachedAttachment) {
        return;
      }
    }
    this._attachementCache.set(attachmentData.id, attachmentData);
  }
  addAttachmentPartialData(partialFileData) {
    let fileData = this._attachementCache.get(partialFileData.id);
    if (!fileData) {
      console.log(`file id already not in cache ${partialFileData.id}`);
      fileData = File.fromPartialData(partialFileData);
      this._attachementCache.set(fileData.id, fileData);
    }
    if (fileData.missingData) {
      console.log(`file missing data, queue db ${fileData.id}`);
      this._addToMissingDataAttachmentIds(fileData.id);
    }
    return fileData;
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
    return this._fileProcess.get(fileId);
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
      const items = fs.readdirSync(dir).filter(i => i !== '.DS_Store');
      if (items.length === 1) {
        filePath = path.join(dir, items[0]);
      }
    }

    return filePath;
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
      .then(filePath => remote.shell.openItem(filePath))
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

  _fetchAndSave = file => {
    const defaultPath = file.safeDisplayName();
    const defaultExtension = path.extname(defaultPath);

    AppEnv.showSaveDialog({ defaultPath }, savePath => {
      if (!savePath) {
        return;
      }

      const saveExtension = path.extname(savePath);
      const newDownloadDirectory = path.dirname(savePath);
      const didLoseExtension = defaultExtension !== '' && saveExtension === '';
      let actualSavePath = savePath;
      if (didLoseExtension) {
        actualSavePath += defaultExtension;
      }

      this._prepareAndResolveFilePath(file)
        .then(filePath => this._writeToExternalPath(filePath, actualSavePath))
        .then(() => {
          if (AppEnv.config.get('core.attachments.openFolderAfterDownload')) {
            remote.shell.showItemInFolder(actualSavePath);
          }
          this._onSaveSuccess([file]);
        })
        .catch(this._catchFSErrors)
        .catch(error => {
          this._presentError({ file, error });
        });
    });
  };

  _fetchAndSaveAll = files => {
    const options = {
      title: 'Save Into...',
      buttonLabel: 'Download All',
    };
    AppEnv.showSaveDirDialog(options, dirPath => {
      if (!dirPath) {
        return;
      }
      this._saveAllFilesToDir(files, dirPath);
    });
  };

  _saveAllFilesToDir = (files, dirPath) => {
    const lastSavePaths = [];
    const savePromises = files.map(file => {
      const fileSaveName = autoGenerateFileName(dirPath, file.safeDisplayName());
      const savePath = path.join(dirPath, fileSaveName);
      return this._prepareAndResolveFilePath(file)
        .then(filePath => this._writeToExternalPath(filePath, savePath))
        .then(() => lastSavePaths.push(savePath));
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
      })
      .catch(this._catchFSErrors)
      .catch(error => {
        return this._presentError({ error });
      });
  };

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

  refreshAttachmentsState = fileId => {
    const file = this.getAttachment(fileId);
    const filePath = this.pathForFile(file);
    if (filePath && fs.existsSync(filePath)) {
      this._onPresentSuccess([fileId]);
    }
  };

  _abortFetchFile = () => {
    // file
    // put this back if we ever support downloading individual files again
    return;
  };

  _onFetchAttachments = ({ missingItems, needProgress }) => {
    if (!needProgress) {
      return;
    }
    this._onPresentStart(missingItems);
  };

  _onPresentStart = ids => {
    const fileIds = ids || [];
    if (fileIds.length) {
      fileIds.forEach(id => {
        const oldProcess = this._fileProcess.get(id);
        if (oldProcess && oldProcess.state === 'downloading') {
          return;
        }
        this._fileProcess.set(id, {
          state: 'downloading',
          percent: 0,
        });
      });
      this.trigger();
    }
  };

  _onPresentChange = changes => {
    if (changes && changes.length) {
      changes.forEach(obj => {
        if (obj) {
          const pid = obj.pid;
          const percent = obj.cursize && obj.maxsize ? obj.cursize / obj.maxsize : 0;
          const nowState = this.getDownloadDataForFile(pid);
          const nowPercent = nowState && nowState.percent ? nowState.percent : 0;
          const maxPercent = Math.max(parseInt(percent * 100), nowPercent);
          if (pid && maxPercent) {
            this._fileProcess.set(pid, {
              state: maxPercent >= 100 ? 'done' : 'downloading',
              percent: maxPercent,
            });
          }
        }
      });
      this.trigger();
    }
  };

  _onPresentSuccess = ids => {
    const fileIds = ids || [];
    if (fileIds.length) {
      fileIds.forEach(id => {
        this._fileProcess.set(id, {
          state: 'done',
          percent: 100,
        });
      });
      this.trigger();
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

  _assertIdPresent(headerMessageId) {
    if (!headerMessageId) {
      throw new Error('You need to pass the headerID of the message (draft) this Action refers to');
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
      fs.unlink(this.pathForFile(file), err => {
        if (err) {
          AppEnv.reportError('Delete attachment failed: ', err);
        }
        removeFinishedCount++;
        if (removeFinishedCount === 2) {
          fs.rmdir(path.dirname(this.pathForFile(file)), err => {
            if (err) {
              AppEnv.reportError('Delete attachment failed: ', err);
            }
          });
        }
      });
      fs.unlink(this.pathForFile(file) + '.png', err => {
        if (err) {
          if (err.code !== 'ENOENT') {
            AppEnv.reportError('Delete attachment failed: ', err);
          }
        }
        removeFinishedCount++;
        if (removeFinishedCount === 2) {
          fs.rmdir(path.dirname(this.pathForFile(file)), err => {
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

  async _applySessionChanges(headerMessageId, changeFunction) {
    const session = await DraftStore.sessionForClientId(headerMessageId);
    const files = changeFunction(session.draft().files);
    session.changes.add({ files });
    session.changes.commit();
  }

  // Handlers

  _onSelectAttachment = ({ headerMessageId, onCreated = () => {}, type = '*' }) => {
    this._assertIdPresent(headerMessageId);

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
        Actions.addAttachments({ headerMessageId, filePaths: pathsToOpen, onCreated });
      } else {
        Actions.addAttachment({ headerMessageId, filePath: pathsToOpen[0], onCreated });
      }
    };
    if (type === 'image') {
      return AppEnv.showImageSelectionDialog(cb);
    }
    return AppEnv.showOpenDialog({ properties: ['openFile', 'multiSelections'] }, cb);
  };
  _onAddAttachments = async ({
    headerMessageId,
    inline = false,
    filePaths = [],
    onCreated = () => {},
  }) => {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      throw new Error('_onAddAttachments must have an array of filePaths');
    }
    this._assertIdPresent(headerMessageId);
    try {
      const total = filePaths.length;
      const createdFiles = [];
      filePaths.forEach(async filePath => {
        const filename = path.basename(filePath);
        const stats = await this._getFileStats(filePath);
        if (stats.isDirectory()) {
          throw new Error(`${filename} is a directory. Try compressing it and attaching it again.`);
        } else if (stats.size > 25 * 1000000) {
          AppEnv.trackingEvent('largeAttachmentSize');
          throw new Error(`${filename} cannot be attached because it is larger than 25MB.`);
        }

        const file = new File({
          id: Utils.generateTempId(),
          filename: filename,
          size: stats.size,
          contentType: null,
          messageId: null,
          contentId: inline ? Utils.generateContentId() : null,
        });

        await mkdirpAsync(path.dirname(this.pathForFile(file)));
        await this._copyToInternalPath(filePath, this.pathForFile(file));

        await this._applySessionChanges(headerMessageId, files => {
          if (files.reduce((c, f) => c + f.size, 0) + file.size >= 25 * 1000000) {
            AppEnv.trackingEvent('largeAttachmentSize');
            throw new Error(`Sorry, you can't attach more than 25MB of attachments`);
          }
          createdFiles.push(file);
          return files.concat([file]);
        });
        if (createdFiles.length >= total) {
          onCreated(createdFiles);
        }
      });
    } catch (err) {
      AppEnv.showErrorDialog(err.message);
    }
  };

  _onAddAttachment = async ({
    headerMessageId,
    filePath,
    inline = false,
    onCreated = () => {},
  }) => {
    this._assertIdPresent(headerMessageId);

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
        id: Utils.generateTempId(),
        filename: filename,
        size: stats.size,
        contentType: null,
        messageId: null,
        contentId: inline ? Utils.generateContentId() : null,
      });

      await mkdirpAsync(path.dirname(this.pathForFile(file)));
      await this._copyToInternalPath(filePath, this.pathForFile(file));

      await this._applySessionChanges(headerMessageId, files => {
        if (files.reduce((c, f) => c + f.size, 0) + file.size >= 25 * 1000000) {
          AppEnv.trackingEvent('largeAttachmentSize');
          throw new Error(`Sorry, you can't attach more than 25MB of attachments`);
        }
        return files.concat([file]);
      });
      onCreated(file);
    } catch (err) {
      AppEnv.showErrorDialog(err.message);
    }
  };

  _onRemoveAttachment = async (headerMessageId, fileToRemove) => {
    if (!fileToRemove) {
      return;
    }

    await this._applySessionChanges(headerMessageId, files =>
      files.filter(({ id }) => id !== fileToRemove.id)
    );

    try {
      await this._deleteFile(fileToRemove);
    } catch (err) {
      AppEnv.showErrorDialog(err.message);
    }
  };
}

export default new AttachmentStore();
