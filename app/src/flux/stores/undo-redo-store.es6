import MailspringStore from 'mailspring-store';
import Actions from '../actions';
import { SyncbackMetadataTask, TaskFactory } from 'mailspring-exports';
import { ipcRenderer } from 'electron';
import uuid from 'uuid';
import SendDraftTask from '../tasks/send-draft-task';
const undoOnlyShowOne = 'core.task.undoQueueOnlyShowOne';
const minimumToastDisplayTimeDurationInMs = 2000;
const isUndoSend = block => {
  return (
    (block.tasks.length === 1 &&
      block.tasks[0] instanceof SyncbackMetadataTask &&
      block.tasks[0].value.isUndoSend) ||
    block.tasks[0] instanceof SendDraftTask
  );
};
const sendDraftSuccessTimeout = 3000;
const sendDRaftFailedTimeout = 10000;
class UndoRedoStore extends MailspringStore {
  priority = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  constructor() {
    super();
    this._undo = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    this.undoQueuing = [];
    this._redo = [];
    this._timeouts = {};
    this._maxQueueLength = AppEnv.config.get(undoOnlyShowOne);

    this._mostRecentBlock = null;
    this._queueingTasks = false;

    if (AppEnv.isMainWindow()) {
      this.listenTo(Actions.queueTask, this._onQueue);
      this.listenTo(Actions.queueTasks, this._onQueue);
      this.listenTo(Actions.queueUndoOnlyTask, this._onQueue);
      this.listenTo(Actions.removeAccount, this._onAccountRemoved);
      this.listenTo(Actions.draftDeliverySucceeded, this._onDraftSendSuccess);
      this.listenTo(Actions.draftDeliveryFailed, this._onDraftSendFailed);
      AppEnv.config.observe(undoOnlyShowOne, this._onConfigChange);
    }
  }
  _findBlockBySendDraftMessageId = messageId => {
    if (!messageId) {
      return null;
    }
    const blocks = this._undo.critical;
    for (let i = 0; i < blocks.length; i++) {
      if (isUndoSend(blocks[i])) {
        if (messageId === blocks[i].tasks[0].modelMessageId) {
          return blocks[i];
        }
      }
    }
    return null;
  };
  _onDraftSendSuccess = ({ messageId }) => {
    const block = this._findBlockBySendDraftMessageId(messageId);
    if (block) {
      block.sendStatus = 'success';
      this.findAndReplace({ block });
      setTimeout(() => this.removeTaskFromUndo({ block }), sendDraftSuccessTimeout);
    }
  };
  _onDraftSendFailed = ({ messageId, draft }) => {
    const block = this._findBlockBySendDraftMessageId(messageId);
    if (block) {
      block.sendStatus = 'failed';
      block.failedDraft = draft;
      this.findAndReplace({ block });
      setTimeout(() => this.removeTaskFromUndo({ block }), sendDRaftFailedTimeout);
    }
  };
  _onConfigChange = () => {
    const oldMax = this._maxQueueLength;
    this._maxQueueLength = AppEnv.config.get(undoOnlyShowOne) ? 1 : 0;
    if (this._maxQueueLength === 0 && this._maxQueueLength !== oldMax) {
      Object.keys(this._undo).forEach(priority => {
        this._undo[priority].forEach(block => {
          block.displayId = block.id;
        });
      });
      this.trigger();
    }
  };

  _onQueue = taskOrTasks => {
    if (this._queueingTasks) {
      return;
    }

    const tasks = taskOrTasks instanceof Array ? taskOrTasks : [taskOrTasks];
    if (tasks.length === 0) {
      return;
    }

    if (tasks.every(t => t.canBeUndone)) {
      const id = uuid();
      const block = {
        id: id,
        displayId: id,
        ids: tasks.map(t => t.id),
        tasks: tasks,
        hide: false,
        description: tasks.map(t => t.description()).join(', '),
        do: () => {
          // no-op, tasks queued separately
        },
        undo: () => {
          this._queueingTasks = true;
          Actions.queueTasks(
            tasks.map(t => {
              // undo send mail
              if (t instanceof SyncbackMetadataTask && t.pluginId === 'send-later') {
                ipcRenderer.send(
                  'send-later-manager',
                  'undo',
                  t.modelMessageId,
                  null,
                  null,
                  t.modelThreadId
                );
                return null;
              } else {
                return TaskFactory.taskForUndo({ task: t });
              }
            })
          );
          this._queueingTasks = false;
        },
        delayDuration: this.getDelayDuration(tasks),
        taskDelaySkippedCallBacks: () => {
          tasks.forEach(t => {
            if (typeof t.taskDelaySkipped === 'function') {
              t.taskDelaySkipped();
            }
          });
        },
        taskPurgedCallBacks: () => {
          tasks.forEach(t => {
            if (typeof t.taskPurged === 'function') {
              t.taskPurged();
            }
          });
        },
        delayTimeoutCallbacks: () => {
          tasks.forEach(t => {
            if (t.delayTimeoutCallback) {
              t.delayTimeoutCallback();
            }
          });
        },
        queueTimeoutTasks: () => {
          tasks.forEach(t => {
            if (t.delayedTasks) {
              Actions.queueTasks(t.delayedTasks);
            }
          });
        },
        lingerAfterTimeout: !!tasks.find(t => !!t.lingerAfterTimeout),
        redo: () => {
          this._queueingTasks = true;
          Actions.queueTasks(tasks.map(t => t.createIdenticalTask()));
          this._queueingTasks = false;
        },
        // priority: this._findHighestPriority({ tasks }),
        // DC-2117, Because we only want to show one, we set all to one priority
        priority: this.priority.critical,
        timestamp: Date.now(),
        due: 0,
      };
      this._onQueueBlock(block);
    }
  };

  _onQueueBlock = block => {
    this._redo = [];
    this._mostRecentBlock = block;
    this._pushToUndo({ block });
    this.trigger();
  };
  _pushNewBlockToUndoQueue = (block, priority) => {
    if (this._maxQueueLength > 0 && this._undo[priority].length >= this._maxQueueLength) {
      block.displayId = this._undo[priority][this._maxQueueLength - 1].displayId;
    }
    if (isUndoSend(block)) {
      block.sendStatus = 'sending';
    }
    this._undo[priority].push(block);
  };
  _pushToUndo = ({ block }) => {
    switch (block.priority) {
      case this.priority.critical:
        this._pushNewBlockToUndoQueue(block, 'critical');
        break;
      case this.priority.high:
        this._pushNewBlockToUndoQueue(block, 'high');
        break;
      case this.priority.medium:
        this._pushNewBlockToUndoQueue(block, 'medium');
        break;
      default:
        this._pushNewBlockToUndoQueue(block, 'low');
    }
    this.undoQueuing.push(block);
    this._timeouts[block.id] = setTimeout(
      this._onBlockTimedOut.bind(this, { block }),
      Math.max(block.delayDuration, minimumToastDisplayTimeDurationInMs)
    );
  };
  _onBlockTimedOut = ({ block }) => {
    const currentBlock = this.findBlock({ block });
    if (!currentBlock) {
      AppEnv.logWarning(`UndoRedoStore:Undo block ${block.id} not found in undo queue`);
      clearTimeout(this._timeouts[block.id]);
      delete this._timeouts[block.id];
      return;
    }
    currentBlock.delayTimeoutCallbacks();
    currentBlock.queueTimeoutTasks();
    if (!currentBlock.lingerAfterTimeout) {
      this.removeTaskFromUndo({ block: currentBlock });
    } else {
      currentBlock.due = Date.now();
      this.findAndReplace({ block: currentBlock });
    }
    delete this._timeouts[block.id];
    this.trigger();
  };
  findBlock = ({ block }) => {
    let priority = 'low';
    switch (block.priority) {
      case this.priority.critical:
        priority = 'critical';
        break;
      case this.priority.high:
        priority = 'high';
        break;
      case this.priority.medium:
        priority = 'medium';
        break;
      default:
        priority = 'low';
    }
    for (let i = 0; i < this._undo[priority].length; i++) {
      if (this._undo[priority][i].id === block.id) {
        return Object.assign({}, this._undo[priority][i]);
      }
    }
    return null;
  };
  findAndReplace = ({ block }) => {
    let priority = 'low';
    switch (block.priority) {
      case this.priority.critical:
        priority = 'critical';
        break;
      case this.priority.high:
        priority = 'high';
        break;
      case this.priority.medium:
        priority = 'medium';
        break;
      default:
        priority = 'low';
    }
    for (let i = 0; i < this.undoQueuing.length; i++) {
      if (this.undoQueuing[i].id === block.id) {
        this.undoQueuing[i] = Object.assign({}, block);
        break;
      }
    }
    for (let i = 0; i < this._undo[priority].length; i++) {
      if (this._undo[priority][i].id === block.id) {
        this._undo[priority][i] = Object.assign({}, block);
        this.trigger();
        return;
      }
    }
  };

  undo = ({ block } = {}) => {
    if (!block) {
      console.warn('can not undo when block is not defined');
      return;
    }
    block.undo();
    this._mostRecentBlock = null;
    this._redo.push(block);
    this.removeTaskFromUndo({ block, noTrigger: true });
    this.trigger();
  };

  undoLastOne = () => {
    const block = this.undoQueuing.pop();
    if (!block) {
      return;
    }
    this.undo({ block });
  };

  redo = () => {
    const block = this._redo.pop();
    if (!block) {
      return;
    }
    block.redo ? block.redo() : block.do();
    this._mostRecentBlock = block;
    this._pushToUndo({ block });
    this.trigger();
  };

  getMostRecent = () => {
    return this._mostRecentBlock;
  };
  getUndos = ({ critical = 1, high = 0, medium = 0, low = 0 } = {}) => {
    return {
      critical:
        critical === 0 ? this._undo.critical.slice() : this._undo.critical.slice(critical * -1),
      high: high === 0 ? this._undo.high.slice() : this._undo.high.slice(high * -1),
      medium: medium === 0 ? this._undo.medium.slice() : this._undo.medium.slice(medium * -1),
      low: low === 0 ? this._undo.low.slice() : this._undo.low.slice(low * -1),
    };
  };
  _onAccountRemoved = accountId => {
    for (const priority of Object.keys(this._undo)) {
      for (const block of this._undo[priority]) {
        if (block.tasks[0].accountId === accountId) {
          this.removeTaskFromUndo({ block, purgeTask: true });
        }
      }
    }
  };
  removeTaskFromUndo = ({ block, noTrigger = false, purgeTask = false }) => {
    let priority;
    switch (block.priority) {
      case this.priority.critical:
        priority = 'critical';
        break;
      case this.priority.high:
        priority = 'high';
        break;
      case this.priority.medium:
        priority = 'medium';
        break;
      default:
        priority = 'low';
    }
    this._undo[priority] = this._undo[priority].filter(b => {
      return b.id !== block.id;
    });
    this.undoQueuing = this.undoQueuing.filter(b => {
      return b.id !== block.id;
    });
    clearTimeout(this._timeouts[block.id]);
    delete this._timeouts[block.id];
    if (!noTrigger) {
      this.trigger();
    }
    if (purgeTask) {
      block.taskPurgedCallBacks();
    }
  };
  setTaskToHide = ({ block }) => {
    block.hide = true;
    this.findAndReplace({ block });
  };
  _findHighestPriority = ({ tasks }) => {
    let priority = this.priority.low;
    for (let task of tasks) {
      if (Object.prototype.hasOwnProperty.call(task, 'priority')) {
        if (task.priority === this.priority.critical) {
          return this.priority.critical;
        }
        if (task.priority < priority) {
          priority = task.priority;
        }
      }
    }
    return priority;
  };

  isUndoSend(task) {
    return (
      (task instanceof SyncbackMetadataTask && task.value.isUndoSend) ||
      task instanceof SendDraftTask
    );
  }

  getUndoSendExpiration(task) {
    return task.value.expiration * 1000;
  }

  getDelayDuration(tasks) {
    let timeouts = tasks.map(task => {
      return this.isUndoSend(task)
        ? Math.max(400, this.getUndoSendExpiration(task) - Date.now())
        : AppEnv.config.get('core.task.delayInMs');
    });
    return Math.min(...timeouts);
  }

  print() {
    console.log('Undo Stack');
    console.log(this._undo);
    console.log('Redo Stack');
    console.log(this._redo);
  }
}

export default new UndoRedoStore();
