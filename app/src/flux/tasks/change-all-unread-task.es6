import Attributes from '../attributes';
import Task from './task';

export default class ChangeAllUnreadTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    unread: Attributes.Boolean({
      modelKey: 'unread',
    }),
    folderId: Attributes.String({
      modelKey: 'folderId',
    }),
  });

  constructor(props) {
    super(props);
    this.canBeUndone = false;
  }

  label() {
    return this.unread ? 'Marking all as unread' : 'Marking all as read';
  }

  description() {
    const paramsText = super.description();
    if (this.isUndo) {
      return `Undoing changes to ${paramsText}`;
    }

    const newState = this.unread ? 'unread' : 'read';
    return `Marked ${paramsText} as ${newState}`;
  }

  willBeQueued() {
    super.willBeQueued('ChangeAllUnreadTask');
  }

  createUndoTask() {
    const task = super.createUndoTask();
    task.unread = !this.unread;
    return task;
  }
}
