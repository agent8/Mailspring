import ChangeFolderTask from './change-folder-task';
import ChangeLabelsTask from './change-labels-task';
import ChangeUnreadTask from './change-unread-task';
import ChangeStarredTask from './change-starred-task';
import UndoTask from './undo-task';
import CategoryStore from '../stores/category-store';
import Thread from '../models/thread';
import Message from '../models/message';
import _ from 'underscore';
import DeleteThreadsTask from './delete-threads-task';
import ExpungeMessagesTask from './expunge-messages-task';
import DestroyDraftTask from './destroy-draft-task';
import CancelOutboxDraftTask from './cancel-outbox-draft-task';
import SyncbackCategoryTask from './syncback-category-task';
import MakePrimaryTask from './make-primary-task';
import MakeOtherTask from './make-other-task';
import { bannedPathNames } from '../../constant';
import ChangeAllUnreadTask from './change-all-unread-task';
import ContactUpdateTask from './contact-update-task';

const TaskFactory = {
  tasksForThreadsByAccountId(threads, callback) {
    const byAccount = {};
    if (!threads) {
      return [];
    }
    threads.forEach(thread => {
      if (!(thread instanceof Thread)) {
        throw new Error('tasksForApplyingCategories: `threads` must be instances of Thread');
      }
      const { accountId } = thread;
      if (!byAccount[accountId]) {
        byAccount[accountId] = { accountThreads: [], accountId: accountId };
      }
      byAccount[accountId].accountThreads.push(thread);
    });

    const tasks = [];
    Object.values(byAccount).forEach(({ accountThreads, accountId }) => {
      const taskOrTasks = callback(accountThreads, accountId);
      if (taskOrTasks && taskOrTasks instanceof Array) {
        tasks.push(...taskOrTasks);
      } else if (taskOrTasks) {
        tasks.push(taskOrTasks);
      }
      // const threadsByFolder = this._splitByFolder(accountThreads);
      // for (const item of threadsByFolder) {
      //
      // }
    });
    return tasks;
  },
  tasksForMessagesByAccount(messages = [], task = () => null) {
    if (typeof task !== 'function') {
      throw new Error(`sortMessagesByAccount: 'task' must be function`);
    }
    const byAccount = {};
    for (let message of messages) {
      if (!(message instanceof Message)) {
        throw new Error(`sortMessagesByAccount: 'messages' must be instance of Message`);
      }
      if (!byAccount[message.accountId]) {
        byAccount[message.accountId] = [];
      }
      byAccount[message.accountId].push(message);
    }
    const tasks = [];
    Object.keys(byAccount).forEach(accountId => {
      const taskOrTasks = task({ accountId, messages: byAccount[accountId] });
      if (taskOrTasks && taskOrTasks instanceof Array) {
        tasks.push(...taskOrTasks);
      } else if (taskOrTasks) {
        tasks.push(taskOrTasks);
      }
    });
    return tasks;
  },

  tasksForMarkingAsSpam({ threads, source, currentPerspective }) {
    return this.tasksForThreadsByAccountId(threads, (accountThreads, accountId) => {
      const previousFolder = this.findPreviousFolder(currentPerspective, accountId);
      return new ChangeFolderTask({
        previousFolder,
        folder: CategoryStore.getSpamCategory(accountId),
        threads: accountThreads,
        source,
      });
    });
  },

  tasksForMarkingNotSpam({ threads, source, currentPerspective }) {
    return this.tasksForThreadsByAccountId(threads, (accountThreads, accountId) => {
      const inbox = CategoryStore.getInboxCategory(accountId);
      const previousFolder = this.findPreviousFolder(currentPerspective, accountId);
      return new ChangeFolderTask({
        previousFolder,
        folder: inbox,
        threads: accountThreads,
        source,
      });
    });
  },

  tasksForArchiving({ threads, source, currentPerspective }) {
    return this.tasksForThreadsByAccountId(threads, (accountThreads, accountId) => {
      const inbox = CategoryStore.getInboxCategory(accountId);
      const previousFolder = this.findPreviousFolder(currentPerspective, accountId);
      if (inbox.isLabel()) {
        return new ChangeLabelsTask({
          previousFolder,
          labelsToRemove: [inbox],
          labelsToAdd: [],
          threads: accountThreads,
          source,
        });
      }
      return new ChangeFolderTask({
        previousFolder,
        folder: CategoryStore.getArchiveCategory(accountId),
        threads: accountThreads,
        source,
      });
    });
  },

  tasksForMovingToTrash({ threads = [], messages = [], source, currentPerspective }) {
    const tasks = [];
    if (threads.length > 0 && threads[0] instanceof Thread) {
      tasks.push(
        ...this.tasksForThreadsByAccountId(threads, (accountThreads, accountId) => {
          const previousFolder = this.findPreviousFolder(currentPerspective, accountId);
          if (previousFolder) {
            return new ChangeFolderTask({
              previousFolder,
              folder: CategoryStore.getTrashCategory(accountId),
              threads: accountThreads,
              source,
            });
          } else {
            return new ChangeFolderTask({
              folder: CategoryStore.getTrashCategory(accountId),
              threads: accountThreads,
              source,
            });
          }
        })
      );
    }
    if (messages.length > 0 && messages[0] instanceof Message) {
      tasks.push(
        ...this.tasksForMessagesByAccount(messages, ({ accountId, messages }) => {
          return new ChangeFolderTask({
            folder: CategoryStore.getTrashCategory(accountId),
            messages: messages,
            source,
          });
        })
      );
    }
    return tasks;
  },
  tasksForExpungingThreadsOrMessages({ threads = [], messages = [], source }) {
    const tasks = [];
    if (threads.length > 0 && threads[0] instanceof Thread) {
      tasks.push(
        ...this.tasksForThreadsByAccountId(threads, (accountThreads, accountId) => {
          return new DeleteThreadsTask({
            accountId: accountId,
            threadIds: accountThreads.map(thread => thread.id),
            source,
          });
        })
      );
    }
    if (messages.length > 0 && messages[0] instanceof Message) {
      tasks.push(
        ...this.tasksForMessagesByAccount(messages, ({ accountId, messages }) => {
          const threadIds = new Set();
          const messageIds = [];
          messages.forEach(msg => {
            if (msg && msg.id) {
              messageIds.push(msg.id);
              if (msg.threadId) {
                threadIds.add(msg.threadId);
              }
            }
          });
          return new ExpungeMessagesTask({
            accountId: accountId,
            messageIds,
            threadIds: [...threadIds],
            source,
          });
        })
      );
    }
    return tasks;
  },
  tasksForDestroyingDraft({ messages = [], source = '' }) {
    const tasks = [];
    if (messages.length > 0 && messages[0] instanceof Message) {
      tasks.push(
        ...this.tasksForMessagesByAccount(messages, ({ accountId, messages }) => {
          return new DestroyDraftTask({
            accountId: accountId,
            messageIds: messages.map(msg => msg.id),
            source,
          });
        })
      );
    }
    return tasks;
  },
  tasksForCancellingOutboxDrafts({ messages = [], source = '' }) {
    const tasks = [];
    if (messages.length > 0 && messages[0] instanceof Message) {
      tasks.push(
        ...this.tasksForMessagesByAccount(messages, ({ accountId, messages }) => {
          const messageIds = [];
          messages.forEach(message => {
            messageIds.push(message.id);
          });
          return new CancelOutboxDraftTask({
            accountId: accountId,
            messageIds: messageIds,
            source,
          });
        })
      );
    }
    return tasks;
  },

  taskForInvertingUnread({ threads, source, canBeUndone }) {
    const unread = threads.every(t => t.unread === false);
    return new ChangeUnreadTask({ threads, unread, source, canBeUndone });
  },

  taskForSettingUnread({ threads, messages, unread, source, canBeUndone }) {
    const tasks = [];
    const threadsByAccount = this._splitByAccount(threads);
    const messagesByAccount = this._splitByAccount(messages);
    const accountIds = Object.keys(threadsByAccount);
    Object.keys(messagesByAccount).forEach(accountId => {
      if (!accountIds.includes(accountId)) {
        accountIds.push(accountId);
      }
    });
    accountIds.forEach(accId => {
      const threads = threadsByAccount[accId] || [];
      const messages = messagesByAccount[accId] || [];
      const t = new ChangeUnreadTask({
        threads,
        messages,
        unread,
        source,
        canBeUndone,
      });
      tasks.push(t);
    });

    return tasks;
  },
  taskForChangingAllToRead({ category, source }) {
    if (category && category.id) {
      return new ChangeAllUnreadTask({
        accountId: category.accountId,
        folderId: category.id,
        unread: false,
        source,
      });
    }
    return null;
  },

  taskForInvertingStarred({ threads, source }) {
    const starred = threads.every(t => t.starred === false);
    const threadsByFolder = this._splitByAccount(threads);
    const tasks = [];
    for (const accId in threadsByFolder) {
      const t = new ChangeStarredTask({ threads: threadsByFolder[accId], starred, source });
      tasks.push(t);
    }
    return tasks;
  },

  tasksForChangeFolder({ threads, source, folder, currentPerspective }) {
    return this.tasksForThreadsByAccountId(threads, (accountThreads, accountId) => {
      const previousFolder = this.findPreviousFolder(currentPerspective, accountId);
      return new ChangeFolderTask({
        previousFolder,
        folder,
        threads: accountThreads,
        source,
      });
    });
  },
  tasksForGeneralMoveFolder({ threads, source, targetCategory, sourceCategory, previousFolder }) {
    if (!Array.isArray(threads) || threads.length === 0) {
      AppEnv.reportError(
        new Error(`Move task by ${source} failed, no threads`),
        { errorData: threads },
        { grabLogs: true }
      );
      return [];
    }
    if (!targetCategory) {
      AppEnv.reportError(
        new Error(`Move task by ${source} failed, no target category`),
        { errorData: targetCategory },
        { grabLogs: true }
      );
      return [];
    }
    // if (!previousFolder) {
    //   AppEnv.reportError(new Error(`Move task by ${source} failed, no previous folder`), { errorData: previousFolder }, { grabLogs: true });
    //   return [];
    // }
    if (targetCategory.role === 'all' && sourceCategory && sourceCategory.isLabel()) {
      // dragging from a label into All Mail? Make this an "archive" by removing the
      // label. Otherwise (Since labels are subsets of All Mail) it'd have no effect.
      return [
        new ChangeLabelsTask({
          threads,
          source,
          labelsToAdd: [],
          labelsToRemove: [sourceCategory],
          previousFolder,
        }),
      ];
    }
    if (
      targetCategory.isLabel() &&
      sourceCategory &&
      sourceCategory.isLabel() &&
      (sourceCategory.role === 'important' || sourceCategory.role === 'flagged')
    ) {
      return [
        new ChangeLabelsTask({
          threads,
          source,
          labelsToAdd: [targetCategory],
          labelsToRemove: [],
          previousFolder,
        }),
      ];
    }
    if (targetCategory.isFolder()) {
      // dragging to a folder like spam, trash or any IMAP folder? Just change the folder.
      return [
        new ChangeFolderTask({
          threads,
          source,
          folder: targetCategory,
          previousFolder,
        }),
      ];
    }

    if (targetCategory.isLabel() && sourceCategory && sourceCategory.isFolder()) {
      // dragging from trash or spam into a label? We need to both apply the label and
      // move to the "All Mail" folder.
      if (sourceCategory.role === 'all') {
        return [
          new ChangeLabelsTask({
            threads,
            source,
            labelsToAdd: [targetCategory],
            labelsToRemove: [],
            previousFolder,
          }),
        ];
      }
      return [
        new ChangeFolderTask({
          threads,
          source,
          folder: targetCategory,
          previousFolder,
        }),
      ];
    }
    // label to label
    if (targetCategory.role === 'inbox') {
      return [
        new ChangeLabelsTask({
          threads,
          source,
          labelsToAdd: [targetCategory],
          labelsToRemove: [],
          previousFolder,
        }),
      ];
    }
    if (
      sourceCategory &&
      sourceCategory.isLabel() &&
      (sourceCategory.role === 'sent' || sourceCategory.role === 'drafts')
    ) {
      return [
        new ChangeLabelsTask({
          threads,
          source,
          labelsToAdd: [targetCategory],
          labelsToRemove: [],
          previousFolder,
        }),
      ];
    }
    return [
      new ChangeLabelsTask({
        threads,
        source,
        labelsToAdd: [targetCategory],
        labelsToRemove:
          sourceCategory && sourceCategory.isLabel() && sourceCategory.role !== 'sent'
            ? [sourceCategory]
            : [],
        previousFolder,
      }),
    ];
  },

  tasksForRenamingPath({ existingPath, newName, accountId, isExchange = false } = {}) {
    if (bannedPathNames.includes(newName)) {
      AppEnv.logWarning(`TaskFactory:Renaming folder ${newName} is in banned`);
      AppEnv.showMessageBox({
        title: 'Cannot rename',
        detail: `${newName} is a reserved path`,
        buttons: ['Ok'],
      });
      return;
    }
    const existingCategories = CategoryStore.categories(accountId);
    if (existingCategories.length > 0) {
      for (let i = 0; i < existingCategories.length; i++) {
        const displayName = existingCategories[i].fullDisplayName;
        if (displayName === newName) {
          AppEnv.logWarning(
            `TaskFactory:Renaming folder ${newName} is in conflict with existing folder ${displayName}`
          );
          AppEnv.showMessageBox({
            title: 'Cannot rename',
            detail: `${newName} already exists`,
            buttons: ['Ok'],
          });
          return;
        }
      }
    }
    return SyncbackCategoryTask.forRenaming({ path: existingPath, accountId, newName, isExchange });
  },
  tasksForCreatingPath({ name, accountId, bgColor = 0, parentId = '', isExchange = false }) {
    if (bannedPathNames.includes(name)) {
      AppEnv.logWarning(`TaskFactory:Creating folder ${name} is in banned`);
      AppEnv.showMessageBox({
        title: 'Cannot creatie',
        detail: `${name} is a reserved path`,
        buttons: ['Ok'],
      });
      return;
    }
    const existingCategories = CategoryStore.categories(accountId);
    if (existingCategories.length > 0) {
      for (let i = 0; i < existingCategories.length; i++) {
        const displayName = existingCategories[i].fullDisplayName;
        if (displayName === name) {
          AppEnv.logWarning(
            `TaskFactory:Creating folder ${name} is in conflict with existing folder ${displayName}`
          );
          AppEnv.showMessageBox({
            title: 'Cannot create',
            detail: `${name} already exists`,
            buttons: ['Ok'],
          });
          return;
        }
      }
    }
    return SyncbackCategoryTask.forCreating({ name, accountId, bgColor, parentId, isExchange });
  },
  taskForUpdatingContact({ newContact = {}, accountId, draft = {} } = {}) {
    if (!accountId && !newContact.accountId && !draft.accountId) {
      AppEnv.logError('No account info, taskForUpdatingContact ignored');
      return;
    }
    if (!newContact.name || !newContact.email) {
      AppEnv.logError('No name/email info, taskForUpdatingContact ignored');
      return;
    }
    accountId = accountId || draft.accountId || newContact.accountId;
    if (accountId) {
      return new ContactUpdateTask({ accountId, name: newContact.name, email: newContact.email });
    }
    return null;
  },

  taskForUndo({ task }) {
    if (!task.id || !task.accountId) {
      throw new Error('Task must have id and accountId');
    }
    return new UndoTask({ referenceTaskId: task.id, accountId: task.accountId });
  },

  tasksForMoveToOther(threads) {
    const tasks = [];
    const threadsByAccount = this._splitByAccount(threads);
    const accountIds = Object.keys(threadsByAccount);
    accountIds.forEach(accId => {
      const threadIds = (threadsByAccount[accId] || []).map(t => t.id);
      const t = new MakeOtherTask({ accountId: accId, threadIds: threadIds });
      tasks.push(t);
    });

    return tasks;
  },
  tasksForMoveToFocused(threads) {
    const tasks = [];
    const threadsByAccount = this._splitByAccount(threads);
    const accountIds = Object.keys(threadsByAccount);
    accountIds.forEach(accId => {
      const threadIds = (threadsByAccount[accId] || []).map(t => t.id);
      const t = new MakePrimaryTask({ accountId: accId, threadIds: threadIds });
      tasks.push(t);
    });

    return tasks;
  },

  findPreviousFolder(currentPerspective, accountId) {
    if (currentPerspective) {
      let previousFolder = currentPerspective.categories().find(cat => cat.accountId === accountId);
      const provider = currentPerspective.providerByAccountId(accountId);
      if (!provider) {
        AppEnv.reportError(new Error('no provider found'), {
          errorData: {
            currentPerspective: currentPerspective.toJSON(),
            accountId: accountId,
            previousFolder: previousFolder,
          },
        });
      } else if (provider.provider === 'gmail') {
        if (previousFolder && !['spam', 'trash', 'all'].includes(previousFolder.role)) {
          previousFolder = CategoryStore.getAllMailCategory(accountId);
        }
      }
      return previousFolder;
    }
    return null;
  },

  _splitByAccount(items) {
    const result = {};
    if (Array.isArray(items) && items.length > 0) {
      const accountIds = _.uniq(items.map(({ accountId }) => accountId));
      for (const accId of accountIds) {
        const itemsByAccount = items.filter(item => item.accountId === accId);
        // const arr = this._splitByFolder(threadsByAccount);
        result[accId] = itemsByAccount;
      }
    }
    return result;
  },
  _splitByFolder(threads) {
    const arr = [];
    const folderIds = _.uniq(
      threads.map(({ id, folders }) => {
        if (folders && folders.length > 0) {
          return folders[0].id;
        } else {
          AppEnv.reportWarning(new Error(`ThreadId: ${id} have no folder attribute`));
          return null;
        }
      })
    );
    for (const folderId of folderIds) {
      const threadGroup = threads.filter(({ folders }) => {
        if (folders && folders.length > 0 && folders[0].id === folderId) {
          return true;
        }
        return false;
      });
      arr.push(threadGroup);
    }
    return arr;
  },
};

export default TaskFactory;
