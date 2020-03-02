/* eslint no-unused-vars: 0*/
import _ from 'underscore';
import Thread from '../models/thread';
import Actions from '../actions';
import Attributes from '../attributes';
import DatabaseStore from '../stores/database-store';
import ChangeMailTask from './change-mail-task';

export default class ChangeUnreadTask extends ChangeMailTask {
  static attributes = Object.assign({}, ChangeMailTask.attributes, {
    unread: Attributes.Boolean({
      modelKey: 'unread',
    }),
  });

  constructor(props) {
    super(props);
    this.canBeUndone = false;
  }

  label() {
    return this.unread ? 'Marking as unread' : 'Marking as read';
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
    super.willBeQueued('ChangeUnreadTask');
  }

  createUndoTask() {
    const task = super.createUndoTask();
    task.unread = !this.unread;
    return task;
  }
}
