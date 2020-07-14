import Category from '../models/category';
import Label from '../models/label';
import ChangeMailTask from './change-mail-task';
import Attributes from '../attributes';
import AccountStore from '../stores/account-store';

// Public: Create a new task to apply labels to a message or thread.
//
// Takes an options object of the form:
// - labelsToAdd: An {Array} of {Category}s or {Category} ids to add
// - labelsToRemove: An {Array} of {Category}s or {Category} ids to remove
// - threads: An {Array} of {Thread}s or {Thread} ids
// - messages: An {Array} of {Message}s or {Message} ids
//
export default class ChangeLabelsTask extends ChangeMailTask {
  static attributes = Object.assign({}, ChangeMailTask.attributes, {
    labelsToAdd: Attributes.Collection({
      modelKey: 'labelsToAdd',
      itemClass: Label,
    }),
    labelsToRemove: Attributes.Collection({
      modelKey: 'labelsToRemove',
      itemClass: Label,
    }),
  });
  constructor(data) {
    super(data);
    if (data) {
      let ret = [];
      (data.labelsToAdd || []).forEach(i => {
        if (i) {
          if (i instanceof Category && typeof i.isLabel === 'function' && i.isLabel()) {
            if (!i.id) {
              AppEnv.reportError(
                new Error(
                  `ChangeLabelsTask: Labels to add contains label without id, source: ${data.source}`
                ),
                { errorData: data }
              );
            } else {
              ret.push(i);
            }
          } else {
            AppEnv.reportError(
              new Error(
                `ChangeLabelsTask: Labels to add contains none Label, source: ${data.source}`
              ),
              { errorData: data }
            );
          }
        } else {
          AppEnv.reportError(
            new Error(
              `ChangeLabelsTask: Labels to add contains null items, source: ${data.source}`
            ),
            { errorData: data }
          );
        }
      });
      this.labelsToAdd = ret;
      ret = [];
      (data.labelsToRemove || []).forEach(i => {
        if (i) {
          if (i instanceof Category && typeof i.isLabel === 'function' && i.isLabel()) {
            if (!i.id) {
              AppEnv.reportError(
                new Error(
                  `ChangeLabelsTask: Labels to remove contains label without id, source: ${data.source}`
                ),
                { errorData: data }
              );
            } else {
              ret.push(i);
            }
          } else {
            AppEnv.reportError(
              new Error(
                `ChangeLabelsTask: Labels to remove contains none Label, source: ${data.source}`
              ),
              { errorData: data }
            );
          }
        } else {
          AppEnv.reportError(
            new Error(
              `ChangeLabelsTask: Labels to remove contains null items, source: ${data.source}`
            ),
            { errorData: data }
          );
        }
      });
      this.labelsToRemove = ret;

      // Remember the labels that users often use
      AccountStore.setHighFrequencyFolder(
        this.accountId,
        this.labelsToAdd.map(label => label.id).reverse()
      );
    }
  }

  label() {
    return 'Applying labels';
  }

  description() {
    if (this.taskDescription) {
      return this.taskDescription;
    }

    const paramsText = super.description();
    const removed = this.labelsToRemove[0];
    const added = this.labelsToAdd[0];

    // Spam / trash interactions are always "moves" because they're the three
    // folders of Gmail. If another folder is involved, we need to decide to
    // return either "Moved to Bla" or "Added Bla".
    if (added && added.name === 'spam') {
      return `Marked ${paramsText} as Spam`;
    } else if (removed && removed.name === 'spam') {
      return `Unmarked ${paramsText} as Spam`;
    } else if (added && added.name === 'trash') {
      return `Trashed ${paramsText}`;
    } else if (removed && removed.name === 'trash') {
      return `Removed ${paramsText} from Trash`;
    }
    if (this.labelsToAdd.length === 0 && this.labelsToRemove.find(l => l.role === 'inbox')) {
      return `Archived ${paramsText}`;
    } else if (this.labelsToRemove.length === 0 && this.labelsToAdd.find(l => l.role === 'inbox')) {
      return `Unarchived ${paramsText}`;
    }
    if (this.labelsToAdd.length === 1 && this.labelsToRemove.length === 0) {
      return `Added ${added.displayName} to ${paramsText}`;
    }
    if (this.labelsToAdd.length === 0 && this.labelsToRemove.length === 1) {
      return `Removed ${removed.displayName} from ${paramsText}`;
    }
    return `Changed labels on ${paramsText}`;
  }

  _isArchive() {
    const toAdd = this.labelsToAdd.map(l => l.name);
    return toAdd.includes('all') || toAdd.includes('archive');
  }

  willBeQueued() {
    if (!this.labelsToAdd) {
      throw new Error(`Assertion Failure: ChangeLabelsTask requires labelsToAdd`);
    }
    if (!this.labelsToRemove) {
      throw new Error(`Assertion Failure: ChangeLabelsTask requires labelsToRemove`);
    }
    for (const l of [].concat(this.labelsToAdd, this.labelsToRemove)) {
      // if (l.isLabel() === false) {
      //   throw new Error(
      //     `Assertion Failure: ChangeLabelsTask received a non-label: ${JSON.stringify(l)}`
      //   );
      // }
    }
    super.willBeQueued('ChangeLabelsTask');
  }

  createUndoTask() {
    const task = super.createUndoTask();
    const { labelsToAdd, labelsToRemove } = task;
    task.labelsToAdd = labelsToRemove;
    task.labelsToRemove = labelsToAdd;
    return task;
  }
}
