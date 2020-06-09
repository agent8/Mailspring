import {
  React,
  UndoRedoStore,
  OutboxStore,
  SyncbackMetadataTask,
  ChangeUnreadTask,
  ChangeStarredTask,
  ChangeFolderTask,
  ChangeLabelsTask,
  TrashFromSenderTask,
  Actions,
} from 'mailspring-exports';
import { RetinaImg } from 'mailspring-component-kit';
import { CSSTransitionGroup } from 'react-transition-group';
import SendDraftTask from '../../../src/flux/tasks/send-draft-task';
import DestroyDraftTask from '../../../src/flux/tasks/destroy-draft-task';

function isUndoSend(block) {
  return (
    (block.tasks.length === 1 &&
      block.tasks[0] instanceof SyncbackMetadataTask &&
      block.tasks[0].value.isUndoSend) ||
    block.tasks[0] instanceof SendDraftTask
  );
}
//
// function getUndoSendExpiration(block) {
//   return block.tasks[0].value.expiration * 1000;
// }
//
// function getDisplayDuration(block) {
//   return isUndoSend(block) ? Math.max(400, getUndoSendExpiration(block) - Date.now()) : 3000;
// }

// class Countdown extends React.Component {
//   constructor(props) {
//     super(props);
//     this.animationDuration = `${props.expiration - Date.now()}ms`;
//     this.state = { x: 0 };
//   }
//
//   UNSAFE_componentWillReceiveProps(nextProps) {
//     if (nextProps.expiration !== this.props.expiration) {
//       this.animationDuration = `${nextProps.expiration - Date.now()}ms`;
//     }
//   }
//
//   componentDidMount() {
//     this._tickStart = setTimeout(() => {
//       this.setState({ x: this.state.x + 1 });
//       this._tick = setInterval(() => {
//         this.setState({ x: this.state.x + 1 });
//       }, 1000);
//     }, this.props.expiration % 1000);
//   }
//
//   componentWillUnmount() {
//     clearTimeout(this._tickStart);
//     clearInterval(this._tick);
//   }
//
//   render() {
//     // subtract a few ms so we never round up to start time + 1 by accident
//     let diff = Math.min(
//       Math.max(0, this.props.expiration - Date.now()),
//       AppEnv.config.get('core.task.delayInMs')
//     );
//
//     return (
//       <div className="countdown">
//         <div className="countdown-number">{Math.ceil(diff / 1000)}</div>
//         {diff > 0 && (
//           <svg>
//             <circle r="14" cx="15" cy="15" style={{ animationDuration: this.animationDuration }} />
//           </svg>
//         )}
//       </div>
//     );
//   }
// }

class BasicContent extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { block, onMouseEnter, onMouseLeave, onClose } = this.props;
    let description = block.description;
    const tasks = block.tasks;
    if (tasks.length >= 2) {
      if (tasks.every(task => task instanceof ChangeUnreadTask)) {
        // if all ChangeUnreadTask
        const total = tasks.reduce((sum, task) => sum + task.threadIds.length, 0);
        const newState = tasks[0].unread ? 'unread' : 'read';
        description = `Marked ${total} threads as ${newState}`;
      } else if (tasks.every(task => task instanceof ChangeStarredTask)) {
        // if all ChangeStarredTask
        const total = tasks.reduce((sum, task) => sum + task.threadIds.length, 0);
        const verb = tasks[0].starred ? 'Flagged' : 'Unflagged';
        description = `${verb} ${total} threads`;
      } else if (tasks.every(task => task instanceof ChangeFolderTask)) {
        // if all ChangeFolderTask
        const total = tasks.reduce((sum, task) => sum + task.threadIds.length, 0);
        const folderText = ` to ${tasks[0].folder.displayName}`;
        description = `Moved ${total} threads${folderText}`;
      } else if (
        tasks.every(task => task instanceof ChangeFolderTask || task instanceof ChangeLabelsTask) &&
        tasks.some(task => task instanceof ChangeFolderTask)
      ) {
        // if all ChangeFolderTask or ChangeLabelsTask
        const total = tasks.reduce((sum, task) => sum + task.threadIds.length, 0);
        const firstChangeFolderTask = tasks.find(task => task instanceof ChangeFolderTask);
        const folderText = ` to ${firstChangeFolderTask.folder.displayName}`;
        description = `Moved ${total} threads${folderText}`;
      } else if (tasks.every(task => task instanceof DestroyDraftTask)) {
        const total = tasks.reduce((sum, task) => sum + task.messageIds.length, 0);
        description = `Deleting ${total} drafts`;
      }
    } else {
      // if TrashFromSenderTask
      if (tasks[0] instanceof TrashFromSenderTask) {
        description = `Trash all previous mail from ${tasks[0].email}`;
      }
    }
    return (
      <div className="content" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <div className="message">{description}</div>
        <div className="action">
          <RetinaImg
            name="close_1.svg"
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
            onClick={() => onClose()}
          />
          <div className="undo-action-text" onClick={() => UndoRedoStore.undo({ block })}>
            Undo
          </div>
        </div>
      </div>
    );
  }
}

class UndoSendContent extends BasicContent {
  constructor(props) {
    super(props);
    this.state = { sendStatus: 'sending', failedDraft: null };
    this.unlisten = [
      Actions.draftDeliverySucceeded.listen(this.onSendSuccess, this),
      Actions.draftDeliveryFailed.listen(this.onSendFailed, this),
    ];
    this.timer = null;
    this.mounted = false;
  }

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
    clearTimeout(this.timer);
    for (let unlisten of this.unlisten) {
      unlisten();
    }
  }

  onSendSuccess = ({ messageId }) => {
    if (this.mounted && messageId && this.props.block.tasks[0].modelMessageId === messageId) {
      this.setState({ sendStatus: 'success' });
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.props.onClose(true);
      }, 3000);
    }
  };

  onSendFailed = ({ messageId, draft }) => {
    if (this.mounted && messageId && this.props.block.tasks[0].modelMessageId === messageId) {
      this.setState({ sendStatus: 'failed', failedDraft: draft });
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        this.props.onClose(true);
      }, 10000);
    }
  };

  onActionClicked = () => {
    if (!this.props.block.due) {
      UndoRedoStore.undo({ block: this.props.block });
    } else if (this.state.sendStatus === 'failed') {
      clearTimeout(this.timer);
      if (this._getAdditionalFailedCount() > 0) {
        setTimeout(() => {
          AppEnv.reportError(
            new Error(
              `Sending email failed, and user clicked view. messageId: ${this.props.block.tasks[0].modelMessageId}`
            )
          );
          Actions.gotoOutbox();
        }, 300);
      } else {
        setTimeout(() => {
          AppEnv.reportError(
            new Error(
              `Sending email failed, and user clicked retry. messageId: ${this.props.block.tasks[0].modelMessageId}`
            )
          );
          Actions.resendDrafts({
            messageIds: [this.props.block.tasks[0].modelMessageId],
            source: 'UndoRedo:Failed:Resend',
          });
        }, 300);
      }
      this.props.onClose(true);
    }
  };

  renderActionArea(block) {
    if (!block.due) {
      return (
        <div className="undo-action-text" onClick={this.onActionClicked}>
          Undo
        </div>
      );
    }
    if (this.state.sendStatus === 'failed') {
      const additionalFailed = this._getAdditionalFailedCount();
      return (
        <div className="undo-action-text" onClick={this.onActionClicked}>
          {additionalFailed > 0 ? 'View' : 'Retry'}
        </div>
      );
    }
    return null;
  }

  onMouseEnter = () => {
    clearTimeout(this.timer);
  };
  onMouseLeave = () => {
    if (this.state.sendStatus !== 'sending') {
      this.timer = setTimeout(() => this.props.onClose(), 400);
    }
  };
  _getAdditionalFailedCount = () => {
    const outboxCount = OutboxStore.count();
    let additionalFailedCount = outboxCount.failed;
    const currentMessageInOutbox = OutboxStore.dataSource().getById(
      this.props.block.tasks[0].modelMessageId
    );
    if (currentMessageInOutbox) {
      additionalFailedCount--;
    }
    return additionalFailedCount;
  };

  _generateFailedSendDraftMessage() {
    if (this.state.failedDraft) {
      const { to, bcc, cc } = this.state.failedDraft;
      let recipiant;
      if (to.length > 0) {
        recipiant = to[0];
      } else if (bcc.length > 0) {
        recipiant = bcc[0];
      } else if (cc.length > 0) {
        recipiant = cc[0];
      } else {
        recipiant = { name: '', email: '' };
      }
      const additionalFailedCount = this._getAdditionalFailedCount();
      const additional = additionalFailedCount > 0 ? `+ ${additionalFailedCount} more drafts` : '';
      return `Mail to ${recipiant.name || recipiant.email} ${additional} failed to send.`;
    }
  }

  render() {
    const block = this.props.block;
    let messageStatus = 'Sending message...';
    if (this.state.sendStatus === 'success') {
      messageStatus = 'Message sent.';
    } else if (this.state.sendStatus === 'failed') {
      messageStatus = this._generateFailedSendDraftMessage();
    }
    return (
      <div
        className={`content ${this.state.sendStatus === 'failed' ? 'failed' : ''}`}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        <div className="message">{messageStatus}</div>
        <div className="action">
          <RetinaImg
            name="close_1.svg"
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
            onClick={() => this.props.onClose()}
          />
          {this.renderActionArea(block)}
        </div>
      </div>
    );
  }
}

export default class UndoRedoToast extends React.Component {
  static displayName = 'UndoRedoToast';
  static containerRequired = false;

  constructor(props) {
    super(props);

    this._timeout = [];
    this._unlisten = null;

    // Note: we explicitly do /not/ set initial state to the state of
    // the UndoRedoStore here because "getMostRecent" might be more
    // than 3000ms old.
    this.state = {
      block: null,
      blocks: [],
    };
  }

  componentDidMount() {
    this._unlisten = UndoRedoStore.listen(() => {
      const blocks = UndoRedoStore.getUndos();
      this.setState({
        blocks: [...blocks.critical, ...blocks.high, ...blocks.medium, ...blocks.low],
      });
    });
  }

  componentWillUnmount() {
    if (this._unlisten) {
      this._unlisten();
    }
  }

  _clearTimeout({ block }) {
    const timer = this._timeouts[block.id];
    if (timer) {
      clearTimeout(timer);
    }
  }

  _closeToaster = (block, remove = false) => {
    block.lingerAfterTimeout = false;
    if (remove) {
      UndoRedoStore.removeTaskFromUndo({ block });
    } else {
      UndoRedoStore.setTaskToHide({ block });
    }
  };

  _onMouseEnter = () => {
    // this._clearTimeout();
  };

  _onMouseLeave = () => {
    // this._ensureTimeout();
  };

  render() {
    const { blocks } = this.state;
    return (
      <div className="undo-redo-toast-container">
        <CSSTransitionGroup
          className="undo-redo-toast"
          transitionLeaveTimeout={150}
          transitionEnterTimeout={150}
          transitionName="undo-redo-toast-fade"
        >
          {blocks
            .filter(b => !b.hide)
            .map(block => {
              const Component = block && (isUndoSend(block) ? UndoSendContent : BasicContent);
              return (
                <Component
                  key={block.id}
                  block={block}
                  onMouseEnter={this._onMouseEnter}
                  onMouseLeave={this._onMouseLeave}
                  onClose={this._closeToaster.bind(this, block)}
                />
              );
            })}
        </CSSTransitionGroup>
      </div>
    );
  }
}
