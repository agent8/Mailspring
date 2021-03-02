import Task from './task';
import Attributes from '../attributes';

/*
Public: The ChangeMailTask is a base class for all tasks that modify sets
of threads or messages.

Subclasses implement {ChangeMailTask::changesToModel} and
{ChangeMailTask::requestBodyForModel} to define the specific transforms
they provide, and override {ChangeMailTask::performLocal} to perform
additional consistency checks.
*/
const isMessageView = AppEnv.isDisableThreading();

export default class ChangeMailTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    taskDescription: Attributes.String({
      modelKey: 'taskDescription',
    }),
    threadIds: Attributes.Collection({
      modelKey: 'threadIds',
    }),
    messageIds: Attributes.Collection({
      modelKey: 'messageIds',
    }),
    canBeUndone: Attributes.Boolean({
      modelKey: 'canBeUndone',
    }),
    isUndo: Attributes.Boolean({
      modelKey: 'isUndo',
    }),
    inboxCategories: Attributes.Collection({
      modelKey: 'inboxCategories',
    }),
  });

  constructor({ threads = [], messages = [], ...rest } = {}) {
    super(rest);

    // we actually only keep a small bit of data now
    const threadIds = [];
    const inboxCategories = [];
    threads.forEach(thread => {
      if (thread) {
        threadIds.push(thread.id);
        inboxCategories.push({
          inboxCategory: `${thread.inboxCategory}`,
          type: 'thread',
          id: thread.id,
        });
      }
    });
    this.threadIds = this.threadIds || threadIds;
    const messageIds = [];
    messages.forEach(msg => {
      if (msg) {
        messageIds.push(msg.id);
        inboxCategories.push({
          inboxCategory: `${msg.inboxCategory}`,
          type: 'message',
          id: msg.id,
        });
      }
    });
    this.messageIds = this.messageIds || messageIds;

    if (isMessageView) {
      this.threadIds = [];
      const messageIdSet = new Set([...threadIds, ...messageIds]);
      this.messageIds = [...messageIdSet];
    }

    this.inboxCategories = this.inboxCategories || inboxCategories;
    this.accountId = this.accountId || (threads[0] || messages[0] || {}).accountId;
    if (this.canBeUndone === undefined) {
      this.canBeUndone = true;
    }
    if ((!!threads[0] || !!messages[0]) && !this.accountId && !this.folderId) {
      AppEnv.reportError(new Error(`Mail Task missing accountId`), {
        errorData: { thread: threads[0], message: messages[0] },
      });
    }
  }

  // Task lifecycle

  createUndoTask() {
    if (this.isUndo) {
      throw new Error(
        'ChangeMailTask::createUndoTask Cannot create an undo task from an undo task.'
      );
    }

    const task = this.createIdenticalTask();
    task.isUndo = true;
    return task;
  }

  numberOfImpactedItems() {
    return this.threadIds.length || this.messageIds.length;
  }

  description() {
    // If the parames has both messageIds and threadIds, threadIds will not work in native
    if (this.messageIds.length) {
      const count = this.messageIds.length;
      return count > 1 ? `${count} messages` : 'message';
    }
    if (this.threadIds.length) {
      const count = this.threadIds.length;
      return count > 1 ? `${count} threads` : 'thread';
    }
  }

  willBeQueued(taskName) {
    if (this.threadIds.length > 0 && this.messageIds.length > 0) {
      throw new Error(
        `${
          taskName ? `${taskName}: ` : ''
        }You can provide \`threads\` or \`messages\` but not both.`
      );
    }
    if (this.threadIds.length === 0 && this.messageIds.length === 0) {
      throw new Error(
        `${
          taskName ? `${taskName}: ` : ''
        }You must provide a \`threads\` or \`messages\` Array of models or IDs.`
      );
    }

    super.willBeQueued();
  }
}
