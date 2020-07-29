import electron from 'electron';
import { NativeNotifications } from 'mailspring-exports';

const { dialog } = electron.remote;
export const getBrowserWindow = () => electron.remote.getCurrentWindow();

export const postNotification = (title, body, onActivate = () => {}) => {
  return NativeNotifications.displayNotification({
    title: title,
    subtitle: body,
    tag: 'chat-message',
    onActivate: ({ activationType }) => {
      onActivate(activationType);
      AppEnv.displayWindow();
    },
  });
};

export const alert = message => {
  AppEnv.showMessageBox({
    type: 'warning',
    message,
    buttons: ['OK'],
  });
};
