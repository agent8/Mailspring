import { ipcRenderer } from 'electron';
const _getDefalutMailsyncSettings = () => {
  return (
    AppEnv.config.get('core.mailsync') || {
      fetchEmailRange: 365,
      fetchEmailInterval: 1,
    }
  );
};
export const UpdateMailSyncSettings = ({ value, key, accountIds = [] }) => {
  if (accountIds.length === 0) {
    return null;
  }
  const defalutMailsyncSettings = _getDefalutMailsyncSettings();
  let mailsyncSettings = AppEnv.config.get('core.mailsync.accounts');
  if (defalutMailsyncSettings && !mailsyncSettings) {
    accountIds.forEach(accountId => {
      mailsyncSettings[accountId] = defalutMailsyncSettings;
    });
  }
  delete mailsyncSettings.accounts;
  const tmp = {};
  tmp[key] = value;
  const data = {};
  accountIds.forEach(accountId => {
    const newSettings = Object.assign({}, mailsyncSettings[accountId], tmp);
    data[accountId] = newSettings;
  });
  ipcRenderer.send('mailsync-config', data);
  return data;
};
