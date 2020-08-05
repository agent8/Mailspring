/* eslint no-unused-vars: 0*/
import _ from 'underscore';
import Attributes from '../attributes';
import Thread from '../models/thread';
import Actions from '../actions';
import DatabaseStore from '../stores/database-store';
import ChangeMailTask from './change-mail-task';

export default class ChangeStarredTask extends ChangeMailTask {
  static attributes = Object.assign({}, ChangeMailTask.attributes, {
    starred: Attributes.Boolean({
      modelKey: 'starred',
    }),
  });

  constructor(props) {
    super(props);
    this.canBeUndone = false;
  }

  label() {
    return this.starred ? 'Starring' : 'Unstarring';
  }

  description() {
    const paramsText = super.description();

    if (this.isUndo) {
      return `Undoing changes to ${paramsText}`;
    }

    const verb = this.starred ? 'Flagged' : 'Unflagged';
    return `${verb} ${paramsText}`;
  }

  willBeQueued() {
    super.willBeQueued('ChangeStarredTask');
  }

  createUndoTask() {
    const task = super.createUndoTask();
    task.starred = !this.starred;
    return task;
  }
}
