import MailspringStore from 'mailspring-store';
import Actions from '../actions';

const messageBlock = {
  id: 'online-offline',
  description: 'Edison Mail is offline. Please check your network connection.',
  icon: 'no-network.svg',
  delayDuration: 0,
  allowClose: true,
  priority: 0,
  actions: [],
};

class OnlineStatusStore extends MailspringStore {
  constructor() {
    super();
    this._online = navigator.onLine;
    if (AppEnv.isMainWindow()) {
      window.addEventListener('online', this._onlineStatusChange);
      window.addEventListener('offline', this._onlineStatusChange);
      //DC-2754 If app start up on system boot, our online status might be incorrect.
      // Thus we delay status check for a bit
      setTimeout(this._statusCheckOnStartUp, 15000);
    }
  }

  _statusCheckOnStartUp = () => {
    if (navigator.onLine !== this._online) {
      this._onlineStatusChange();
    }
  };

  _onlineStatusChange = () => {
    const previousStatus = this._online;
    this._online = navigator.onLine;
    if (previousStatus !== this._online) {
      if (this._online) {
        Actions.removeAppMessage(messageBlock);
      } else {
        Actions.pushAppMessage(messageBlock);
      }
    }
    this.trigger({
      onlineDidChange: true,
      wakingFromSleep: !previousStatus,
    });
  };

  isOnline() {
    return this._online;
  }
}

export default new OnlineStatusStore();
