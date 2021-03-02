import _ from 'underscore';
import {
  Thread,
  Actions,
  AccountStore,
  Message,
  Category,
  SoundRegistry,
  NativeNotifications,
  DatabaseStore,
  ThreadStore,
  MuteNotificationStore,
  TaskFactory,
  BlockContactTask,
} from 'mailspring-exports';

const WAIT_FOR_CHANGES_DELAY = 400;
const NOTIFI_ACTIONS = [
  { type: 'button', text: 'Reply', value: 'reply' },
  { type: 'button', text: 'Mark as Read', value: 'mark_as_read' },
  { type: 'button', text: 'Trash', value: 'trash' },
  { type: 'button', text: 'Archive', value: 'archive' },
  { type: 'button', text: 'Block', value: 'block' },
];
class ActivationTime {
  constructor() {
    this.appTime = Date.now();
    this.accounts = {};
  }
  updateTimeForAccount = (accountId, timestamp) => {
    if (timestamp > this.appTime) {
      this.accounts[accountId] = timestamp;
    } else {
      this.accounts[accountId] = this.appTime;
    }
  };
  timeForAccount = accountId => {
    if (this.accounts[accountId]) {
      return this.accounts[accountId];
    } else {
      return this.appTime;
    }
  };
}

export class Notifier {
  constructor() {
    this.activationTime = new ActivationTime();
    this.unnotifiedQueue = [];
    this.hasScheduledNotify = false;

    this.activeNotifications = {};
    this.unlisteners = [
      DatabaseStore.listen(this._onDatabaseChanged, this),
      AccountStore.listen(this._onAccountsChange),
    ];
    this.notifiedMessageIds = {};
  }

  unlisten() {
    for (const unlisten of this.unlisteners) {
      unlisten();
    }
  }
  _onAccountsChange = () => {
    const accounts = AccountStore.accounts();
    if (Array.isArray(accounts)) {
      accounts.forEach(account => {
        if (account) {
          this.activationTime.updateTimeForAccount(account.id, account.lastVerified);
        }
      });
    }
  };

  // async for testing
  async _onDatabaseChanged({ objectClass, objects }) {
    if (objectClass === Thread.name) {
      return this._onThreadsChanged(objects);
    }

    if (objectClass === Message.name) {
      return this._onMessagesChanged(objects);
    }
  }

  // async for testing
  async _onMessagesChanged(msgs) {
    const enableFocusedInboxKey = AppEnv.config.get('core.workspace.enableFocusedInbox');
    const notifworthy = {};

    for (const msg of msgs) {
      // ensure the message is unread
      if (msg.unread !== true) continue;
      // ensure the message was just created (eg: this is not a modification)
      if (msg.version !== 1) continue;
      // ensure the message was received after the app launched (eg: not syncing an old email)
      if (
        !msg.date ||
        msg.date.valueOf() < this.activationTime.timeForAccount(msg.accountId || msg.aid)
      )
        continue;
      // ensure the message is not a loopback
      const account = msg.from[0] && AccountStore.accountForEmail(msg.from[0].email);
      if (msg.accountId === (account || {}).id) continue;
      // if body is not pull over
      if (!msg.hasBody) continue;
      // if is Other and the noticeType is 'Focused Inbox', don't display notification
      // if enableFocusedInbox, the noticeType 'All' means 'Focused Inbox'
      const myAccount = AccountStore.accountForId(msg.accountId);
      const { noticeType } = myAccount.notifacation;
      if (
        enableFocusedInboxKey &&
        noticeType === 'All' &&
        msg.inboxCategory === Category.InboxCategoryState.MsgOther
      ) {
        continue;
      }
      // filter the message that dont should note by account config
      if (!this._msgShouldNotify(msg)) continue;

      notifworthy[msg.id] = msg;
    }

    if (Object.keys(notifworthy).length === 0) {
      return;
    }

    if (!AppEnv.inSpecMode()) {
      await new Promise(resolve => {
        // wait a couple hundred milliseconds and collect any updates to these
        // new messages. This gets us message bodies, messages impacted by mail rules, etc.
        // while ensuring notifications are never too delayed.
        const unlisten = DatabaseStore.listen(({ objectClass, objects }) => {
          if (objectClass !== Message.name) {
            return;
          }
          for (const msg of objects) {
            if (notifworthy[msg.id]) {
              notifworthy[msg.id] = msg;
              if (msg.unread === false) {
                delete notifworthy[msg.id];
              }
            }
          }
        });
        setTimeout(() => {
          unlisten();
          resolve();
        }, WAIT_FOR_CHANGES_DELAY);
      });
    }

    await this._onNewMessagesReceived(Object.values(notifworthy));
  }

  _onThreadsChanged(threadsMessage) {
    // Ensure notifications are dismissed when the user reads a thread
    const threadIds = threadsMessage.map(({ id }) => {
      return id;
    });
    ThreadStore.findAllByThreadIds({ threadIds }).then(threads => {
      threads.forEach(({ id, unread }) => {
        if (!unread && this.activeNotifications[id]) {
          // this.activeNotifications[id].forEach(n => n.close());
          delete this.activeNotifications[id];
        }
      });
    });
  }

  _msgShouldNotify(msg) {
    const myAccountId = msg.accountId;
    const myAccount = AccountStore.accountForId(myAccountId);
    const fromEmail = (msg.from[0] && msg.from[0].email) || '';

    const isMutedDomain = MuteNotificationStore.isMutedDomainByAccount(myAccountId, fromEmail);
    if (isMutedDomain) {
      return false;
    }

    const isMuted = MuteNotificationStore.isMuteByAccount(myAccountId, fromEmail);
    if (isMuted) {
      return false;
    }

    const { noticeType } = myAccount.notifacation;

    switch (noticeType) {
      case 'None':
        return false;
      case 'All':
      case 'All_include_other':
        var isInbox =
          (msg.XGMLabels && msg.XGMLabels.some(label => label === '\\Inbox')) ||
          msg.labels.some(label => label.role === 'inbox'); // for Gmail we check the XGMLabels, for other providers's label role
        return isInbox;
      case 'Important':
        var isImportant = msg.XGMLabels && msg.XGMLabels.some(label => label === '\\Important');
        return isImportant;
      default:
        return true;
    }
  }

  _msgsSomeHasNoteSound(msgs) {
    const accountIds = new Set();
    msgs.forEach(msg => {
      accountIds.add(msg.accountId);
    });
    const msgsSomeHasNoteSound = [...accountIds].some(id => {
      const account = AccountStore.accountForId(id);
      const { sound } = account.notifacation;
      return sound;
    });
    return msgsSomeHasNoteSound;
  }

  _notifyAll() {
    const messageList = this.unnotifiedQueue.map(queue => queue.message);
    const msgsSomeHasNoteSound = this._msgsSomeHasNoteSound(messageList);
    if (msgsSomeHasNoteSound) {
      this._playNewMailSound();
    }
    NativeNotifications.displayNotification({
      title: `${this.unnotifiedQueue.length} Unread Messages`,
      tag: 'unread-update',
      silent: true,
      onActivate: () => {
        AppEnv.displayWindow();
      },
    });

    this.unnotifiedQueue = [];
  }

  _notifyOne({ message, thread }) {
    const from = message.from[0] ? message.from[0].displayName() : 'Unknown';
    const title = from;
    let subtitle = null;
    let body = null;
    if (message.subject && message.subject.length > 0) {
      subtitle = message.subject;
      body = message.snippet;
    } else {
      subtitle = message.snippet;
      body = null;
    }

    if (this.notifiedMessageIds[message.id]) {
      console.warn(`Notifier._notifyOne duplicated message id: ${message.id}`);
      // AppEnv.reportError(new Error(`Notifier._notifyOne duplicated message id: ${message.id}`));
      return;
    }

    this.notifiedMessageIds[message.id] = 1;
    const msgsSomeHasNoteSound = this._msgsSomeHasNoteSound([message]);
    if (msgsSomeHasNoteSound) {
      this._playNewMailSound();
    }
    const notification = NativeNotifications.displayNotification({
      title: title,
      subtitle: subtitle,
      body: body,
      canReply: true,
      tag: 'unread-update',
      silent: true,
      actions: NOTIFI_ACTIONS,
      onActivate: ({ response, activationType }) => {
        if (activationType === 'replied' && response && typeof response === 'string') {
          Actions.sendQuickReply({ thread, message }, response);
          // DC-2078:Should not open email detail after reply from notification
          return;
        } else {
          if (activationType && activationType !== 'clicked') {
            // { type: 'button', text: 'Mark as Read', value: 'mark_as_read' },
            // { type: 'button', text: 'Trash', value: 'trash' },
            // { type: 'button', text: 'Archive', value: 'archive' },
            // { type: 'button', text: 'Block', value: 'block' },
            switch (activationType) {
              case 'mark_as_read':
                Actions.queueTasks(
                  TaskFactory.taskForSettingUnread({
                    threads: [thread],
                    unread: false,
                    source: 'Notification mark as read',
                  })
                );
                break;
              case 'trash':
                Actions.queueTasks(
                  TaskFactory.tasksForMovingToTrash({
                    messages: [message],
                    source: 'Notification trash',
                  })
                );
                break;
              case 'archive':
                Actions.queueTasks(
                  TaskFactory.tasksForArchiving({
                    threads: [thread],
                    source: 'Notification archive',
                  })
                );
                break;
              case 'block':
                var fromEmail = message.from[0] && message.from[0].email;
                if (fromEmail) {
                  Actions.queueTask(
                    new BlockContactTask({ accountId: message.accountId, email: fromEmail })
                  );
                }
                break;
              default:
                return;
            }
            return;
          }

          AppEnv.displayWindow();
        }

        if (!thread) {
          AppEnv.showErrorDialog(`Can't find that thread`);
          return;
        }
        Actions.ensureCategoryIsFocused('inbox', thread.accountId, true);
        // DC-2073: Fail to open email from notification when read panel off
        setImmediate(() =>
          Actions.setFocus({
            collection: 'thread',
            item: thread,
            reason: 'UnreadNotification:onActivate',
          })
        );
      },
    });

    if (!this.activeNotifications[thread.id]) {
      this.activeNotifications[thread.id] = [notification];
    } else {
      this.activeNotifications[thread.id].push(notification);
    }
  }

  _notifyMessages() {
    if (this.unnotifiedQueue.length >= 5) {
      this._notifyAll();
    } else if (this.unnotifiedQueue.length > 0) {
      this._notifyOne(this.unnotifiedQueue.shift());
    }

    this.hasScheduledNotify = false;
    if (this.unnotifiedQueue.length > 0) {
      setTimeout(() => this._notifyMessages(), 2000);
      this.hasScheduledNotify = true;
    }
  }

  _playNewMailSound = _.debounce(() => SoundRegistry.playSound('new-mail'), 5000, true);

  _onNewMessagesReceived(newMessages) {
    if (newMessages.length === 0) {
      return Promise.resolve();
    }

    // For each message, find it's corresponding thread. First, look to see
    // if it's already in the `incoming` payload (sent via delta sync
    // at the same time as the message.) If it's not, try loading it from
    // the local cache.

    const threadIds = {};
    for (const { threadId } of newMessages) {
      threadIds[threadId] = true;
    }

    // TODO: Use xGMLabels + folder on message to identify which ones
    // are in the inbox to avoid needing threads here.
    return DatabaseStore.findAll(Thread, Thread.attributes.id.in(Object.keys(threadIds))).then(
      threadsArray => {
        const threads = {};
        for (const t of threadsArray) {
          threads[t.id] = t;
        }

        // Filter new messages to just the ones in the inbox
        const newMessagesInInbox = newMessages.filter(({ labels }) => {
          if (!labels || !labels.length) {
            return false;
          }
          return labels.some(
            folder => folder && folder.role && (folder.role === 'inbox' || folder.role === 'all')
          );
        });

        if (newMessagesInInbox.length === 0) {
          return;
        }

        for (const msg of newMessagesInInbox) {
          this.unnotifiedQueue.push({ message: msg, thread: threads[msg.threadId] });
        }

        if (!this.hasScheduledNotify) {
          this._notifyMessages();
        }
      }
    );
  }
}

export const config = {
  enabled: {
    type: 'boolean',
    default: true,
  },
};

export function activate() {
  this.notifier = new Notifier();
}

export function deactivate() {
  this.notifier.unlisten();
}
