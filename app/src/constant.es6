export const OAuthList = [
  'gmail',
  'yahoo',
  'outlook',
  'hotmail',
  'office365-exchange',
  'jira-plugin',
];

export function macOSVersion() {
  let userAgent;
  if (process.type === 'renderer') {
    userAgent = navigator.userAgent || '';
  } else {
    const { session } = require('electron');
    const ses = session.defaultSession;
    userAgent = ses.getUserAgent() || '';
  }

  const macOSVersionGroup = userAgent.match(/.*(10_\d{1,2}_\d{1,2}).*/);
  const macOSVersionInUA = macOSVersionGroup && macOSVersionGroup[1] ? macOSVersionGroup[1] : '';

  return macOSVersionInUA.replace(/_/g, '.');
}

export function appStoreLink() {
  const secondVersion = Number(macOSVersion().split('.')[1]) || 11;
  return `${secondVersion < 14 ? 'https' : 'itms-apps'}://apps.apple.com/app/id1489591003`;
}

export const UserReviewText = '♥ Love it? Let us know.';
export const UserReviewUrl = `${appStoreLink()}?action=write-review`;

export const UserUseAppDaysHappyLine = 7;

export const ServerInfoPriorityEnum = {
  // 紧急的通知，需要退出app
  Extraordinary: 1,
  // 更新提示
  UpdateNotif: 2,
  // 普通消息
  AverageInfo: 3,
  // 版本更新后的what's new
  UpdateInfo: 4,
};
