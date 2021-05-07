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

  static FBHasInit() {
    return window.fbAsyncInit && window.fbAsyncInit.hasRun ? true : false;
  }

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

    if (this.FBHasInit() && window.FB) {
      window.FB.AppEvents.logEvent(eventName, null, params);
    }
  }

  static onTrackingEvent(eventName, params) {
    if (this.FBHasInit() && window.FB) {
      window.FB.AppEvents.logEvent(eventName, null, params);
    }
  }

  constructor({ devMode }) {
    this.devMode = devMode;
  }

  trackingTask = task => {
    console.log('****tracking task');
    // if (this.devMode || (AppEnv && AppEnv.config.get('core.workspace.sendUsageData') === false)) {
    //   return;
    // }
    // try {
    //   TrackingAppEvents.onQueueTask(task);
    // } catch (e) {
    //   console.error('TrackingAppEvents.trackingTask', e);
    // }
  };

  trackingEvent = (...args) => {
    console.log('****tracking event');
    // if (this.devMode || (AppEnv && AppEnv.config.get('core.workspace.sendUsageData') === false)) {
    //   return;
    // }
    // try {
    //   TrackingAppEvents.onTrackingEvent(...args);
    // } catch (e) {
    //   console.error('TrackingAppEvents.trackingEvent', e);
    // }
  };
}
