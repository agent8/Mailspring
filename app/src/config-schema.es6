import { RetinaImg } from 'mailspring-component-kit';
import React from 'react';
import moment from 'moment';
import {
  mergeLocalSignaturesToServer,
  mergeServerSignaturesToLocal,
  mergeLocalTemplatesToServer,
  mergeServerTemplatesToLocal,
  mergeLocalAccountsToServer,
  mergeServerAccountsToLocal,
  mergeLocalDefaultSignaturesToServer,
  mergeServerDefaultSignaturesToLocal,
} from './sync-preferences';

moment.locale(navigator.language);
// get the default date format like 'MM/DD/YYYY'、'DD/MM/YYYY'
const defaultDateFormat = moment.localeData().longDateFormat('L');
const dateFormatOption = ['MM/DD/YY', 'DD/MM/YY'];
const defaultDateFormatOption = dateFormatOption.includes(defaultDateFormat.replace('YYYY', 'YY'))
  ? defaultDateFormat.replace('YYYY', 'YY')
  : dateFormatOption[0];

function actionOption(iconName, label) {
  return (
    <span>
      <RetinaImg
        name={`${iconName}.svg`}
        style={{ width: 24, height: 24, fontSize: 24 }}
        className={`color_${iconName}`}
        isIcon
        mode={RetinaImg.Mode.ContentIsMask}
      />
      {label}
    </span>
  );
}
const actionValues = ['', 'archive', 'trash', 'flag', 'read', 'folder'];
const actionLabels = [
  actionOption('none', 'None'),
  actionOption('archive', 'Archive'),
  actionOption('trash', 'Trash'),
  actionOption('flag', 'Flag'),
  actionOption('read', 'Mark Read/Unread'),
  actionOption('folder', 'Move to Folder'),
];
const emailActionValues = [...actionValues, 'spam', 'print'];
const emailActionLabels = [
  ...actionLabels,
  actionOption('spam', 'Mark as Spam'),
  actionOption('print', 'Print Thread/Message'),
];

export default {
  core: {
    type: 'object',
    properties: {
      sync: {
        type: 'object',
        properties: {
          verboseUntil: {
            type: 'number',
            default: 0,
            title: 'Enable verbose IMAP / SMTP logging',
          },
        },
      },
      support: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            default: '',
            title: 'Support Id',
          },
        },
      },
      mailsync: {
        type: 'object',
        properties: {
          fetchEmailRange: {
            type: 'integer',
            default: 365,
            syncToServer: true,
            enum: [7, 30, 90, 365, -1],
            enumLabels: [
              'Within 7 Days',
              'Within 30 days',
              'Within 3 Month',
              'Within a Year',
              'All',
            ],
            title: 'Sync mail as far back as',
          },
          fetchEmailInterval: {
            type: 'integer',
            default: 1,
            enum: [1, 3, 5],
            enumLabels: ['every minute', 'every 3 minutes', 'every 5 minutes'],
            title: 'How far back would you like to sync your old mail',
          },
          taskDelay: {
            type: 'integer',
            default: 5000,
            enum: [5000, 15000, 30000, 60000, 0],
            enumLabels: ['5 seconds', '15 seconds', '30 seconds', '60 seconds', 'Disable'],
            title: 'Undo time window',
          },
        },
      },
      workspace: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            default: 'list',
            syncToServer: true,
            enum: ['split', 'list', 'split-v'],
          },
          systemTray: {
            type: 'boolean',
            default: true,
            syncToServer: true,
            title: 'Show icon in menu bar',
            platforms: ['darwin', 'linux'],
          },
          disableSubjectSuggestions: {
            type: 'boolean',
            default: true,
            syncToServer: false,
            title: 'Disable subject suggestions',
          },
          enableFocusedInbox: {
            type: 'boolean',
            default: true,
            notifyNative: true,
            syncToServer: true,
            syncToServerCommonKey: 'focused_inbox_enabled',
            title: 'Enable Focused Inbox (only show important senders in your inbox)',
          },
          promptedFocusedInbox: {
            type: 'boolean',
            default: false,
          },
          promptedEdisonAccount: {
            type: 'boolean',
            default: false,
          },
          showImportant: {
            type: 'boolean',
            default: true,
            syncToServer: true,
            title: 'Show important markers (Gmail only)',
          },
          showLabels: {
            type: 'boolean',
            default: true,
            syncToServer: true,
            title: 'Show labels (Gmail only)',
          },
          showUnreadForAllCategories: {
            type: 'boolean',
            default: true,
            syncToServer: true,
            title: 'Show unread count for all folders',
          },
          enableChat: {
            type: 'boolean',
            default: false,
            title: 'Enable chat feature',
          },
          chatProdEnv: {
            type: 'boolean',
            default: true,
            title: 'change chat environment to production',
          },
          use24HourClock: {
            type: 'boolean',
            syncToServer: true,
            default: false,
            title: 'Use 24-hour clock',
          },
          sendUsageData: {
            type: 'boolean',
            default: true,
            syncToServer: true,
            title: 'Send usage data to help improve the performance of the app',
          },
          interfaceZoom: {
            title: 'Override standard interface scaling',
            type: 'number',
            default: 1,
            syncToServer: true,
            advanced: true,
          },
          threadView: {
            type: 'boolean',
            default: true,
            syncToServer: true,
          },
        },
      },
      disabledPackages: {
        type: 'array',
        default: [],
        items: {
          type: 'string',
        },
      },
      themes: {
        type: 'array',
        default: ['ui-light'],
        items: {
          type: 'string',
        },
      },
      themeMode: {
        type: 'string',
        default: 'ui-light',
        syncToServer: true,
        enum: ['ui-dark', 'ui-light', 'auto'],
      },
      keymapTemplate: {
        type: 'string',
        default: 'Gmail',
      },
      attachments: {
        type: 'object',
        properties: {
          openFolderAfterDownload: {
            type: 'boolean',
            default: false,
            syncToServer: true,
            title: 'Open containing folder after downloading attachments',
          },
          displayFilePreview: {
            type: 'boolean',
            default: false,
            title: 'Display thumbnails for attachments when available (Mac only)',
          },
          downloadFolder: {
            default: 'Downloads',
            syncToServer: true,
            type: 'component',
          },
        },
      },
      reading: {
        type: 'object',
        properties: {
          markAsReadDelay: {
            type: 'integer',
            default: 0,
            syncToServer: true,
            enum: [0, 500, 2000, -1],
            enumLabels: ['Instantly', 'After ½ Second', 'After 2 Seconds', 'Manually'],
            title: 'When reading messages, mark as read after',
          },
          autoloadImages: {
            type: 'boolean',
            default: true,
            syncToServer: true,
            title: 'Automatically load images in open emails',
          },
          actionAfterRemove: {
            type: 'string',
            default: 'next',
            syncToServer: true,
            enum: ['next', 'previous', 'return'],
            enumLabels: ['Open next', 'Open previous', 'Return to email list'],
            title: 'When mail is Archived or Deleted',
          },
          descendingOrderMessageList: {
            type: 'boolean',
            default: false,
            syncToServer: true,
            title: 'Display conversations in descending chronological order',
          },
          openReplyInNewWindow: {
            type: 'boolean',
            default: false,
            syncToServer: true,
            title: 'Open reply in new window',
          },
        },
      },
      fontface: {
        type: 'string',
        default: 'sans-serif',
      },
      fontsize: {
        type: 'string',
        default: '14px',
      },
      composing: {
        type: 'object',
        properties: {
          showCcAndBcc: {
            type: 'string',
            default: 'cc',
            syncToServer: true,
            enum: ['none', 'cc', 'cc+bcc'],
            enumLabels: ['None', 'CC', 'CC and BCC'],
            title: 'Show CC, BCC when forwarding or composing new draft',
          },
          includeOriginalEmailInReply: {
            type: 'boolean',
            default: true,
            syncToServer: true,
            title: 'Include original email when replying to a message',
          },
          spellcheck: {
            type: 'boolean',
            default: true,
            syncToServer: true,
            title: 'Check messages for spelling',
          },
          spellcheckDefaultLanguage: {
            type: 'string',
            default: '',
            syncToServer: true,
            enum: [
              '',
              'bg',
              'br',
              'ca',
              'cs',
              'da',
              'de',
              'de-at',
              'de-ch',
              'el',
              'en-au',
              'en-ca',
              'en-gb',
              'en-us',
              'en-za',
              'eo',
              'es',
              'et',
              'eu',
              'fo',
              'fr',
              'fur',
              'fy',
              'ga',
              'gd',
              'gl',
              'he',
              'hr',
              'hu',
              'is',
              'it',
              'ko',
              'la',
              'lb',
              'lt',
              'ltg',
              'lv',
              'mk',
              'mn',
              'nb',
              'ne',
              'nl',
              'nn',
              'pl',
              'pt',
              'pt-br',
              'ro',
              'ru',
              'rw',
              'sk',
              'sl',
              'sr',
              'sv',
              'tr',
              'uk',
              'vi',
            ],
            enumLabels: [
              '(System Default)',
              'Bulgarian',
              'Breton',
              'Catalan',
              'Czech',
              'Danish',
              'German',
              'German (Austria)',
              'German (Switzerland)',
              'Modern Greek',
              'English (Australia)',
              'English (Canada)',
              'English (United Kingdom)',
              'English (United States)',
              'English (South Africa)',
              'Esperanto',
              'Spanish',
              'Estonian',
              'Basque',
              'Faroese',
              'French',
              'Friulian',
              'Western Frisian',
              'Irish',
              'Gaelic',
              'Galician',
              'Hebrew',
              'Croatian',
              'Hungarian',
              'Icelandic',
              'Italian',
              'Korean',
              'Latin',
              'Luxembourgish',
              'Lithuanian',
              'Latgalian',
              'Latvian',
              'Macedonian',
              'Mongolian',
              'Norwegian Bokmål',
              'Nepali',
              'Dutch',
              'Norwegian Nynorsk',
              'Polish',
              'Portuguese',
              'Portuguese (Brazil)',
              'Romanian',
              'Russian',
              'Kinyarwanda',
              'Slovak',
              'Slovenian',
              'Serbian',
              'Swedish',
              'Turkish',
              'Ukrainian',
              'Vietnamese',
            ],
            title: 'Default spellcheck language',
            note:
              'If you write a draft in another language, Edison Mail will auto-detect it and use the correct spelling dictionary after a few sentences.',
          },
        },
      },
      quickActions: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            default: true,
            syncToServer: true,
            title: 'Show quick actions when hovering over emails in your list',
          },
          image: {
            type: 'component',
            title: 'Show preview image',
          },
          quickAction1: {
            type: 'string',
            default: 'archive',
            syncToServer: true,
            enum: actionValues,
            enumLabels: actionLabels,
            title: 'Action 1',
          },
          quickAction2: {
            type: 'string',
            default: 'flag',
            syncToServer: true,
            enum: actionValues,
            enumLabels: actionLabels,
            title: 'Action 2',
          },
          quickAction3: {
            type: 'string',
            default: 'trash',
            syncToServer: true,
            enum: actionValues,
            enumLabels: actionLabels,
            title: 'Action 3',
          },
          quickAction4: {
            type: 'string',
            default: 'read',
            syncToServer: true,
            enum: actionValues,
            enumLabels: actionLabels,
            title: 'Action 4',
          },
        },
      },
      swipeActions: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            default: true,
            syncToServer: true,
            title: 'Enable swipe actions',
          },
          image: {
            type: 'component',
            title: 'Show preview image',
          },
          leftShortAction: {
            type: 'string',
            default: 'archive',
            syncToServer: true,
            enum: actionValues,
            enumLabels: actionLabels,
            title: 'Left short swipe',
          },
          leftLongAction: {
            type: 'string',
            default: 'flag',
            syncToServer: true,
            enum: actionValues,
            enumLabels: actionLabels,
            title: 'Left long swipe',
          },
          rightShortAction: {
            type: 'string',
            default: 'read',
            syncToServer: true,
            enum: actionValues,
            enumLabels: actionLabels,
            title: 'Right Short swipe',
          },
          rightLongAction: {
            type: 'string',
            default: 'trash',
            syncToServer: true,
            enum: actionValues,
            enumLabels: actionLabels,
            title: 'Right Long swipe',
          },
        },
      },
      mailActions: {
        type: 'object',
        properties: {
          image: {
            type: 'component',
            title: 'Show preview image',
          },
          mailAction1: {
            type: 'string',
            default: 'archive',
            syncToServer: true,
            enum: emailActionValues,
            enumLabels: emailActionLabels,
            title: 'Action 1',
          },
          mailAction2: {
            type: 'string',
            default: 'trash',
            syncToServer: true,
            enum: emailActionValues,
            enumLabels: emailActionLabels,
            title: 'Action 2',
          },
          mailAction3: {
            type: 'string',
            default: 'flag',
            syncToServer: true,
            enum: emailActionValues,
            enumLabels: emailActionLabels,
            title: 'Action 3',
          },
          mailAction4: {
            type: 'string',
            default: 'read',
            syncToServer: true,
            enum: emailActionValues,
            enumLabels: emailActionLabels,
            title: 'Action 4',
          },
          mailAction5: {
            type: 'string',
            default: 'folder',
            syncToServer: true,
            enum: emailActionValues,
            enumLabels: emailActionLabels,
            title: 'Action 5',
          },
        },
      },
      task: {
        type: 'object',
        properties: {
          delayInMs: {
            type: 'number',
            default: 5000,
            syncToServer: true,
            enum: [5000, 15000, 30000, 60000, 0],
            enumLabels: ['5 seconds', '15 seconds', '30 seconds', '60 seconds', 'Disable'],
            title: 'Undo time window',
          },
          undoQueueOnlyShowOne: {
            type: 'boolean',
            default: true,
            syncToServer: true,
            title: 'Only show one Undo',
          },
        },
      },
      outbox: {
        type: 'object',
        properties: {
          failingUnlockInMs: {
            type: 'number',
            default: 300000,
          },
        },
      },
      sending: {
        type: 'object',
        properties: {
          sounds: {
            type: 'boolean',
            default: false,
            title: 'Send mail sound',
            syncToServer: true,
            syncToServerCommonKey: 'play_sound_after_email_sent',
          },
          defaultReplyType: {
            type: 'string',
            default: 'reply-all',
            syncToServer: true,
            enum: ['reply', 'reply-all'],
            enumLabels: ['Reply', 'Reply All'],
            title: 'Default reply behavior',
          },
          defaultAccountIdForSend: {
            type: 'string',
            default: 'selected-mailbox',
            syncToServer: true,
            enum: [],
            enumLabels: [],
          },
        },
      },
      notifications: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            default: true,
            title: 'Show notifications for new unread emails',
          },
          // enabledForRepeatedTrackingEvents: {
          //   type: 'boolean',
          //   default: true,
          //   title: 'Show notifications for repeated opens / clicks',
          // },
          sounds: {
            type: 'boolean',
            default: false,
            syncToServer: true,
            title: 'New mail sound',
          },
          // unsnoozeToTop: {
          //   type: 'boolean',
          //   default: true,
          //   title: 'Resurface messages to the top of the inbox when unsnoozing',
          // },
          countBadge: {
            type: 'string',
            default: 'unread',
            syncToServer: true,
            enum: ['hide', 'unread', 'total'],
            enumLabels: ['Hide Badge', 'Show Unread Count', 'Show Total Count'],
            title: 'Dock badge count',
            notifyNative: true,
          },
        },
      },
      appearance: {
        type: 'object',
        properties: {
          sidebaricons: {
            type: 'boolean',
            default: false,
            syncToServer: true,
            title: 'Show icons in the left-hand menu.',
          },
          previewLines: {
            type: 'number',
            default: '2',
            syncToServer: true,
            enum: [0, 1, 2, 3, 4],
            enumLabels: ['None', '1 line', '2 lines', '3 lines', '4 lines'],
            title: 'Preview lines (two panel view only)',
          },
          profile: {
            type: 'boolean',
            default: true,
            syncToServer: true,
            title: 'Show profile pictures',
          },
          adaptiveEmailColor: {
            type: 'boolean',
            default: true,
            syncToServer: true,
            title: 'Enable Adaptive Coloring for emails.',
            note:
              'Email content automatically adapts to the background color of the theme to preserve screen brightness. This can alter the original background and text color of emails in dark mode vs light mode. Turn this off to always view the original email when the app is in dark mode.',
          },
          dateFormat: {
            type: 'string',
            default: defaultDateFormatOption,
            syncToServer: true,
            enum: dateFormatOption,
            enumLabels: dateFormatOption,
            title: 'Date format',
          },
        },
      },
      privacy: {
        type: 'object',
        properties: {
          dataShare: {
            type: 'object',
            properties: {
              optOut: {
                type: 'boolean',
                default: false,
                syncToServer: true,
                title: 'Opt Out of data share',
              },
            },
          },
        },
      },
      suggestContact: {
        type: 'array',
        default: [],
        title: '',
        syncToServerCommonKey: 'suggestcontact',
        mergeServerToLocal: null,
        mergeLocalToServer: null,
      },
    },
  },
  chatPanelHeight: {
    type: 'number',
    default: 300,
  },
  commonSettingsVersion: {
    type: 'number',
    default: 0,
  },
  macSettingsVersion: {
    type: 'number',
    default: 0,
  },
  accounts: {
    type: 'array',
    default: [],
    syncToServer: true,
    mergeServerToLocal: mergeServerAccountsToLocal,
    mergeLocalToServer: mergeLocalAccountsToServer,
  },
  signatures: {
    type: 'array',
    default: [],
    syncToServer: true,
    mergeLocalToServer: mergeLocalSignaturesToServer,
    mergeServerToLocal: mergeServerSignaturesToLocal,
  },
  templates: {
    type: 'array',
    default: [],
    syncToServer: true,
    syncToServerCommonKey: 'template',
    mergeLocalToServer: mergeLocalTemplatesToServer,
    mergeServerToLocal: mergeServerTemplatesToLocal,
  },
  defaultSignatures: {
    type: 'object',
    properties: {},
    syncToServer: true,
    mergeLocalToServer: mergeLocalDefaultSignaturesToServer,
    mergeServerToLocal: mergeServerDefaultSignaturesToLocal,
  },
};
