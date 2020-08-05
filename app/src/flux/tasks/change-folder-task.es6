import ChangeMailTask from './change-mail-task';
import Attributes from '../attributes';
import Folder from '../models/folder';
import Category from '../models/category';
import AccountStore from '../stores/account-store';

// Public: Create a new task to apply labels to a message or thread.
//
// Takes an options object of the form:
//   - folder: The {Folder} or {Folder} IDs to move to
//   - threads: An array of {Thread}s or {Thread} IDs
//   - threads: An array of {Message}s or {Message} IDs
//   - undoData: Since changing the folder is a destructive action,
//   undo tasks need to store the configuration of what folders messages
//   were in. When creating an undo task, we fill this parameter with
//   that configuration
//
export default class ChangeFolderTask extends ChangeMailTask {
  static attributes = Object.assign({}, ChangeMailTask.attributes, {
    previousFolder: Attributes.Object({
      modelKey: 'previousFolder',
      itemClass: Folder,
    }),
    folder: Attributes.Object({
      modelKey: 'folder',
      itemClass: Folder,
    }),
  });

  constructor(data = {}) {
    if (!data.previousFolder) {
      const folders = [];
      for (const t of data.threads || []) {
        const f = t.folders.find(f => f.id !== data.folder.id) || t.folders[0];
        if (f && !folders.find(other => other.id === f.id)) {
          folders.push(f);
        }
      }
      for (const m of data.messages || []) {
        if (!folders.find(other => other.id === m.folder.id)) {
          folders.push(m.folder);
        }
      }
      /* TODO: Right now, each task must have a single undo task. With folder moves,
       * it's possible to start with mail from many folders and move it to one folder,
       * and a single task can't represent the reverse. Right now, such moves are
       * just undoable. Need to revisit this and make createUndoTask() return an array.
       */
      if (folders.length === 1) {
        data.previousFolder = folders[0];
      }
      data.canBeUndone = true;
    }

    super(data);

    if (this.folder && !(this.folder instanceof Category)) {
      throw new Error('ChangeFolderTask: You must provide a single folder.');
    }

    // Remember the folder that users often use
    if (this.folder) {
      AccountStore.setHighFrequencyFolder(this.accountId, [this.folder.id]);
    }
  }

  label() {
    if (this.folder) {
      return `Moving to ${this.folder.displayName}`;
    }
    return 'Moving to folder';
  }

  description() {
    if (this.taskDescription) {
      return this.taskDescription;
    }

    const folderText = `to ${this.folder.displayName}`;
    const paramsText = super.description();
    return `Moved ${paramsText} ${folderText}`;
  }

  willBeQueued() {
    if (!this.folder) {
      throw new Error('Must specify a `folder`');
    }
    super.willBeQueued('ChangeFolderTask');
  }

  _isArchive() {
    return this.folder.name === 'archive' || this.folder.name === 'all';
  }

  createUndoTask() {
    const task = super.createUndoTask();
    const { folder, previousFolder } = task;
    task.folder = previousFolder;
    task.previousFolder = folder;
    return task;
  }
}
