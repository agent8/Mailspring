import _ from 'underscore';
import {
  Thread,
  Actions,
  AccountStore,
  Message,
  SoundRegistry,
  NativeNotifications,
  DatabaseStore,
  ThreadStore,
  MuteNotificationStore,
} from 'mailspring-exports';

const WAIT_FOR_CHANGES_DELAY = 400;

export class Notifier {
  constructor() {
    this.activationTime = Date.now();
    this.unnotifiedQueue = [];
    this.hasScheduledNotify = false;

    this.activeNotifications = {};
    this.unlisteners = [DatabaseStore.listen(this._onDatabaseChanged, this)];
    this.notifiedMessageIds = {};
  }

  unlisten() {
    for (const unlisten of this.unlisteners) {
      unlisten();
    }
  }

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
    const notifworthy = {};

    for (const msg of msgs) {
      // ensure the message is unread
      if (msg.unread !== true) continue;
      // ensure the message was just created (eg: this is not a modification)
      if (msg.version !== 1) continue;
      // ensure the message was received after the app launched (eg: not syncing an old email)
      if (!msg.date || msg.date.valueOf() < this.activationTime) continue;
      // ensure the message is not a loopback
      const account = msg.from[0] && AccountStore.accountForEmail(msg.from[0].email);
      if (msg.accountId === (account || {}).id) continue;
      // // if snippet is empty, that means body is not pull over
      if (!msg.snippet) continue;
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
        return true;
      case 'Important':
        const isImportant = msg.labels.some(label => label.role === 'important');
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
    NativeNotifications.displayNotification({
      title: `${this.unnotifiedQueue.length} Unread Messages`,
      tag: 'unread-update',
      silent: !msgsSomeHasNoteSound,
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
      AppEnv.reportError(new Error(`Notifier._notifyOne duplicated message id: ${message.id}`));
      return;
    }

    this.notifiedMessageIds[message.id] = 1;
    const msgsSomeHasNoteSound = this._msgsSomeHasNoteSound([message]);
    const notification = NativeNotifications.displayNotification({
      title: title,
      subtitle: subtitle,
      body: body,
      canReply: true,
      tag: 'unread-update',
      silent: !msgsSomeHasNoteSound,
      onActivate: ({ response, activationType }) => {
        if (activationType === 'replied' && response && typeof response === 'string') {
          Actions.sendQuickReply({ thread, message }, response);
        } else {
          AppEnv.displayWindow();
        }

        if (!thread) {
          AppEnv.showErrorDialog(`Can't find that thread`);
          return;
        }
        Actions.ensureCategoryIsFocused('inbox', thread.accountId, true);
        Actions.setFocus({ collection: 'thread', item: thread });
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