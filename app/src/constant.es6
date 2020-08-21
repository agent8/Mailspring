export const OAuthList = [
  'gmail',
  'yahoo',
  'outlook',
  'hotmail',
  'office365-exchange',
  'jira-plugin',
];
export const showCC = 'cc';
export const showCCAndBCC = 'cc+bcc';
export const MS_TNEF_TYPES = ['application/ms-tnef', 'application/vnd.ms-tnef'];
export function DisableAttachmentProgressProvider(provider) {
  return provider.includes('exchange');
}
export const WindowLevel = {
  BugReporting: 5,
  OnBoarding: 4,
  Composer: 3,
  Thread: 2,
  Main: 1,
};

export const bannedPathNames = ['Trash', 'Spam', 'Inbox', 'All Mail', 'Sent'];

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

export const AttachmentDownloadState = {
  fail: -1,
  downloading: 0,
  done: 1,
};
export const FileState = {
  Normal: 0,
  Removed: 1,
  IgnoreMissing: 2,
};
export const AttachmentFileSizeIgnoreThreshold = 4; //4 Bytes;

export const InboxCategoryStates = {
  MsgNone: -1, //message not in INBOX
  MsgOther: 0,
  MsgCandidate: 1,
  MsgPrimary: 2,
  MsgPrimaryAndOther: 3,
};

export const allInboxCategories = (opts = { toString: false, radix: 10 }) => {
  if (!opts) {
    opts = { toString: false, radix: 10 };
  }
  let { toString, radix } = opts;
  if (!radix) {
    radix = 10;
  }
  const ret = Object.values(InboxCategoryStates);
  if (!toString) {
    return ret;
  } else {
    return ret.map(item => item.toString(radix));
  }
};

export const inboxFocusedCategories = (strict = false, opts = { toString: false, radix: 10 }) => {
  if (!opts) {
    opts = { toString: false, radix: 10 };
  }
  let { toString, radix } = opts;
  if (!radix) {
    radix = 10;
  }
  const ret = [InboxCategoryStates.MsgCandidate, InboxCategoryStates.MsgPrimary];
  if (!strict) {
    ret.push(InboxCategoryStates.MsgPrimaryAndOther);
  }
  if (!toString) {
    return ret;
  }
  return ret.map(i => i.toString(radix));
};

export const inboxOtherCategories = (strict = false, opts = { toString: false, radix: 10 }) => {
  if (!opts) {
    opts = { toString: false, radix: 10 };
  }
  let { toString, radix } = opts;
  if (!radix) {
    radix = 10;
  }
  const ret = [InboxCategoryStates.MsgOther];
  if (!strict) {
    ret.push(InboxCategoryStates.MsgPrimaryAndOther);
  }
  if (!toString) {
    return ret;
  }
  return ret.map(i => i.toString(radix));
};

export const inboxNotOtherCategories = (opts = { toString: false, radix: 10 }) => {
  if (!opts) {
    opts = { toString: false, radix: 10 };
  }
  let { toString, radix } = opts;
  if (!radix) {
    radix = 10;
  }
  const isStrictOtherCategories = inboxOtherCategories(true, { toString: false, radix });
  const ret = [];
  Object.values(InboxCategoryStates).forEach(item => {
    if (!isStrictOtherCategories.some(other => item === other)) {
      if (toString) {
        ret.push(item.toString(radix));
      } else {
        ret.push(item);
      }
    }
  });
  return ret;
};
