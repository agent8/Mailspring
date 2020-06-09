import MailspringStore from 'mailspring-store';
import ChangeUnreadTask from '../tasks/change-unread-task';
import ChangeLabelsTask from '../tasks/change-labels-task';
import ChangeFolderTask from '../tasks/change-folder-task';
import MakeOtherTask from '../tasks/make-other-task';
import MakePrimaryTask from '../tasks/make-primary-task';
import Category from '../models/category';
import Actions from '../actions';

// The "Unread" view shows all threads which are unread. When you read a thread,
// it doesn't disappear until you leave the view and come back. This behavior
// is implemented by keeping track of messages being rea and manually
// whitelisting them in the query.

class RecentlyReadStore extends MailspringStore {
  constructor() {
    super();
    this.inboxCategories = [];
    this.listenTo(Actions.focusMailboxPerspective, () => {
      this.inboxCategories = [];
      this.trigger();
    });
    this.listenTo(Actions.queueTasks, tasks => {
      this.tasksQueued(tasks);
    });
    this.listenTo(Actions.queueTask, task => {
      this.tasksQueued([task]);
    });
  }
  ids(categories = 'all') {
    const ret = [];
    this.inboxCategories.forEach(item => {
      if (item && item.type === 'thread') {
        if (categories === 'all') {
          ret.push(item.id);
        } else {
          if (categories.includes(item.inboxCategory)) {
            ret.push(item.id);
          }
        }
      }
    });
    return ret;
  }

  tasksQueued(tasks) {
    let changed = false;

    tasks
      .filter(task => task instanceof ChangeUnreadTask)
      .forEach(({ inboxCategories }) => {
        this.inboxCategories = this.inboxCategories.concat(inboxCategories);
        changed = true;
      });
    tasks.forEach(task => {
      if (task instanceof MakeOtherTask) {
        task.effectedThreadIds.forEach(threadId => {
          this.inboxCategories.forEach(item => {
            if (item && item.type === 'thread' && item.id === threadId) {
              item.inboxCategory = `${Category.InboxCategoryState.MsgOther}`;
              changed = true;
            }
          });
        });
      } else if (task instanceof MakePrimaryTask) {
        task.effectedThreadIds.forEach(threadId => {
          this.inboxCategories.forEach(item => {
            if (item && item.type === 'thread' && item.id === threadId) {
              item.inboxCategory = `${Category.InboxCategoryState.MsgPrimary}`;
              changed = true;
            }
          });
        });
      }
    });

    tasks
      .filter(task => task instanceof ChangeLabelsTask || task instanceof ChangeFolderTask)
      .forEach(({ inboxCategories }) => {
        this.inboxCategories = this.inboxCategories.filter(item => {
          const ids = inboxCategories.map(inboxCat => inboxCat.id);
          return !ids.includes(item.id);
        });
        changed = true;
      });

    if (changed) {
      this.trigger();
    }
  }
}

const store = new RecentlyReadStore();
export default store;
