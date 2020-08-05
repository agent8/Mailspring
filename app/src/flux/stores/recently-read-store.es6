import MailspringStore from 'mailspring-store';
import ChangeUnreadTask from '../tasks/change-unread-task';
import ChangeLabelsTask from '../tasks/change-labels-task';
import ChangeFolderTask from '../tasks/change-folder-task';
import Actions from '../actions';

// The "Unread" view shows all threads which are unread. When you read a thread,
// it doesn't disappear until you leave the view and come back. This behavior
// is implemented by keeping track of messages being rea and manually
// whitelisting them in the query.
const isMessageView = AppEnv.isDisableThreading();
class RecentlyReadStore extends MailspringStore {
  constructor() {
    super();
    this.ids = [];
    this.listenTo(Actions.focusMailboxPerspective, () => {
      this.ids = [];
      this.trigger();
    });
    this.listenTo(Actions.queueTasks, tasks => {
      this.tasksQueued(tasks);
    });
    this.listenTo(Actions.queueTask, task => {
      this.tasksQueued([task]);
    });
  }

  tasksQueued(tasks) {
    let changed = false;
    let idKey = 'threadIds';
    if (isMessageView) {
      idKey = 'messageIds';
    }
    tasks
      .filter(task => task instanceof ChangeUnreadTask)
      .forEach(t => {
        this.ids = this.ids.concat(t[idKey]);
        changed = true;
      });

    tasks
      .filter(task => task instanceof ChangeLabelsTask || task instanceof ChangeFolderTask)
      .forEach(t => {
        this.ids = this.ids.filter(id => !t[idKey].includes(id));
        changed = true;
      });

    if (changed) {
      this.trigger();
    }
  }
}

const store = new RecentlyReadStore();
export default store;
