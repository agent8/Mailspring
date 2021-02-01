import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {
  RetinaImg,
  CreateButtonGroup,
  BindGlobalCommands,
  FullScreenModal,
} from 'mailspring-component-kit';
import {
  AccountStore,
  Actions,
  TaskFactory,
  ChangeLabelsTask,
  CategoryStore,
  FocusedContentStore,
  FocusedPerspectiveStore,
  WorkspaceStore,
  MessageStore,
  SiftStore,
  ThreadStore,
} from 'mailspring-exports';
import { remote } from 'electron';
import ThreadListStore from './thread-list-store';
import ToolbarCategoryPicker from '../../category-picker/lib/toolbar-category-picker';
import _ from 'underscore';

const { Menu, MenuItem } = remote;
const commandCb = (event, cb, cbArgs) => {
  if (event) {
    if (event.propagationStopped) {
      return;
    }
    event.stopPropagation();
  }
  cb(cbArgs);
};
const threadSelectionScope = (props, selection) => {
  let threads = props.items;
  const focusedThread = FocusedContentStore.focused('thread');
  const workspaceMode = WorkspaceStore.layoutMode();
  if (selection && workspaceMode !== 'list') {
    const selectionThreads = selection.items();
    if (Array.isArray(selectionThreads) && selectionThreads.length > 0) {
      threads = selectionThreads;
    }
  } else if (selection && !focusedThread && workspaceMode === 'list') {
    const selectionThreads = selection.items();
    if (Array.isArray(selectionThreads) && selectionThreads.length > 0) {
      threads = selectionThreads;
    }
  } else if (focusedThread && workspaceMode === 'list') {
    threads = [focusedThread];
  }
  return threads;
};
const hiddenButtonSelectionScope = (props, threads) => {
  let items = threads ? threads : props.items;
  const sheet = WorkspaceStore.topSheet();
  const focusedItem = FocusedContentStore.focused('thread');
  if (sheet && sheet.id === 'Thread') {
    if (focusedItem) {
      items = [focusedItem];
    } else {
      items = [];
    }
  } else {
    if (!Array.isArray(items) || items.length === 0) {
      if (focusedItem) {
        items = [focusedItem];
      } else {
        items = [];
      }
    }
  }
  return items;
};

const isSameAccount = items => {
  if (!Array.isArray(items)) {
    return true;
  }
  let accountId = '';
  for (let item of items) {
    if (!accountId) {
      accountId = item.accountId;
    } else if (accountId !== item.accountId) {
      return false;
    }
  }
  return true;
};

export function ArchiveButton(props) {
  const _onShortCut = event => {
    _onArchive(event, threadSelectionScope(props, props.selection));
  };
  const _onArchive = (event, threads) => {
    const archivingThreads = Array.isArray(threads) ? threads : props.items;
    const tasks = TaskFactory.tasksForArchiving({
      threads: archivingThreads,
      source: 'Toolbar Button: Thread List',
      currentPerspective: FocusedPerspectiveStore.current(),
    });
    Actions.queueTasks(tasks);
    // nextActionForRemoveFromView('ToolbarButton:ThreadList:archive', archivingThreads);
    if (event) {
      event.stopPropagation();
    }
    if (props.selection) {
      props.selection.clear();
    }
    if (AppEnv.isThreadWindow()) {
      AppEnv.debugLog(`Archive closing window because in ThreadWindow`);
      AppEnv.close();
    }
  };

  const allowed = FocusedPerspectiveStore.current().canArchiveThreads(props.items);
  if (!allowed) {
    return false;
  }

  const title = 'Archive';

  if (props.isMenuItem) {
    return new MenuItem({
      label: title,
      click: () => _onArchive(),
    });
  }

  return (
    <BindGlobalCommands
      key="archive-item"
      commands={{ 'core:archive-item': event => commandCb(event, _onShortCut) }}
    >
      <button tabIndex={-1} className="btn btn-toolbar" title={title} onClick={_onArchive}>
        <RetinaImg
          name={'archive.svg'}
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </button>
    </BindGlobalCommands>
  );
}
ArchiveButton.displayName = 'ArchiveButton';
ArchiveButton.containerRequired = false;
ArchiveButton.propTypes = {
  selection: PropTypes.object,
  items: PropTypes.array,
  isMenuItem: PropTypes.bool,
};

export function TrashButton(props) {
  const _onShortCutRemove = event => {
    _onRemove(event, threadSelectionScope(props, props.selection));
  };
  const _onShortCutExpunge = event => {
    _onExpunge(event, threadSelectionScope(props, props.selection));
  };
  const _onShortCutSearchTrash = event => {
    _onSearchTrash(event, threadSelectionScope(props, props.selection));
  };
  const _onSearchTrash = (event, threads) => {
    const moveThreads = [];
    const expungeMessages = [];
    threads.forEach(thread => {
      if (
        allFoldersInTrashOrSpam(thread.accountId, thread.labelIds) &&
        Array.isArray(thread.__messages)
      ) {
        expungeMessages.push(...thread.__messages);
      } else {
        moveThreads.push(thread);
      }
    });
    const moveTasks = TaskFactory.tasksForMovingToTrash({
      threads: moveThreads,
      currentPerspective: FocusedPerspectiveStore.current(),
      source: 'Toolbar Button: Search Trash',
    });
    const expungeTasks = TaskFactory.tasksForExpungingThreadsOrMessages({
      messages: expungeMessages,
      source: 'Toolbar Button: Search Expunge',
    });
    const tasks = [...moveTasks, ...expungeTasks];
    Actions.queueTasks(tasks);
    // nextActionForRemoveFromView('Toolbar Button: Search', threads);
    if (event) {
      event.stopPropagation();
    }
    if (props.selection) {
      props.selection.clear();
    }
    if (AppEnv.isThreadWindow()) {
      AppEnv.debugLog(`Remove Closing window because in ThreadWindow`);
      AppEnv.close();
    }
  };
  const _onRemove = (event, threads) => {
    const affectedThreads = Array.isArray(threads) ? threads : props.items;
    const tasks = TaskFactory.tasksForMovingToTrash({
      threads: affectedThreads,
      currentPerspective: FocusedPerspectiveStore.current(),
      source: 'Toolbar Button: Thread List',
    });
    if (Array.isArray(tasks) && tasks.length > 0) {
      tasks.forEach(task => {
        if (!task.accountId) {
          try {
            AppEnv.reportError(new Error(`Trash Task no accountId`), {
              errorData: {
                task: task.toJSON(),
                threads: JSON.stringify(props.items),
              },
            });
          } catch (e) {
            AppEnv.logError(e);
          }
        }
      });
    }
    Actions.queueTasks(tasks);
    // nextActionForRemoveFromView('ToolbarButton:ThreadList:remove', affectedThreads);
    if (event) {
      event.stopPropagation();
    }
    if (props.selection) {
      props.selection.clear();
    }
    if (AppEnv.isThreadWindow()) {
      AppEnv.debugLog(`Remove Closing window because in ThreadWindow`);
      AppEnv.close();
    }
  };
  const _onExpunge = (event, threads) => {
    let messages = [];
    const missingMessagesThreads = [];
    if (!Array.isArray(threads)) {
      threads = props.items;
    }
    threads.forEach(thread => {
      if (Array.isArray(thread.__messages) && thread.__messages.length > 0) {
        messages = messages.concat(thread.__messages);
      } else {
        missingMessagesThreads.push(thread);
      }
    });
    const tasks = TaskFactory.tasksForExpungingThreadsOrMessages({
      messages: messages,
      threads: missingMessagesThreads,
      source: 'Toolbar Button: Thread List',
    });
    if (Array.isArray(tasks) && tasks.length > 0) {
      tasks.forEach(task => {
        if (!task.accountId) {
          try {
            AppEnv.reportError(new Error(`Trash Task no accountId`), {
              errorData: {
                task: task.toJSON(),
                messages: JSON.stringify(messages),
              },
            });
          } catch (e) {
            AppEnv.logError(e);
          }
        }
      });
    }
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
      if (AppEnv.isThreadWindow()) {
        AppEnv.logDebug(`Closing window because in ThreadWindow`);
        AppEnv.close();
      }
    });
    // nextActionForRemoveFromView('ToolbarButton:ThreadList:expunge', threads);
    if (event) {
      event.stopPropagation();
    }
  };

  const allFoldersInTrashOrSpam = (accountId, labelIds) => {
    if (!Array.isArray(labelIds) || !accountId) {
      return false;
    }
    const trashCategory = CategoryStore.getCategoryByRole(accountId, 'trash');
    const spamCategory = CategoryStore.getCategoryByRole(accountId, 'spam');
    const isExchange = AccountStore.isExchangeAccountId(accountId);
    return labelIds
      .map(labelId => CategoryStore.byId(accountId, labelId))
      .every(folder => {
        let ret = folder.role === 'trash' || folder.role === 'spam';
        if (ret) {
          return true;
        }
        if (!isExchange) {
          return (
            (trashCategory &&
              (trashCategory.isAncestorOf(folder) || trashCategory.isParentOf(folder))) ||
            (spamCategory && (spamCategory.isAncestorOf(folder) || spamCategory.isParentOf(folder)))
          );
        } else {
          return (
            (trashCategory && CategoryStore.isCategoryAParentOfB(trashCategory, folder)) ||
            (spamCategory && CategoryStore.isCategoryAParentOfB(spamCategory, folder))
          );
        }
      });
  };
  // const notAllFoldersInTrashOrSpam = (accountId, labelIds) => {
  //   if (!Array.isArray(labelIds) || !accountId) {
  //     return false;
  //   }
  //   const trashCategory = CategoryStore.getCategoryByRole(accountId, 'trash');
  //   const spamCategory = CategoryStore.getCategoryByRole(accountId, 'spam');
  //   const isExchange = AccountStore.isExchangeAccountId(accountId);
  //   return labelIds
  //     .map(labelId => CategoryStore.byId(accountId, labelId))
  //     .some(folder => {
  //       let ret = folder.role !== 'trash' && folder.role !== 'spam';
  //       if (!ret) {
  //         return false;
  //       }
  //       if (!isExchange) {
  //         return (
  //           !(
  //             trashCategory &&
  //             (trashCategory.isAncestorOf(folder) || trashCategory.isParentOf(folder))
  //           ) &&
  //           !(
  //             spamCategory &&
  //             (spamCategory.isAncestorOf(folder) || spamCategory.isParentOf(folder))
  //           )
  //         );
  //       } else {
  //         return (
  //           !(trashCategory && CategoryStore.isCategoryAParentOfB(trashCategory, folder)) &&
  //           !(spamCategory && CategoryStore.isCategoryAParentOfB(spamCategory, folder))
  //         );
  //       }
  //     });
  // };
  const isMixed = threads => {
    let notInTrashOrSpam = undefined;
    let inTrashOrSpam = undefined;
    for (let i = 0; i < threads.length; i++) {
      if (allFoldersInTrashOrSpam(threads[i].accountId, threads[i].labelIds)) {
        inTrashOrSpam = true;
      } else {
        notInTrashOrSpam = true;
      }
      if (inTrashOrSpam !== undefined && notInTrashOrSpam !== undefined) {
        if (inTrashOrSpam && notInTrashOrSpam) {
          return true;
        }
      }
    }
    return false;
  };
  const allThreadsInTrashOrSpam = threads => {
    return threads.every(thread => allFoldersInTrashOrSpam(thread.accountId, thread.labelIds));
  };
  // const allThreadsNotInTrashOrSpam = threads => {
  //   return threads.every(thread => notAllFoldersInTrashOrSpam(thread.accountId, thread.labelIds));
  // };

  const isInSearch = props => {
    let currentPerspective = props.currentPerspective;
    if (!currentPerspective) {
      currentPerspective = FocusedPerspectiveStore.current();
    }
    return currentPerspective && currentPerspective.isSearchMailbox;
  };

  const canMove = FocusedPerspectiveStore.current().canMoveThreadsTo(props.items, 'trash');
  const canExpunge = FocusedPerspectiveStore.current().canExpungeThreads(props.items);
  if (!canMove && !canExpunge) {
    return false;
  }
  let actionCallBack = null;
  let title;
  if (canExpunge) {
    actionCallBack = _onShortCutExpunge;
    title = 'Delete Forever';
  } else if (canMove) {
    actionCallBack = _onShortCutRemove;
    title = 'Move to Trash';
    if (
      isInSearch(props) &&
      props.thread &&
      Array.isArray(props.thread.labelIds) &&
      allFoldersInTrashOrSpam(props.thread.accountId, props.thread.labelIds)
    ) {
      actionCallBack = _onShortCutExpunge;
      title = 'Delete Forever';
    }
  }
  if (isInSearch(props) && !props.thread) {
    const threads = threadSelectionScope(props, props.selection);
    if (isMixed(threads)) {
      title = 'Trash';
    } else if (allThreadsInTrashOrSpam(threads)) {
      title = 'Delete Forever';
    } else {
      title = 'Trash';
    }
    actionCallBack = _onShortCutSearchTrash;
  }

  if (props.isMenuItem) {
    return new MenuItem({
      label: title,
      click: () => actionCallBack(),
    });
  }

  return (
    <BindGlobalCommands
      key="delete-item"
      commands={{ 'core:delete-item': event => commandCb(event, actionCallBack) }}
    >
      <button tabIndex={-1} className="btn btn-toolbar" title={title} onClick={actionCallBack}>
        <RetinaImg
          name={'trash.svg'}
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </button>
    </BindGlobalCommands>
  );
}
TrashButton.displayName = 'TrashButton';
TrashButton.containerRequired = false;
TrashButton.propTypes = {
  selection: PropTypes.object,
  items: PropTypes.array,
  thread: PropTypes.object,
  isMenuItem: PropTypes.bool,
  isSearchMailbox: PropTypes.bool,
  currentPerspective: PropTypes.object,
};

export function MarkAsSpamButton(props) {
  const _onShortcutNotSpam = event => {
    _onNotSpam(event, threadSelectionScope(props, props.selection));
  };
  const _onNotSpam = (event, threads) => {
    const tasks = TaskFactory.tasksForMarkingNotSpam({
      source: 'Toolbar Button: Thread List',
      threads: Array.isArray(threads) ? threads : props.items,
      currentPerspective: FocusedPerspectiveStore.current(),
    });
    Actions.queueTasks(tasks);
    Actions.popSheet({ reason: 'ToolbarButton:MarkAsSpamButton:NotSpam' });
    if (event) {
      event.stopPropagation();
    }
    if (props.selection) {
      props.selection.clear();
    }
    if (AppEnv.isThreadWindow()) {
      AppEnv.debugLog(`Not Spam closing window because in ThreadWindow`);
      AppEnv.close();
    }
  };

  const _onShortcutMarkAsSpam = event => {
    _onMarkAsSpam(event, threadSelectionScope(props, props.selection));
  };
  const _onMarkAsSpam = (event, threads) => {
    const affectedThreads = Array.isArray(threads) ? threads : props.items;
    const tasks = TaskFactory.tasksForMarkingAsSpam({
      threads: affectedThreads,
      source: 'Toolbar Button: Thread List',
      currentPerspective: FocusedPerspectiveStore.current(),
    });
    Actions.queueTasks(tasks);
    // nextActionForRemoveFromView('ToolbarButton:MarkAsSpamButton:Spam', affectedThreads);
    if (event) {
      event.stopPropagation();
    }
    if (props.selection) {
      props.selection.clear();
    }
    if (AppEnv.isThreadWindow()) {
      AppEnv.debugLog(`Closing window because in ThreadWindow`);
      AppEnv.close();
    }
  };

  const allInSpam = props.items.every(item => item.folders.find(c => c.role === 'spam'));

  if (allInSpam) {
    const title = 'Not Junk';
    if (props.isMenuItem) {
      return new MenuItem({
        label: title,
        click: () => _onShortcutNotSpam(),
      });
    }

    return (
      <BindGlobalCommands
        key="not-spam"
        commands={{
          'core:report-not-spam': event => commandCb(event, _onShortcutNotSpam),
        }}
      >
        <button
          tabIndex={-1}
          className="btn btn-toolbar"
          title={title}
          onClick={_onShortcutNotSpam}
        >
          <RetinaImg
            name="not-junk.svg"
            style={{ width: 24, height: 24, fontSize: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </button>
      </BindGlobalCommands>
    );
  }

  const allowed = FocusedPerspectiveStore.current().canMoveThreadsTo(props.items, 'spam');
  if (!allowed) {
    return false;
  }
  const title = 'Mark as Spam';
  if (props.isMenuItem) {
    return new MenuItem({
      label: title,
      click: () => _onShortcutMarkAsSpam(),
    });
  }
  return (
    <BindGlobalCommands
      key="spam"
      commands={{
        'core:report-as-spam': event => commandCb(event, _onShortcutMarkAsSpam),
      }}
    >
      <button
        key="spam"
        tabIndex={-1}
        className="btn btn-toolbar"
        title={title}
        onClick={_onShortcutMarkAsSpam}
      >
        <RetinaImg
          name={'junk.svg'}
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </button>
    </BindGlobalCommands>
  );
}
MarkAsSpamButton.displayName = 'MarkAsSpamButton';
MarkAsSpamButton.containerRequired = false;
MarkAsSpamButton.propTypes = {
  selection: PropTypes.object,
  items: PropTypes.array,
  isMenuItem: PropTypes.bool,
};

export function PrintThreadButton(props) {
  const _onPrintThread = () => {
    const node = document.querySelector('#message-list');
    const currentThread = MessageStore.thread();
    Actions.printThread(currentThread, node.outerHTML);
  };

  const title = `Print ${AppEnv.isDisableThreading() ? 'Message' : 'Thread'}`;

  if (props.isMenuItem) {
    return new MenuItem({
      label: title,
      click: () => _onPrintThread(),
    });
  }

  return (
    <button
      key="print"
      tabIndex={-1}
      className="btn btn-toolbar"
      title={title}
      onClick={_onPrintThread}
    >
      <RetinaImg
        name={'print.svg'}
        style={{ width: 24, height: 24, fontSize: 24 }}
        isIcon
        mode={RetinaImg.Mode.ContentIsMask}
      />
    </button>
  );
}
PrintThreadButton.displayName = 'PrintThreadButton';
PrintThreadButton.propTypes = {
  isMenuItem: PropTypes.bool,
};

export function ToggleStarredButton(props) {
  const _onShortcutStar = event => {
    _onStar(event, threadSelectionScope(props, props.selection));
  };
  const _onStar = (event, threads) => {
    Actions.queueTasks(
      TaskFactory.taskForInvertingStarred({
        threads: Array.isArray(threads) ? threads : props.items,
        source: 'Toolbar Button: Thread List',
      })
    );
    if (event) {
      event.stopPropagation();
    }
    if (props.selection) {
      props.selection.clear();
    }
  };
  const postClickStarredState = props.items.every(t => t.starred === false);
  const title = postClickStarredState ? 'Flag' : 'Unflag';
  const className = postClickStarredState ? 'flag-not-selected' : 'flagged';

  if (props.isMenuItem) {
    return new MenuItem({
      label: title,
      click: () => _onStar(),
    });
  }

  return (
    <BindGlobalCommands
      key="star-item"
      commands={{ 'core:star-item': event => commandCb(event, _onShortcutStar) }}
    >
      <button
        tabIndex={-1}
        className={'btn btn-toolbar ' + className}
        title={title}
        onClick={_onStar}
      >
        <RetinaImg
          name="flag.svg"
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </button>
    </BindGlobalCommands>
  );
}
ToggleStarredButton.displayName = 'ToggleStarredButton';
ToggleStarredButton.containerRequired = false;
ToggleStarredButton.propTypes = {
  selection: PropTypes.object,
  items: PropTypes.array,
  isMenuItem: PropTypes.bool,
};

export function ToggleUnreadButton(props) {
  const _onClick = event => {
    const targetUnread = props.items.every(t => t.unread === false);
    _onChangeUnread(targetUnread, null, 'Toolbar Button:onClick:Thread List');
    if (event) {
      event.stopPropagation();
    }
  };

  const _onShortcutChangeUnread = targetUnread => {
    _onChangeUnread(
      targetUnread,
      threadSelectionScope(props, props.selection),
      'Toolbar Button:Shortcut:Thread List'
    );
  };

  const _onChangeUnread = (targetUnread, threads, source = 'Toolbar Button: Thread List') => {
    Actions.queueTasks(
      TaskFactory.taskForSettingUnread({
        threads: Array.isArray(threads) ? threads : props.items,
        unread: targetUnread,
        source,
      })
    );
    // Actions.popSheet({ reason: 'ToolbarButton:ToggleUnread:changeUnread' });
    if (props.selection) {
      props.selection.clear();
    }
  };

  const targetUnread = props.items.every(t => t.unread === false);
  const fragment = targetUnread ? 'unread' : 'read';
  const title = `Mark as ${fragment}`;

  if (props.isMenuItem) {
    return new MenuItem({
      label: title,
      click: () => _onClick(),
    });
  }

  return (
    <BindGlobalCommands
      key={fragment}
      commands={{
        'core:mark-as-unread': event => commandCb(event, _onShortcutChangeUnread, true),
        'core:mark-as-read': event => commandCb(event, _onShortcutChangeUnread, false),
      }}
    >
      <button tabIndex={-1} className="btn btn-toolbar" title={title} onClick={_onClick}>
        <RetinaImg
          name={`${fragment === 'unread' ? 'unread' : 'read'}.svg`}
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </button>
    </BindGlobalCommands>
  );
}
ToggleUnreadButton.displayName = 'ToggleUnreadButton';
ToggleUnreadButton.containerRequired = false;
ToggleUnreadButton.propTypes = {
  selection: PropTypes.object,
  items: PropTypes.array,
  isMenuItem: PropTypes.bool,
};

class HiddenGenericRemoveButton extends React.Component {
  static displayName = 'HiddenGenericRemoveButton';

  _onShift = ({ offset }) => {
    const currentPerspective = FocusedPerspectiveStore.current();
    const isInSift = currentPerspective && currentPerspective.sift;
    let dataSource;
    let focusedId;
    if (isInSift) {
      dataSource = SiftStore.dataSource();
      focusedId = FocusedContentStore.focusedId('sift');
    } else {
      dataSource = ThreadListStore.dataSource();
      focusedId = FocusedContentStore.focusedId('thread');
    }
    const focusedIdx = Math.min(
      dataSource.count() - 1,
      Math.max(0, dataSource.indexOfId(focusedId) + offset)
    );
    const item = dataSource.get(focusedIdx);
    if (isInSift) {
      Actions.setFocus({
        collection: 'sift',
        item,
        reason: 'ThreadToolbarButton:HiddenButton:onShift:isInShift',
      });
      Actions.setCursorPosition({ collection: 'sift', item });
      ThreadStore.findBy({ threadId: item.threadId }).then(result => {
        Actions.setFocus({
          collection: 'thread',
          item: result,
          reason: 'ThreadToolbarButton:HiddenButton:onShift:db',
        });
        Actions.setCursorPosition({ collection: 'thread', item: result });
      });
    } else {
      Actions.setFocus({
        collection: 'thread',
        item,
        reason: 'ThreadToolbarButton:HiddenButton:onShift',
      });
    }
  };

  render() {
    return (
      <BindGlobalCommands
        key="show-previous-next"
        commands={{
          'core:show-previous': event => commandCb(event, this._onShift, { offset: -1 }),
          'core:show-next': event => commandCb(event, this._onShift, { offset: 1 }),
        }}
      >
        <span />
      </BindGlobalCommands>
    );
  }
}

class HiddenToggleImportantButton extends React.Component {
  static displayName = 'HiddenToggleImportantButton';
  static propTypes = {
    selection: PropTypes.object,
    items: PropTypes.array,
  };

  _onShortcutSetImportant = important => {
    this._onSetImportant(important, threadSelectionScope(this.props, this.props.selection));
  };
  _onSetImportant = (important, threads) => {
    const items = hiddenButtonSelectionScope(this.props, threads);
    Actions.queueTasks(
      TaskFactory.tasksForThreadsByAccountId(items, (accountThreads, accountId) => {
        let labelsToAdd;
        let labelsToRemove;
        if (important) {
          labelsToAdd = [CategoryStore.getCategoryByRole(accountId, 'important')];
          labelsToRemove = [];
        } else {
          labelsToAdd = [];
          labelsToRemove = [CategoryStore.getCategoryByRole(accountId, 'important')];
        }
        return [
          new ChangeLabelsTask({
            threads: accountThreads,
            source: 'Keyboard Shortcut',
            labelsToAdd: labelsToAdd,
            labelsToRemove: labelsToRemove,
          }),
        ];
      })
    );
  };

  render() {
    if (!AppEnv.config.get('core.workspace.showImportant')) {
      return false;
    }
    const allImportant = this.props.items.every(item =>
      item.labels.find(c => c.role === 'important')
    );
    const allowed = FocusedPerspectiveStore.current().canMoveThreadsTo(
      this.props.items,
      'important'
    );
    if (!allowed && !allImportant) {
      return false;
    }

    return (
      <BindGlobalCommands
        key={allImportant ? 'unimportant' : 'important'}
        commands={{
          'core:mark-unimportant': event => commandCb(event, this._onShortcutSetImportant, false),
          'core:mark-important': event => commandCb(event, this._onShortcutSetImportant, true),
        }}
      >
        <span />
      </BindGlobalCommands>
    );
  }
}

export class ThreadListMoreButton extends React.Component {
  static displayName = 'ThreadListMoreButton';
  static containerRequired = false;

  static propTypes = {
    position: PropTypes.string,
    selection: PropTypes.object,
    items: PropTypes.array.isRequired,
    dataSource: PropTypes.any,
  };

  constructor(props) {
    super(props);
    const current = FocusedPerspectiveStore.current();
    if (current && current.accountIds.length) {
      this._account = AccountStore.accountForId(current.accountIds[0]);
    }
    this.state = { showMoveToOtherDialog: false, showMoveToFocusedDialog: false };
    this._mounted = false;
  }
  componentDidMount() {
    this._mounted = true;
  }
  componentWillUnmount() {
    this._mounted = false;
  }

  UNSAFE_componentWillUpdate() {
    const current = FocusedPerspectiveStore.current();
    if (current && current.accountIds.length) {
      this._account = AccountStore.accountForId(current.accountIds[0]);
    }
  }

  _onPrintThread = () => {
    const node = document.querySelector('#message-list');
    const currentThread = MessageStore.thread();
    Actions.printThread(currentThread, node.outerHTML);
  };

  _more = () => {
    const selectionCount = this.props.items ? this.props.items.length : 0;
    const menu = new Menu();
    const accounts = AccountStore.accountsForItems(this.props.items);
    const current = FocusedPerspectiveStore.current();
    if (selectionCount > 0) {
      if (isSameAccount(this.props.items)) {
        menu.append(
          new MenuItem({
            label: 'Move to Folder',
            click: () => {
              AppEnv.commands.dispatch('core:change-folders', this._anchorEl);
            },
          })
        );
      }
      if (current.isFocusedOtherPerspective && !current.isOther) {
        menu.append(
          new MenuItem({
            label: 'Move to Other',
            click: this._onToggleMoveOther,
          })
        );
      }
      if (current.isFocusedOtherPerspective && current.isOther) {
        menu.append(
          new MenuItem({
            label: 'Move to Focused',
            click: this._onToggleMoveFocused,
          })
        );
      }

      if (accounts.length === 1 && accounts[0].usesLabels()) {
        menu.append(
          new MenuItem({
            label: 'Apply Labels',
            click: () => AppEnv.commands.dispatch('core:change-labels', this._anchorEl),
          })
        );
      }
      if (this.props.items.every(item => item.unread)) {
        menu.append(
          new MenuItem({
            label: `Mark as read`,
            click: (menuItem, browserWindow) => {
              AppEnv.commands.dispatch('core:mark-as-read');
            },
          })
        );
      } else if (this.props.items.every(item => !item.unread)) {
        menu.append(
          new MenuItem({
            label: `Mark as unread`,
            click: (menuItem, browserWindow) => {
              AppEnv.commands.dispatch('core:mark-as-unread');
            },
          })
        );
      } else {
        menu.append(
          new MenuItem({
            label: `Mark as read`,
            click: (menuItem, browserWindow) => {
              AppEnv.commands.dispatch('core:mark-as-read');
            },
          })
        );
        menu.append(
          new MenuItem({
            label: `Mark as unread`,
            click: (menuItem, browserWindow) => {
              AppEnv.commands.dispatch('core:mark-as-unread');
            },
          })
        );
      }
      const allowed = FocusedPerspectiveStore.current().canMoveThreadsTo(this.props.items, 'spam');
      if (allowed) {
        menu.append(
          new MenuItem({
            label: `Mark as spam`,
            click: (menuItem, browserWindow) => {
              AppEnv.commands.dispatch('core:report-as-spam');
            },
          })
        );
      }
      const isAllAccountsUseLabels = accounts.every(acc => acc.usesLabels());
      if (isAllAccountsUseLabels) {
        const isAllImportant = this.props.items.every(item => {
          const category = CategoryStore.getCategoryByRole(item.accountId, 'important');
          return category && _.findWhere(item.labels, { id: category.id }) != null;
        });
        if (isAllImportant) {
          menu.append(
            new MenuItem({
              label: `Mark as unimportant`,
              click: () => AppEnv.commands.dispatch('core:mark-unimportant'),
            })
          );
        } else {
          menu.append(
            new MenuItem({
              label: `Mark as important`,
              click: () => AppEnv.commands.dispatch('core:mark-important'),
            })
          );
        }
      }
    } else {
      menu.append(
        new MenuItem({
          label: `Mark all as read`,
          click: (menuItem, browserWindow) => {
            const unreadThreads = this.props.dataSource.itemsCurrentlyInViewMatching(
              item => item.unread
            );
            Actions.queueTasks(
              TaskFactory.taskForSettingUnread({
                threads: unreadThreads,
                unread: false,
                source: 'Toolbar Button: Mark all read',
              })
            );
          },
        })
      );
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(
        new MenuItem({
          label: `Select messages for more options.`,
          enabled: false,
        })
      );
    }
    menu.popup({});
  };
  _onToggleMoveOther = () => {
    if (!this._mounted) {
      return;
    }
    this.setState({
      showMoveToOtherDialog: !this.state.showMoveToOtherDialog,
      showMoveToFocusedDialog: false,
    });
  };
  _onToggleMoveFocused = () => {
    if (!this._mounted) {
      return;
    }
    this.setState({
      showMoveToOtherDialog: false,
      showMoveToFocusedDialog: !this.state.showMoveToFocusedDialog,
    });
  };
  _onHideMoveOtherFocusedDialog = () => {
    if (!this._mounted) {
      return;
    }
    this.setState({
      showMoveToOtherDialog: false,
      showMoveToFocusedDialog: false,
    });
  };
  _onMoveToOtherFocused = () => {
    const { selection, items } = this.props;
    const threads = threadSelectionScope(this.props, selection);
    let tasks;
    if (this.state.showMoveToOtherDialog) {
      tasks = TaskFactory.tasksForMoveToOther(Array.isArray(threads) ? threads : items);
    } else if (this.state.showMoveToFocusedDialog) {
      tasks = TaskFactory.tasksForMoveToFocused(Array.isArray(threads) ? threads : items);
    }
    Actions.queueTasks(tasks);
    if (selection) {
      selection.clear();
    }
    this._onHideMoveOtherFocusedDialog();
  };

  _renderMoveOtherFocusedPopup = () => {
    let name;
    if (this.state.showMoveToFocusedDialog) {
      name = 'Focused';
    } else if (this.state.showMoveToOtherDialog) {
      name = 'Other';
    }
    return (
      <div className="email-confirm-popup">
        <RetinaImg
          isIcon
          className="close-icon"
          style={{ width: '20', height: '20' }}
          name="close.svg"
          mode={RetinaImg.Mode.ContentIsMask}
          onClick={this._onHideMoveOtherFocusedDialog}
        />
        <h1>{`Move to ${name} Inbox`}</h1>
        <p>
          Always move conversations from these senders to <br /> your {`${name} Inbox`}
        </p>
        <div className="btn-list">
          <div className="btn cancel" onClick={this._onHideMoveOtherFocusedDialog}>
            Cancel
          </div>
          <div className="btn confirm" onClick={this._onMoveToOtherFocused}>
            Move
          </div>
        </div>
      </div>
    );
  };
  _renderMoveToOtherFocusedDialog() {
    if (!this.state.showMoveToOtherDialog && !this.state.showMoveToFocusedDialog) {
      return null;
    }
    return (
      <FullScreenModal
        visible={this.state.showMoveToOtherDialog || this.state.showMoveToFocusedDialog}
        style={{
          height: 'auto',
          width: '400px',
          top: '165px',
          right: '255px',
          left: 'auto',
          bottom: 'auto',
        }}
      >
        {this._renderMoveOtherFocusedPopup()}
      </FullScreenModal>
    );
  }

  render() {
    return [
      <button
        key={`moreButton${this.props.position}`}
        id={`moreButton${this.props.position}`}
        ref={el => (this._anchorEl = el)}
        tabIndex={-1}
        className="btn btn-toolbar btn-list-more"
        onClick={this._more}
      >
        <RetinaImg
          key={'moreIcon'}
          name="more.svg"
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </button>,
      this._renderMoveToOtherFocusedDialog(),
    ];
  }
}

export class MoreButton extends React.Component {
  static displayName = 'MoreButton';
  static containerRequired = false;

  static propTypes = {
    items: PropTypes.array.isRequired,
    position: PropTypes.string,
  };

  _onPrintThread = () => {
    const node = document.querySelector('#message-list');
    const currentThread = MessageStore.thread();
    Actions.printThread(currentThread, node.outerHTML);
  };

  _more = () => {
    const expandTitle = MessageStore.hasCollapsedItems() ? 'Expand All' : 'Collapse All';
    const menu = new Menu();
    const messageListMoveButtons = WorkspaceStore.hiddenLocations().find(
      loc => loc.id === 'MessageListMoveButtons'
    );
    if (messageListMoveButtons) {
      const targetUnread = this.props.items.every(t => t.unread === false);
      const unreadTitle = targetUnread ? 'Mark as unread' : 'Mark as read';
      menu.append(
        new MenuItem({
          label: unreadTitle,
          click: () => {
            if (targetUnread) {
              AppEnv.commands.dispatch('core:mark-as-unread', targetUnread);
            } else {
              AppEnv.commands.dispatch('core:mark-as-read', targetUnread);
            }
          },
        })
      );
      if (isSameAccount(this.props.items)) {
        menu.append(
          new MenuItem({
            label: 'Move to Folder',
            click: () => AppEnv.commands.dispatch('core:change-folders-list', this._anchorEl),
          })
        );
      }
      const account = AccountStore.accountForItems(this.props.items);
      if (account && account.usesLabels()) {
        menu.append(
          new MenuItem({
            label: 'Apply Labels',
            click: () => AppEnv.commands.dispatch('core:change-labels-list', this._anchorEl),
          })
        );
      }
    }
    menu.append(
      new MenuItem({
        label: `Print ${AppEnv.isDisableThreading() ? 'Message' : 'Thread'}`,
        click: () => this._onPrintThread(),
      })
    );
    if (!AppEnv.isDisableThreading()) {
      menu.append(
        new MenuItem({
          label: expandTitle,
          click: () => Actions.toggleAllMessagesExpanded(),
        })
      );
    }
    menu.popup({});
  };

  render() {
    return (
      <button
        id={`threadToolbarMoreButton${this.props.position}`}
        tabIndex={-1}
        className="btn btn-toolbar btn-more"
        onClick={this._more}
        ref={el => (this._anchorEl = el)}
      >
        <RetinaImg
          name="more.svg"
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </button>
    );
  }
}

class ThreadArrowButton extends React.Component {
  static propTypes = {
    getStateFromStores: PropTypes.func,
    direction: PropTypes.string,
    command: PropTypes.string,
    title: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = this.props.getStateFromStores();
  }

  componentDidMount() {
    this._unsubscribe = ThreadListStore.listen(this._onStoreChange);
    this._unsubscribe_focus = FocusedContentStore.listen(this._onStoreChange);
  }

  componentWillUnmount() {
    this._unsubscribe();
    this._unsubscribe_focus();
  }

  _onClick = () => {
    if (this.state.disabled) {
      return;
    }
    AppEnv.commands.dispatch(this.props.command);
    return;
  };

  _onStoreChange = () => {
    this.setState(this.props.getStateFromStores());
  };

  render() {
    const { direction, title } = this.props;
    const classes = classNames({
      'btn-toolbar': true,
      'message-toolbar-arrow': true,
      disabled: this.state.disabled,
    });

    return (
      <div className={`${classes} ${direction}`} onClick={this._onClick} title={title}>
        <RetinaImg
          name={`${direction === 'up' ? 'back' : 'next'}.svg`}
          isIcon
          style={{ width: 24, height: 24, fontSize: 24 }}
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }
}

const Divider = (key = 'divider') => <div className="divider" key={key} />;
Divider.displayName = 'Divider';

export const ThreadEmptyMoreButtons = CreateButtonGroup(
  'ThreadEmptyMoreButtons',
  [ThreadListMoreButton],
  { order: -100 }
);

export const ThreadListToolbarButtons = CreateButtonGroup(
  'ThreadListToolbarButtons',
  [
    ArchiveButton,
    MarkAsSpamButton,
    TrashButton,
    ToggleStarredButton,
    ToggleUnreadButton,
    ThreadListMoreButton,
    ToolbarCategoryPicker,
  ],
  { order: 1 }
);
export const HiddenThreadListToolbarButtons = CreateButtonGroup(
  'HiddenThreadListToolbarButtons',
  [HiddenGenericRemoveButton, HiddenToggleImportantButton],
  { order: 1 }
);

export const DownButton = props => {
  const getStateFromStores = () => {
    const perspective = FocusedPerspectiveStore.current();
    let collection = 'thread';
    let store = ThreadListStore;
    if (perspective && perspective.sift) {
      collection = 'sift';
      store = SiftStore;
    }
    const selectedId = FocusedContentStore.focusedId(collection);
    const lastIndex = store.dataSource().count() - 1;
    const lastItem = store.dataSource().get(lastIndex);
    return {
      disabled: lastItem && lastItem.id === selectedId,
    };
  };

  if (WorkspaceStore.layoutMode() !== 'list') {
    return null;
  }

  const title = `Next ${AppEnv.isDisableThreading() ? 'Message' : 'Thread'}`;
  if (props.isMenuItem) {
    if (getStateFromStores().disabled) {
      return null;
    }
    return new MenuItem({
      label: title,
      click: () => AppEnv.commands.dispatch('core:show-next'),
    });
  }

  return (
    <ThreadArrowButton
      getStateFromStores={getStateFromStores}
      direction={'down'}
      title={title}
      command={'core:show-next'}
    />
  );
};
DownButton.displayName = 'DownButton';
DownButton.containerRequired = false;
DownButton.propTypes = {
  isMenuItem: PropTypes.bool,
};

export const UpButton = props => {
  const getStateFromStores = () => {
    const perspective = FocusedPerspectiveStore.current();
    let collection = 'thread';
    let store = ThreadListStore;
    if (perspective && perspective.sift) {
      collection = 'sift';
      store = SiftStore;
    }
    const selectedId = FocusedContentStore.focusedId(collection);
    const item = store.dataSource().get(0);
    return {
      disabled: item && item.id === selectedId,
    };
  };

  if (WorkspaceStore.layoutMode() !== 'list') {
    return null;
  }
  const title = `Previous ${AppEnv.isDisableThreading() ? 'Message' : 'Thread'}`;
  if (props.isMenuItem) {
    if (getStateFromStores().disabled) {
      return null;
    }
    return new MenuItem({
      label: title,
      click: () => AppEnv.commands.dispatch('core:show-previous'),
    });
  }

  return (
    <ThreadArrowButton
      getStateFromStores={getStateFromStores}
      direction={'up'}
      title={title}
      command={'core:show-previous'}
    />
  );
};
UpButton.displayName = 'UpButton';
UpButton.containerRequired = false;
UpButton.propTypes = {
  isMenuItem: PropTypes.bool,
};

export const PopoutButton = () => {
  const _onPopoutComposer = () => {
    const thread = MessageStore.thread();
    if (thread) {
      Actions.popoutThread(thread);
      // This returns the single-pane view to the inbox, and does nothing for
      // double-pane view because we're at the root sheet.
      // Actions.popSheet();
    }
  };

  if (!AppEnv.isComposerWindow()) {
    return (
      <div
        className="btn-toolbar message-toolbar-popout"
        key="popout"
        title="Popout composer…"
        onClick={_onPopoutComposer}
      >
        <RetinaImg
          name={'popout.svg'}
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </div>
    );
  }

  return null;
};
PopoutButton.displayName = 'PopoutButton';

function FolderButton(props) {
  if (props.isMenuItem) {
    const itemList = [
      new MenuItem({
        label: 'Move to Folder',
        click: () => AppEnv.commands.dispatch('core:change-folders-message', props.anchorEl),
      }),
    ];
    const account = AccountStore.accountForItems(props.items);
    if (account && account.usesLabels()) {
      itemList.push(
        new MenuItem({
          label: 'Apply Labels',
          click: () => AppEnv.commands.dispatch('core:change-labels-message', props.anchorEl),
        })
      );
    }
    return itemList;
  }

  return (
    <div key="folder">
      <ToolbarCategoryPicker {...props} />
    </div>
  );
}
FolderButton.displayName = 'FolderButton';
FolderButton.propTypes = {
  anchorEl: PropTypes.node,
  items: PropTypes.array,
  isMenuItem: PropTypes.bool,
};

const MailActionsMap = {
  archive: ArchiveButton,
  trash: TrashButton,
  flag: ToggleStarredButton,
  read: ToggleUnreadButton,
  folder: FolderButton,
  spam: MarkAsSpamButton,
  print: PrintThreadButton,
};

class MoreActionsButton extends React.Component {
  static displayName = 'MoreActionsButton';
  static propTypes = {
    moreButtonlist: PropTypes.array.isRequired,
    items: PropTypes.array.isRequired,
    thread: PropTypes.object,
    position: PropTypes.string,
  };

  constructor(props) {
    super(props);
  }

  _canReplyAll = () => {
    const lastMessage = (this.props.thread.__messages || MessageStore.items() || [])
      .filter(m => !m.draft)
      .pop();
    return lastMessage && lastMessage.canReplyAll();
  };

  _more = () => {
    const expandTitle = MessageStore.hasCollapsedItems() ? 'Expand All' : 'Collapse All';
    const menu = new Menu();

    const { moreButtonlist } = this.props;
    moreButtonlist.forEach(button => {
      if (button && typeof button === 'function') {
        const menuItem = button({ ...this.props, isMenuItem: true, anchorEl: this._anchorEl });
        // if the account has no spam folder, the menuItem is false
        if (menuItem) {
          if (menuItem instanceof Array) {
            menuItem.forEach(item => {
              menu.append(item);
            });
          } else {
            menu.append(menuItem);
          }
        }
      }
    });
    menu.insert(
      0,
      new MenuItem({
        label: `Forward`,
        click: () => AppEnv.commands.dispatch('core:forward'),
      })
    );
    if (this._canReplyAll()) {
      menu.insert(
        0,
        new MenuItem({
          label: `Reply All`,
          click: () => AppEnv.commands.dispatch('core:reply-all'),
        })
      );
    }
    menu.insert(
      0,
      new MenuItem({
        label: `Reply`,
        click: () => AppEnv.commands.dispatch('core:reply'),
      })
    );

    if (!AppEnv.isDisableThreading()) {
      menu.append(
        new MenuItem({
          label: expandTitle,
          click: () => Actions.toggleAllMessagesExpanded(),
        })
      );
    }
    const previousThread = UpButton({ ...this.props, isMenuItem: true });
    const nextThread = DownButton({ ...this.props, isMenuItem: true });
    if (previousThread) {
      menu.append(previousThread);
    }
    if (nextThread) {
      menu.append(nextThread);
    }

    menu.popup({});
  };

  render() {
    const { moreButtonlist } = this.props;
    const otherCommandBindings = [];

    if (moreButtonlist) {
      moreButtonlist.forEach(button => {
        if (button && typeof button === 'function') {
          const menuItem = button({
            ...this.props,
            isMenuItem: false,
            anchorEl: this._anchorEl,
          });
          // if the account has no spam folder, the menuItem is false
          if (menuItem) {
            if (menuItem instanceof Array) {
              menuItem.forEach(item => {
                otherCommandBindings.push(item);
              });
            } else {
              otherCommandBindings.push(menuItem);
            }
          }
        }
      });
    }
    return [
      <button
        key="btn-more"
        id={`threadToolbarMoreButton${this.props.position}`}
        tabIndex={-1}
        className="btn btn-toolbar btn-more"
        onClick={this._more}
        ref={el => (this._anchorEl = el)}
      >
        <RetinaImg
          name="more.svg"
          style={{ width: 24, height: 24, fontSize: 24 }}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      </button>,
      <div key="other-command-bindings" style={{ display: 'none' }}>
        {otherCommandBindings}
      </div>,
    ];
  }
}

export class MailActionsButtons extends React.Component {
  static displayName = 'MailActionsButtons';

  constructor(props) {
    super(props);
    this._configKey = 'core.mailActions';
    this.state = { actionsList: [] };
  }

  componentDidMount() {
    this._getMailActionsConfig();
    this._unobserveTemplate = AppEnv.config.observe(this._configKey, this._getMailActionsConfig);
  }

  _getMailActionsConfig = () => {
    const mailActionsConfig = AppEnv.config.get(this._configKey);
    const actionsList = [];
    for (let i = 1; i < 6; i += 1) {
      const actionValue = mailActionsConfig[`mailAction${i}`];
      if (
        actionValue &&
        typeof actionValue === 'string' &&
        Object.keys(MailActionsMap).indexOf(actionValue) > -1
      ) {
        actionsList.push(actionValue);
      }
    }

    this.setState({ actionsList });
  };

  componentWillUnmount() {
    if (this._unobserveTemplate && typeof this._unobserveTemplate.dispose === 'function') {
      this._unobserveTemplate.dispose();
    }
  }

  render() {
    const { actionsList } = this.state;
    const actionsButtonList = actionsList.map(key => MailActionsMap[key]);
    const ActionsButtons = CreateButtonGroup('ActionsButtons', actionsButtonList, { order: -21 });
    const moreButtonlist = [];
    Object.keys(MailActionsMap).forEach(key => {
      if (actionsList.indexOf(key) < 0) {
        moreButtonlist.push(MailActionsMap[key]);
      }
    });

    return (
      <div className="button-group">
        <ActionsButtons {...this.props} />
        <MoreActionsButton {...this.props} moreButtonlist={moreButtonlist} />
        <HiddenGenericRemoveButton />
        <div className="hidden-folder-button" style={{ width: 0, overflow: 'hidden' }}>
          <ToolbarCategoryPicker {...this.props} />
        </div>
      </div>
    );
  }
}

export const MailActionsPopoutButtons = CreateButtonGroup(
  'MailActionsPopoutButtons',
  [Divider, PopoutButton],
  { order: 21 }
);
