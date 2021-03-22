export const DROP_DATA_TYPE = {
  THREAD: 'edison-threads-data',
  FOLDER_TREE_ITEM: 'edison-folder-tree-item-data',
};
export const QUERY_TYPE = {
  BACKGROUND: 'BACKGROUND',
  SEARCH_PERSPECTIVE: 'SEARCH_PERSPECTIVE',
  SEARCH_SUBJECT: 'SEARCH_SUBJECT',
  VACUUM: 'VACUUM',
};
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
  Migrating: 6,
  BugReporting: 5,
  OnBoarding: 4,
  Composer: 3,
  Thread: 2,
  Main: 1,
};
export const Composer = {
  defaultFontSize: '14px',
  defaultFontFamily: 'sans-serif',
};
export const AutoUpdateManagerState = {
  IdleState: 'idle',
  CheckingState: 'checking',
  DownloadingState: 'downloading',
  AvailableForDownload: 'available-for-download',
  UpdateAvailableState: 'update-available',
  NoUpdateAvailableState: 'no-update-available',
  UnsupportedState: 'unsupported',
  ErrorState: 'error',
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

export const EdisonPlatformType = {
  IOS: 'ios',
  ANDROID: 'android',
  MAC: 'mac',
  COMMON: 'common',
};

export function generateServerConfigKey(configKey) {
  return configKey.toLowerCase().replace(/\./g, '_');
}

export const EdisonPreferencesType = {
  LIST: 'list',
  STRING: 'string',
};

export const UpdateSettingCode = {
  Conflict: 10008,
  Success: 0,
};

export const UpdateToServerSimpleSettingTypes = ['number', 'string', 'integer', 'boolean'];
export const UpdateToServerComplexSettingTypes = ['object', 'array'];

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

function decrypt(ciphertext) {
  const CryptoJS = require('crypto-js');
  const E_KEY = 'EDISON_MAIL';
  var bytes = CryptoJS.AES.decrypt(ciphertext, E_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

export const AwsBucketStag = 'edison-media-stag';
export const AwsBucketProd = 'edison-media';
export const AwsRegionType = process.env.S3_REGION || 'ENV_S3_REGION';
export const AwsEndpointUrl = 'https://s3.us-east-2.amazonaws.com';
export const AWSAccessKey = decrypt(process.env.S3_ACCESSKEY_ID || 'ENV_S3_ACCESSKEY_ID');
export const AWSSecretKey = decrypt(process.env.S3_SECRET_ACCESSKEY || 'ENV_S3_SECRET_ACCESSKEY');

export const INVALID_TEMPLATE_NAME_REGEX = /[^\w\-\u00C0-\u017F\u4e00-\u9fa5 ]+/g;

export const PreferencesSubListStateEnum = {
  deleted: -1,
  updated: 1,
  synchronized: 0,
};

export const MailcoreReturnCodeEnum = [
  'ErrorNone', // 0
  'ErrorConnection',
  'ErrorTLSNotAvailable',
  'ErrorParse',
  'ErrorCertificate',
  'ErrorAuthentication',
  'ErrorGmailIMAPNotEnabled',
  'ErrorGmailExceededBandwidthLimit',
  'ErrorGmailTooManySimultaneousConnections',
  'ErrorMobileMeMoved',
  'ErrorYahooUnavailable', // 10
  'ErrorNonExistantFolder',
  'ErrorRename',
  'ErrorDelete',
  'ErrorCreate',
  'ErrorSubscribe',
  'ErrorAppend',
  'ErrorCopy',
  'ErrorExpunge',
  'ErrorFetch',
  'ErrorIdle', // 20
  'ErrorIdentity',
  'ErrorNamespace',
  'ErrorStore',
  'ErrorCapability',
  'ErrorStartTLSNotAvailable',
  'ErrorSendMessageIllegalAttachment',
  'ErrorStorageLimit',
  'ErrorSendMessageNotAllowed',
  'ErrorNeedsConnectToWebmail',
  'ErrorSendMessage', // 30
  'ErrorAuthenticationRequired',
  'ErrorFetchMessageList',
  'ErrorDeleteMessage',
  'ErrorInvalidAccount',
  'ErrorFile',
  'ErrorCompression',
  'ErrorNoSender',
  'ErrorNoRecipient',
  'ErrorNoop',
  'ErrorGmailApplicationSpecificPasswordRequired', // 40
  'ErrorServerDate',
  'ErrorNoValidServerFound',
  'ErrorCustomCommand',
  'ErrorYahooSendMessageSpamSuspected',
  'ErrorYahooSendMessageDailyLimitExceeded',
  'ErrorOutlookLoginViaWebBrowser',
  'ErrorTiscaliSimplePassword',
];
