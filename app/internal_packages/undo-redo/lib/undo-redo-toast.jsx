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
import DeleteThreadsTask from '../../../src/flux/tasks/delete-threads-task';
import ExpungeMessagesTask from '../../../src/flux/tasks/expunge-messages-task';
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
      } else if (
        tasks.every(
          task => task instanceof ExpungeMessagesTask || task instanceof DeleteThreadsTask
        )
      ) {
        const total = tasks.reduce((sum, task) => sum + task.threadIds.length, 0);
        description = `Expunging ${total} threads`;
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
            onClick={() => onClose(this.props.block)}
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
    this.timer = null;
    this.mounted = false;
  }

  componentDidMount() {
    this.mounted = true;
  }
  componentWillReceiveProps(nextProps, nextContext) {
    if (nextProps.block && this.props.block && nextProps.block.id !== this.props.block.id) {
      clearTimeout(this.timer);
    }
  }

  componentWillUnmount() {
    this.mounted = false;
    clearTimeout(this.timer);
  }

  onActionClicked = () => {
    if (!this.props.block.due) {
      UndoRedoStore.undo({ block: this.props.block });
    } else if (this.props.block.sendStatus === 'failed') {
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
      this.props.onClose(this.props.block, true);
    }
  };

  renderActionArea() {
    if (!this.props.block) {
      return null;
    }
    if (!this.props.block.due) {
      return (
        <div className="undo-action-text" onClick={this.onActionClicked}>
          Undo
        </div>
      );
    }
    if (this.props.block.sendStatus === 'failed') {
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
    if (this.props.block.sendStatus !== 'sending') {
      this.timer = setTimeout(() => this.props.onClose(this.props.block), 400);
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
    if (this.props.block.failedDraft) {
      const { to, bcc, cc } = this.props.block.failedDraft;
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
    if (!this.props.block) {
      return <span />;
    }
    let messageStatus = 'Sending message...';
    if (this.props.block.sendStatus === 'success') {
      messageStatus = 'Message sent.';
    } else if (this.props.block.sendStatus === 'failed') {
      messageStatus = this._generateFailedSendDraftMessage();
    }
    return (
      <div
        className={`content ${this.props.block.sendStatus === 'failed' ? 'failed' : ''}`}
        onMouseEnter={this.onMouseEnter}
        onMouseLeave={this.onMouseLeave}
      >
        <div className="message">{messageStatus}</div>
        <div className="action">
          <RetinaImg
            name="close_1.svg"
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
            onClick={() => this.props.onClose(this.props.block)}
          />
          {this.renderActionArea(this.props.block)}
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
    this._mounted = false;
    this.state = {
      block: null,
      blocks: [],
    };
  }

  componentDidMount() {
    this._mounted = true;
    this._unlisten = UndoRedoStore.listen(() => {
      if (!this._mounted) {
        return;
      }
      const blocks = UndoRedoStore.getUndos({
        critical: AppEnv.config.get('core.task.undoQueueOnlyShowOne') ? 1 : 0,
      });
      this.setState({
        blocks: [...blocks.critical, ...blocks.high, ...blocks.medium, ...blocks.low],
      });
    });
  }

  componentWillUnmount() {
    this._mounted = false;
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
                  key={block.displayId}
                  block={block}
                  onMouseEnter={this._onMouseEnter}
                  onMouseLeave={this._onMouseLeave}
                  onClose={this._closeToaster}
                />
              );
            })}
        </CSSTransitionGroup>
      </div>
    );
  }
}
