import {
  Actions,
  React,
  PropTypes,
  TaskFactory,
  FocusedPerspectiveStore,
  CategoryStore,
  AccountStore,
} from 'mailspring-exports';
import { RetinaImg } from 'mailspring-component-kit';
const ToolbarCategoryPicker = require('../../category-picker/lib/toolbar-category-picker');
// const nextActionForTrashOrArchive = ({ source, affectedItems } = {}) => {
//   const focusedThread = FocusedContentStore.focused('thread');
//   const topSheet = WorkspaceStore.topSheet();
//   const layoutMode = WorkspaceStore.layoutMode();
//   // AppEnv.nextActionAfterRemoveFromView({
//   //   source,
//   //   affectedItems,
//   //   currentFocus: focusedThread,
//   //   topSheet,
//   //   layoutMode,
//   // });
// };
class ThreadMoveQuickAction extends ToolbarCategoryPicker {
  render() {
    if (!this._account) {
      return <span />;
    }

    return (
      <div
        tabIndex={-1}
        ref={el => (this._moveEl = el)}
        title="Move to..."
        onClick={this._onOpenMovePopover}
        className="action action-folder"
      >
        <RetinaImg
          name={'folder.svg'}
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }
}

class ThreadArchiveQuickAction extends React.Component {
  static displayName = 'ThreadArchiveQuickAction';
  static propTypes = { thread: PropTypes.object };

  render() {
    let allowed = FocusedPerspectiveStore.current().canArchiveThreads([this.props.thread]);
    if (allowed) {
      const accountId = this.props.thread.accountId;
      const account = AccountStore.accountForId(accountId);
      const isGmail = account && account.provider === 'gmail';
      let folder;
      if (isGmail) {
        folder = CategoryStore.getCategoryByRole(accountId, 'inbox');
        if (
          folder &&
          this.props.thread.labelIds &&
          !this.props.thread.labelIds.includes(folder.id)
        ) {
          allowed = false;
        }
      } else {
        folder = CategoryStore.getCategoryByRole(accountId, 'archive');
        if (
          folder &&
          this.props.thread.labelIds &&
          this.props.thread.labelIds.includes(folder.id)
        ) {
          allowed = false;
        }
      }
    }
    if (!allowed) {
      // DC-570 [Actions] The actions on last email cannot be active in special steps
      // Don't know why, but if we render a <span/>, the hover will not work as intended
      return null;
    }

    return (
      <div
        key="archive"
        title="Archive"
        style={{ order: 100 }}
        className="action action-archive"
        onClick={this._onArchive}
      >
        <RetinaImg
          name="archive.svg"
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }

  shouldComponentUpdate(newProps, newState) {
    const newAllowed = FocusedPerspectiveStore.current().canArchiveThreads([newProps.thread]);
    const prevAllowed = FocusedPerspectiveStore.current().canArchiveThreads([this.props.thread]);
    return (
      newProps.thread.id !== (this.props != null ? this.props.thread.id : undefined) ||
      newAllowed !== prevAllowed
    );
  }

  _onArchive = event => {
    const tasks = TaskFactory.tasksForArchiving({
      source: 'Quick Actions: Thread List: Archive',
      threads: [this.props.thread],
      currentPerspective: FocusedPerspectiveStore.current(),
    });
    if (Array.isArray(tasks) && tasks.length > 0) {
      tasks.forEach(task => {
        if (task && !task.accountId) {
          try {
            AppEnv.reportError(new Error(`Archive Task no accountId`), {
              errorData: {
                task: task.toJSON(),
                thread: JSON.stringify(this.props.thread),
              },
            });
          } catch (e) {
            console.error(e);
          }
        }
      });
    }
    Actions.queueTasks(tasks);
    // if (tasks.length > 0) {
    //   nextActionForTrashOrArchive({
    //     source: 'Quick Actions: Thread List: Archive',
    //     affectedItems: [this.props.thread],
    //   });
    // }
    // Don't trigger the thread row click
    event.stopPropagation();
  };
}

class ThreadTrashQuickAction extends React.Component {
  static displayName = 'ThreadTrashQuickAction';
  static propTypes = { thread: PropTypes.object };

  render() {
    const canExpungeThread = FocusedPerspectiveStore.current().canExpungeThreads();
    let allInTrashOrSpam = false;
    const currentPerspective = FocusedPerspectiveStore.current();
    if (
      currentPerspective &&
      currentPerspective.isSearchMailbox &&
      this.props &&
      this.props.thread &&
      Array.isArray(this.props.thread.labelIds)
    ) {
      allInTrashOrSpam =
        this.props.thread.labelIds
          .map(labelId => {
            const cat = CategoryStore.byId(this.props.thread.accountId, labelId);
            if (!cat) {
              AppEnv.reportError(
                `Category for ${this.props.thread.accountId} with label id ${labelId} is null`
              );
              return {};
            }
            return cat;
          })
          .every(folder => folder.role === 'trash' || folder.role === 'spam') &&
        this.props.thread.labelIds.length > 0;
    }
    if (canExpungeThread || allInTrashOrSpam) {
      return (
        <div
          key="remove"
          title="Delete Forever"
          style={{ order: 110 }}
          className="action action-trash"
          onClick={this._onExpunge}
        >
          <RetinaImg
            name="trash.svg"
            style={{ width: 24, height: 24, fontSize: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </div>
      );
    }
    let allowed = FocusedPerspectiveStore.current().canMoveThreadsTo([this.props.thread], 'trash');
    const folders = this.props.thread && this.props.thread.folders;
    const labels = this.props.thread && this.props.thread.labels;
    // if only one folder, and it's trash
    if (folders && folders.length === 1 && (!labels || labels.length === 0)) {
      const folder = folders[0];
      if (folder && folder.role === 'trash') {
        allowed = false;
      }
    }
    if (!allowed) {
      return <span />;
    }

    return (
      <div
        key="remove"
        title="Trash"
        style={{ order: 110 }}
        className="action action-trash"
        onClick={this._onRemove}
      >
        <RetinaImg
          name="trash.svg"
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }

  shouldComponentUpdate(newProps, newState) {
    return newProps.thread.id !== (this.props != null ? this.props.thread.id : undefined);
  }

  _onExpunge = event => {
    const tasks = TaskFactory.tasksForExpungingThreadsOrMessages({
      threads: [this.props.thread],
      source: 'Quick Actions: Thread List: Expunge',
    });
    if (Array.isArray(tasks) && tasks.length > 0) {
      AppEnv.showMessageBox({
        title: 'Are you sure?',
        detail: 'Message(s) will be permanently deleted.',
        buttons: ['Yes', 'No'],
        defaultId: 0,
        cancelId: 1,
      }).then(({ response } = {}) => {
        if (response !== 0) {
          AppEnv.logDebug(`Expunging message canceled, user clicked No`);
          return;
        }
        Actions.queueTasks(tasks);
      });
    }
    // Don't trigger the thread row click
    event.stopPropagation();
  };

  _onRemove = event => {
    const tasks = TaskFactory.tasksForMovingToTrash({
      source: 'Quick Actions: Thread List: Trash',
      threads: [this.props.thread],
      currentPerspective: FocusedPerspectiveStore.current(),
    });
    if (Array.isArray(tasks) && tasks.length > 0) {
      tasks.forEach(task => {
        if (task && !task.accountId) {
          try {
            AppEnv.reportError(new Error(`Trash Task no accountId`), {
              errorData: {
                task: task.toJSON(),
                thread: JSON.stringify(this.props.thread),
              },
            });
          } catch (e) {
            console.error(e);
          }
        }
      });
    }
    Actions.queueTasks(tasks);
    // if (tasks.length > 0) {
    //   nextActionForTrashOrArchive({
    //     source: 'Quick Actions: Thread List: Trash',
    //     affectedItems: [this.props.thread],
    //   });
    // }
    // Don't trigger the thread row click
    event.stopPropagation();
  };
}

class ThreadStarQuickAction extends React.Component {
  static displayName = 'ThreadStarQuickAction';
  static propTypes = { thread: PropTypes.object };

  render() {
    const className = this.props.thread.starred ? 'flagged' : 'flag-not-selected';
    const title = this.props.thread.starred ? 'Unflag' : 'Flag';
    return (
      <div
        key="remove"
        title={title}
        style={{ order: 109 }}
        className={'action action-flag ' + className}
        onClick={this._onToggleStar}
      >
        <RetinaImg
          name="flag.svg"
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }

  _onToggleStar = event => {
    const tasks = TaskFactory.taskForInvertingStarred({
      threads: [this.props.thread],
      source: 'Quick Actions: Thread List: ToggleStar',
    });
    if (Array.isArray(tasks) && tasks.length > 0) {
      tasks.forEach(task => {
        if (task && !task.accountId) {
          try {
            AppEnv.reportError(new Error(`Toggle Star Task no accountId`), {
              errorData: {
                task: task.toJSON(),
                thread: JSON.stringify(this.props.thread),
              },
            });
          } catch (e) {
            console.error(e);
          }
        }
      });
    }
    Actions.queueTasks(tasks);
    // Don't trigger the thread row click
    return event.stopPropagation();
  };
}

class ThreadUnreadQuickAction extends React.Component {
  static displayName = 'ThreadUnreadQuickAction';
  static propTypes = { thread: PropTypes.object };

  render() {
    const imgName = this.props.thread.unread ? 'read.svg' : 'unread.svg';
    const title = this.props.thread.unread ? 'Read' : 'Unread';
    return (
      <div
        key="remove"
        title={'Mark as ' + title}
        style={{ order: 112 }}
        className="action action-flag"
        onClick={this._onToggleUnread}
      >
        <RetinaImg
          name={imgName}
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }

  _onToggleUnread = event => {
    const task = TaskFactory.taskForInvertingUnread({
      threads: [this.props.thread],
      source: 'Quick Actions: Thread List',
    });
    if (task && !task.accountId) {
      try {
        AppEnv.reportError(new Error(`Unread Task no accountId`), {
          errorData: {
            task: task.toJSON(),
            thread: JSON.stringify(this.props.thread),
          },
        });
      } catch (e) {
        console.error(e);
      }
    }
    Actions.queueTasks([task]);
    // Don't trigger the thread row click
    return event.stopPropagation();
  };
}
class ThreadSpamQuickAction extends React.Component {
  static displayName = 'ThreadSpamQuickAction';
  static propTypes = { thread: PropTypes.object };

  render() {
    const allInSpam = this.props.thread.labelIds
      .map(labelId => {
        const cat = CategoryStore.byId(this.props.thread.accountId, labelId);
        if (!cat) {
          AppEnv.reportError(
            `Category for ${this.props.thread.accountId} with label id ${labelId} is null`
          );
          return {};
        }
        return cat;
      })
      .every(folder => folder.role === 'spam');

    if (allInSpam) {
      return (
        <div
          key="spam"
          title="Not Junk"
          style={{ order: 100 }}
          className="action action-spam"
          onClick={this._onMarkAsNotSpam}
        >
          <RetinaImg
            name="not-junk.svg"
            style={{ width: 24, height: 24, fontSize: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </div>
      );
    }

    const allowed = FocusedPerspectiveStore.current().canMoveThreadsTo([this.props.thread], 'spam');
    if (!allowed) {
      return false;
    }

    return (
      <div
        key="spam"
        title="Mark as Spam"
        style={{ order: 100 }}
        className="action action-spam"
        onClick={this._onMarkAsSpam}
      >
        <RetinaImg
          name="spam.svg"
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }

  shouldComponentUpdate(newProps, newState) {
    const newAllowed = newProps.thread.folders.find(c => c.role === 'spam');
    const prevAllowed = this.props.thread.folders.find(c => c.role === 'spam');
    return (
      newProps.thread.id !== (this.props != null ? this.props.thread.id : undefined) ||
      newAllowed !== prevAllowed
    );
  }

  _onMarkAsSpam = event => {
    const tasks = TaskFactory.tasksForMarkingAsSpam({
      source: 'Quick Actions: Thread List: Mark as Spam',
      threads: [this.props.thread],
      currentPerspective: FocusedPerspectiveStore.current(),
    });
    Actions.queueTasks(tasks);
    if (event) {
      event.stopPropagation();
    }
  };

  _onMarkAsNotSpam = event => {
    const tasks = TaskFactory.tasksForMarkingNotSpam({
      source: 'Quick Actions: Thread List: Mark as not Spam',
      threads: [this.props.thread],
      currentPerspective: FocusedPerspectiveStore.current(),
    });
    Actions.queueTasks(tasks);
    if (event) {
      event.stopPropagation();
    }
  };
}

module.exports = {
  ThreadUnreadQuickAction,
  ThreadStarQuickAction,
  ThreadArchiveQuickAction,
  ThreadTrashQuickAction,
  ThreadMoveQuickAction,
  ThreadSpamQuickAction,
};
