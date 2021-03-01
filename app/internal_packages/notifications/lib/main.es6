/* eslint no-unused-vars:0 */

import { ComponentRegistry, WorkspaceStore } from 'mailspring-exports';
import ActivitySidebar from './sidebar/activity-sidebar';
import NotifWrapper from './notif-wrapper';

import DefaultClientNotification from './items/default-client-notif';
import UnstableChannelNotification from './items/unstable-channel-notif';
import DevModeNotification from './items/dev-mode-notif';
import PleaseSubscribeNotification from './items/please-subscribe-notif';
import DisabledMailRulesNotification from './items/disabled-mail-rules-notif';
import UpdateNotification from './items/update-notification';
import DiskUsageNotification from './items/disk-usage-notification';
import FocusedInboxNotif from './items/focused-inbox-notif';
import EdisonAccountNotif from './items/edison-account-notif';
import EdisonAccountDeletedNotif from './items/edison-account-deleted-notif';
import ImproveDataNotif from './items/improve-data-notif';
import WhatsNew from './items/whats-new-notif';
import DatabaseVacuumNotification from './items/database-vacuum-notification';

const notifications = [
  // DefaultClientNotification,
  UnstableChannelNotification,
  DevModeNotification,
  PleaseSubscribeNotification,
  DisabledMailRulesNotification,
  UpdateNotification,
  DiskUsageNotification,
  EdisonAccountNotif,
  FocusedInboxNotif,
  DatabaseVacuumNotification,
  ImproveDataNotif,
  WhatsNew,
  EdisonAccountDeletedNotif,
];

export function activate() {
  // if (AppEnv.inDevMode()) {
  //   ComponentRegistry.register(ActivitySidebar, { location: WorkspaceStore.Location.RootSidebar });
  // }
  ComponentRegistry.register(NotifWrapper, { location: WorkspaceStore.Sheet.Global.Footer });

  for (const notification of notifications) {
    ComponentRegistry.register(notification, { role: 'RootSidebar:Notifications' });
  }
}

export function serialize() {}

export function deactivate() {
  if (AppEnv.inDevMode()) {
    ComponentRegistry.unregister(ActivitySidebar);
  }
  ComponentRegistry.unregister(NotifWrapper);

  for (const notification of notifications) {
    ComponentRegistry.unregister(notification);
  }
}
