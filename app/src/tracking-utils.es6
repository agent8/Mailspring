import { initializeApp } from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';

const app = initializeApp({
  apiKey: 'AIzaSyB7kPPZ0RlvZkBxMI8yWNF_EwfycQSoTmk',
  authDomain: 'edisonmail-b8a62.firebaseapp.com',
  projectId: 'edisonmail-b8a62',
  storageBucket: 'edisonmail-b8a62.appspot.com',
  messagingSenderId: '906846438860',
  appId: '1:906846438860:web:a938c956347432803f8969',
  measurementId: 'G-D35EV8GDPH',
});
const inst = getAnalytics(app);
console.log('*****app', app, inst);

export default class TrackingAppEvents {
  static trackingTasks = [
    'ChangeUnreadTask',
    'ChangeStarredTask',
    'ChangeFolderTask',
    'ChangeLabelsTask',
    'DeleteThreadsTask',
    // 'SyncbackDraftTask',
    'DestroyDraftTask',
    'SendDraftTask',
    // 'SyncbackCategoryTask',
    'DestroyCategoryTask',
    'ExpungeAllInFolderTask',
    'GetMessageRFC2822Task',
    'UndoTask',
    'ChangeRoleMappingTask',
    // 'AnalyzeDBTask',
    'CalendarTask',
    'ExpungeMessagesTask',
    'ChangeDraftToFailingTask',
    'CancelOutboxDraftTask',
  ];
  static sourceMap = {
    'Toolbar Button: Thread List': task => {
      return task.folder && task.folder.role ? `-${task.folder.role}` : '';
    },
    Swipe: () => '-Swipe',
    'Important Icon': () => '-ImportantIcon',
  };

  static onQueueTask(task) {
    const taskName = task.constructor.name;
    if (!taskName || !this.trackingTasks.includes(taskName)) {
      return;
    }
    let eventName = taskName.replace(/Task$/g, '');
    const source = task.source;
    const dealFuncName = this.sourceMap[source];
    if (dealFuncName && typeof dealFuncName === 'function') {
      eventName = `${eventName}${dealFuncName(task)}`;
    }
    const params = {
      source: task.source,
    };
    console.log('*****logEvent - 1', eventName, params);
    logEvent(inst, eventName, params);
  }

  static onTrackingEvent(eventName, params) {
    console.log('*****logEvent - 2', eventName, params);
    logEvent(inst, eventName, params);
  }

  constructor({ devMode }) {
    this.devMode = devMode;
  }

  trackingTask = task => {
    // if (this.devMode || (AppEnv && AppEnv.config.get('core.workspace.sendUsageData') === false)) {
    //   return;
    // }
    try {
      TrackingAppEvents.onQueueTask(task);
    } catch (e) {
      console.error('TrackingAppEvents.trackingTask', e);
    }
  };

  trackingEvent = (...args) => {
    // if (this.devMode || (AppEnv && AppEnv.config.get('core.workspace.sendUsageData') === false)) {
    //   return;
    // }
    try {
      TrackingAppEvents.onTrackingEvent(...args);
    } catch (e) {
      console.error('TrackingAppEvents.trackingEvent', e);
    }
  };
}
