/* eslint global-require: 0 */
import { remote } from 'electron';
class NativeNotifications {
  constructor() {
    this._notificationsByTag = {};
    // AppEnv.onBeforeUnload(() => {
    //   Object.keys(this._notificationsByTag).forEach(key => {
    //     const notif = this._notificationsByTag[key];
    //     if (notif && !notif.isDestroyed()) {
    //       notif.close();
    //     }
    //   });
    //   return true;
    // });
  }
  displayNotification({ title, subtitle, body, tag, canReply, onActivate = () => { } } = {}) {
    let notif = null;
    if (tag && this._notificationsByTag[tag]) {
      this._notificationsByTag[tag].close();
    }
    notif = remote.getGlobal('application').getNotification({
      title,
      // bundleId: 'com.edisonmail.edisonmail',
      hasReply: canReply,
      subtitle: subtitle,
      body: body,
      silent: !AppEnv.config.get('core.notifications.sounds'),
    });
    notif.show();
    notif.on('reply', (event, response) => {
      onActivate({ response, activationType: 'replied' });
    });
    notif.on('click', () => {
      onActivate({ response: null, activationType: 'clicked' });
    });
    if (tag) {
      this._notificationsByTag[tag] = notif;
    }
    return notif;
  }
}

export default new NativeNotifications();
