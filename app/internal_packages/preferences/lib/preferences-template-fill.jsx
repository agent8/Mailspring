import {
  DefaultMailClientItem,
  LaunchSystemStartItem,
  DefaultAccountSending,
  EnableFocusInboxItem,
  DownloadSelection,
  LocalData,
  SupportId,
  TaskDelay,
} from './components/preferences-general-components';
import {
  PreferencesMutedNotifacations,
  PreferencesAccountNotifacations,
} from './components/preferences-notifications';
import EdisonAccount from './components/preferences-my-account';
import PreferencesAccounts from './components/preferences-accounts';
import {
  AppearanceScaleSlider,
  AppearanceProfileOptions,
  AppearancePanelOptions,
  AppearanceThemeSwitch,
  AppearanceViewOptions,
} from './components/preferences-appearance-components';
import {
  CustomizeQuickActions,
  CustomizeSwipeActions,
  CustomizeEmailActions,
} from './components/preferences-customize-components';
import BlockedSenders from './components/preferences-blocked-senders';
import PreferencesLabels from './components/preferences-labels';
import { Privacy } from './components/preferences-privacy-components';
import {
  PreferencesKeymapsHearder,
  PreferencesKeymapsContent,
} from './components/preferences-keymaps';
import { AccountStore } from 'mailspring-exports';

const preferencesTemplateFill = {
  tables: [
    {
      tabId: 'General',
      displayName: 'General',
      className: 'container-general',
      order: 1,
      configGroup: [
        {
          groupName: 'EMAIL',
          groupItem: [
            {
              label: 'Make Edison Mail your default mail client',
              component: DefaultMailClientItem,
              keywords: [],
              hidden: process.mas,
            },
            {
              label: 'Launch on system start',
              component: LaunchSystemStartItem,
              keywords: [],
              hidden: process.mas,
            },
            {
              label: 'Show icon in menu bar',
              configSchema: configSchema => configSchema.properties.workspace.properties.systemTray,
              keyPath: 'core.workspace.systemTray',
              keywords: [],
            },
            {
              label: 'Enable Focused Inbox (only show important senders in your inbox)',
              component: EnableFocusInboxItem,
              keyPath: 'core.workspace.enableFocusedInbox',
              keywords: [],
            },
            {
              label: 'Show important markers (Gmail only)',
              configSchema: configSchema =>
                configSchema.properties.workspace.properties.showImportant,
              keyPath: 'core.workspace.showImportant',
              keywords: [],
            },
            {
              label: 'Show labels (Gmail only)',
              configSchema: configSchema => configSchema.properties.workspace.properties.showLabels,
              keyPath: 'core.workspace.showLabels',
              keywords: [],
            },
            {
              label: 'Show unread count for all folders',
              configSchema: configSchema =>
                configSchema.properties.workspace.properties.showUnreadForAllCategories,
              keyPath: 'core.workspace.showUnreadForAllCategories',
              keywords: [],
            },
            {
              label: 'Use 24-hour clock',
              configSchema: configSchema =>
                configSchema.properties.workspace.properties.use24HourClock,
              keyPath: 'core.workspace.use24HourClock',
              keywords: [],
            },
            {
              label: 'Send usage data to help improve the performance of the app',
              configSchema: configSchema =>
                configSchema.properties.workspace.properties.sendUsageData,
              keyPath: 'core.workspace.sendUsageData',
              keywords: [],
            },
            {
              label: 'When mail is Archived or Deleted',
              configSchema: configSchema =>
                configSchema.properties.reading.properties.actionAfterRemove,
              keyPath: 'core.reading.actionAfterRemove',
              keywords: [],
            },
            {
              label: 'Send new mail from',
              component: DefaultAccountSending,
              configSchema: configSchema => configSchema,
              keywords: [],
            },
            {
              label: 'Send mail sound',
              configSchema: configSchema => configSchema.properties.sending.properties.sounds,
              keyPath: 'core.sending.sounds',
              keywords: [],
            },
            {
              label: 'Default reply behavior',
              configSchema: configSchema =>
                configSchema.properties.sending.properties.defaultReplyType,
              keyPath: 'core.sending.defaultReplyType',
              keywords: [],
            },
            {
              label: 'Undo time window',
              configSchema: configSchema => configSchema.properties.task.properties.delayInMs,
              component: TaskDelay,
              keyPath: 'core.task.delayInMs',
              keywords: ['delay'],
            },
            {
              label: 'Show only one undo',
              configSchema: configSchema =>
                configSchema.properties.task.properties.undoQueueOnlyShowOne,
              keyPath: 'core.task.undoQueueOnlyShowOne',
              keywords: ['undo'],
            },
          ],
        },
        {
          groupName: 'READING & RESPONDING',
          groupItem: [
            {
              label: 'When reading messages, mark as read after',
              configSchema: configSchema =>
                configSchema.properties.reading.properties.markAsReadDelay,
              keyPath: 'core.reading.markAsReadDelay',
              keywords: [],
            },
            {
              label: 'Automatically load images in open emails',
              configSchema: configSchema =>
                configSchema.properties.reading.properties.autoloadImages,
              keyPath: 'core.reading.autoloadImages',
              keywords: [],
            },
            {
              label: 'When I reply to a message, automatically open my reply in a new window',
              configSchema: configSchema =>
                configSchema.properties.reading.properties.openReplyInNewWindow,
              keyPath: 'core.reading.openReplyInNewWindow',
              keywords: [],
              hidden: AppEnv.isDisableThreading(),
            },
            {
              label: 'Include original email when replying to a message',
              configSchema: configSchema =>
                configSchema.properties.composing.properties.includeOriginalEmailInReply,
              keyPath: 'core.composing.includeOriginalEmailInReply',
              keywords: [],
            },
            {
              label: 'Show CC, BCC when forwarding or composing new draft',
              configSchema: configSchema =>
                configSchema.properties.composing.properties.showCcAndBcc,
              keyPath: 'core.composing.showCcAndBcc',
              keywords: [],
            },
            {
              label: 'Display conversations in descending chronological order',
              configSchema: configSchema =>
                configSchema.properties.reading.properties.descendingOrderMessageList,
              keyPath: 'core.reading.descendingOrderMessageList',
              keywords: [],
            },
            {
              label: 'Group messages by conversation',
              configSchema: configSchema => configSchema.properties.workspace.properties.threadView,
              keyPath: 'core.workspace.threadView',
              component: AppearanceViewOptions,
              keywords: ['disable threading'],
            },
            {
              label: 'Check messages for spelling',
              configSchema: configSchema => configSchema.properties.composing.properties.spellcheck,
              keyPath: 'core.composing.spellcheck',
              keywords: [],
            },
            {
              label: 'Default spellcheck language',
              configSchema: configSchema =>
                configSchema.properties.composing.properties.spellcheckDefaultLanguage,
              keyPath: 'core.composing.spellcheckDefaultLanguage',
              keywords: [],
            },
          ],
        },
        // {
        //   groupName: 'MESSAGES/CHAT',
        //   groupItem: [
        //     {
        //       label: 'Enable chat feature',
        //       configSchema: configSchema => configSchema.properties.workspace.properties.enableChat,
        //       keyPath: 'core.workspace.enableChat',
        //       keywords: [],
        //     },
        //   ],
        // },
        {
          groupName: 'DOWNLOADS',
          groupItem: [
            {
              label: 'Open containing folder after downloading attachments',
              configSchema: configSchema =>
                configSchema.properties.attachments.properties.openFolderAfterDownload,
              keyPath: 'core.attachments.openFolderAfterDownload',
              keywords: [],
            },
            // {
            //   label: 'Display thumbnails for attachments when available (Mac only)',
            //   configSchema: configSchema =>
            //     configSchema.properties.attachments.properties.displayFilePreview,
            //   keyPath: 'core.attachments.displayFilePreview',
            //   keywords: [],
            // },
            {
              label: 'Save downloaded files to',
              component: DownloadSelection,
              keyPath: 'core.attachments.downloadFolder',
              keywords: ['attachment'],
            },
          ],
        },
        {
          groupName: 'Local Data',
          groupItem: [
            {
              label: 'Local Data',
              component: LocalData,
              keywords: [],
            },
          ],
        },
        {
          groupName: 'Support Id',
          groupItem: [
            {
              label: 'Support Id',
              component: SupportId,
              keywords: [],
            },
          ],
        },
      ],
    },
    // {
    //   tabId: 'My Account',
    //   displayName: 'My Account',
    //   order: 2,
    //   configGroup: [
    //     {
    //       groupItem: [
    //         {
    //           label: 'Back up & Sync',
    //           component: EdisonAccount,
    //           keywords: [],
    //         },
    //       ],
    //     },
    //   ],
    // },
    {
      tabId: 'Notifications',
      displayName: 'Notifications',
      order: 3,
      configGroup: [
        {
          groupName: 'EMAIL NOTIFICATIONS',
          groupItem: [
            {
              label: 'AccountNotifications',
              component: PreferencesAccountNotifacations,
              keywords: [],
            },
          ],
        },
        {
          groupName: 'BADGE COUNT',
          groupItem: [
            {
              label: 'Dock badge count',
              configSchema: configSchema =>
                configSchema.properties.notifications.properties.countBadge,
              keyPath: 'core.notifications.countBadge',
              keywords: [],
            },
            {
              label: 'System tray badge count',
              configSchema: configSchema =>
                configSchema.properties.notifications.properties.countSystemTray,
              keyPath: 'core.notifications.countSystemTray',
              keywords: [],
            },
          ],
        },
        {
          groupItem: [
            {
              label: 'MutedNotifications',
              component: PreferencesMutedNotifacations,
              keywords: [],
            },
          ],
        },
      ],
    },
    {
      tabId: 'Labels',
      displayName: 'Labels',
      order: 4,
      isHidden: () => {
        const accounts = AccountStore.accounts().filter(account => {
          return account && (account.provider === 'gmail' || account.provider === 'onmail');
        });
        return accounts.length === 0;
      },
      configGroup: [
        {
          groupItem: [
            {
              label: 'PreferencesLabels',
              component: PreferencesLabels,
              keywords: ['Labels'],
            },
          ],
        },
      ],
    },
    {
      tabId: 'Accounts',
      displayName: 'Accounts',
      order: 4,
      configGroup: [
        {
          groupItem: [
            {
              label: 'Accounts',
              component: PreferencesAccounts,
              keywords: [],
            },
          ],
        },
      ],
    },
    {
      tabId: 'Appearance',
      displayName: 'Appearance',
      className: 'container-appearance',
      order: 5,
      configGroup: [
        {
          groupName: 'GENERAL',
          groupItem: [
            {
              label: 'Show icons in the left-hand menu.',
              configSchema: configSchema =>
                configSchema.properties.appearance.properties.sidebaricons,
              keyPath: 'core.appearance.sidebaricons',
              keywords: ['sidebar', 'left', 'icons', 'avatar'],
            },
            {
              label: 'Preview lines (two panel view only)',
              configSchema: configSchema =>
                configSchema.properties.appearance.properties.previewLines,
              keyPath: 'core.appearance.previewLines',
              keywords: [],
            },
            {
              label: 'Date format',
              configSchema: configSchema =>
                configSchema.properties.appearance.properties.dateFormat,
              keyPath: 'core.appearance.dateFormat',
              keywords: [],
            },
          ],
        },
        {
          groupName: 'LAYOUT',
          groupItem: [
            {
              label: 'Profile pictures',
              component: AppearanceProfileOptions,
              keywords: ['Profile Pictures', 'No Profile Pictures', 'avatar'],
            },
            {
              label: 'Panel',
              component: AppearancePanelOptions,
              keywords: ['Single Panel', 'Two Panels', 'preview'],
            },
          ],
        },
        {
          groupName: 'THEME',
          groupItem: [
            {
              label: 'Theme',
              component: AppearanceThemeSwitch,
              keywords: ['Light Mode', 'Dark Mode', 'background'],
            },
            {
              label: 'Enable Adaptive Coloring for emails.',
              configSchema: configSchema =>
                configSchema.properties.appearance.properties.adaptiveEmailColor,
              keyPath: 'core.appearance.adaptiveEmailColor',
              keywords: [],
            },
          ],
        },
        {
          groupName: 'SCALING',
          groupItem: [
            {
              label: 'AppearanceScaleSlider',
              component: AppearanceScaleSlider,
              keywords: ['font size'],
            },
          ],
        },
      ],
    },
    {
      tabId: 'Customize Actions',
      displayName: 'Customize Actions',
      className: 'container-customize-actions',
      order: 6,
      configGroup: [
        {
          groupName: 'Quick Actions',
          groupItem: [
            {
              label: 'Show quick actions when hovering over emails in your list',
              configSchema: configSchema => configSchema,
              component: CustomizeQuickActions,
              keywords: ['buttons', 'Archive', 'flag', 'trash', 'read', 'unread', 'spam'],
            },
          ],
        },
        {
          groupName: 'Swipe Actions',
          groupItem: [
            {
              label: 'Enable swipe actions',
              configSchema: configSchema => configSchema,
              component: CustomizeSwipeActions,
              keywords: ['buttons', 'Archive', 'flag', 'trash', 'read', 'unread', 'spam'],
            },
          ],
        },
        {
          groupName: 'Email Actions',
          groupItem: [
            {
              label: 'email actions',
              configSchema: configSchema => configSchema,
              component: CustomizeEmailActions,
              keywords: ['buttons', 'Archive', 'flag', 'trash', 'read', 'unread', 'spam'],
            },
          ],
        },
      ],
    },
    {
      tabId: 'Shortcuts',
      displayName: 'Shortcuts',
      className: 'container-keymaps',
      order: 7,
      configGroup: [
        {
          groupName: 'SHORTCUTS',
          groupItem: [
            {
              label: 'SHORTCUTS',
              component: PreferencesKeymapsHearder,
              keywords: [],
            },
          ],
        },
        ...PreferencesKeymapsContent(),
      ],
    },
    {
      tabId: 'Blocked Senders',
      displayName: 'Blocked Senders',
      order: 129,
      configGroup: [
        {
          groupItem: [
            {
              label: 'BlockedSenders',
              component: BlockedSenders,
              keywords: ['unsubscribe'],
            },
          ],
        },
      ],
    },
    {
      tabId: 'Privacy',
      displayName: 'Privacy',
      order: 130,
      configGroup: [
        {
          groupItem: [
            {
              label: 'Privacy',
              component: Privacy,
              keywords: ['data'],
            },
          ],
        },
      ],
    },
  ],
};

export default preferencesTemplateFill;
