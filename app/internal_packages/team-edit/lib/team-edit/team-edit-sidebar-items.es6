import SidebarActions from '../../../account-sidebar/lib/sidebar-actions'
import PadStore from './PadStore'
import { WorkspaceStore, Actions } from 'mailspring-exports'

AppEnv.savedState = AppEnv.savedState || {}
AppEnv.savedState.sidebarKeysCollapsed = AppEnv.savedState.sidebarKeysCollapsed || {}
AppEnv.savedState.sidebarKeysCollapsed.TeamReplyMails = true
const isItemCollapsed = function (id) {
  AppEnv.savedState.sidebarKeysCollapsed = AppEnv.savedState.sidebarKeysCollapsed || {}
  if (AppEnv.savedState.sidebarKeysCollapsed[id] !== undefined) {
    return !!AppEnv.savedState.sidebarKeysCollapsed[id]
  } else {
    return true
  }
}

const toggleItemCollapsed = function (item) {
  if (!(item.children.length > 0)) {
    return
  }
  SidebarActions.setKeyCollapsed(item.id, !isItemCollapsed(item.id))
}

const getTeamEditSideBarItems = () => {
  AppEnv.savedState.sidebarKeysCollapsed = AppEnv.savedState.sidebarKeysCollapsed || {}
  const onSelect = item => {
    console.log(' getTeamEditSideBarItems WorkspaceStore.Sheet:', WorkspaceStore.Sheet)
    Actions.selectRootSheet(WorkspaceStore.Sheet.TeamEditView)
    PadStore.setKind(item.id || 'All')
  }
  const items = [
    {
      id: 'TeamReplyMails',
      name: 'Team Reply Mails',
      onCollapseToggled: toggleItemCollapsed,
      collapsed: AppEnv.savedState.sidebarKeysCollapsed['TeamReplyMails'],
      onSelect,
      children: [
        { id: 'All', name: 'All', onSelect, children: [] },
        { id: 'MeStarted', name: 'Me started', onSelect, children: [] },
        { id: 'OtherStarted', name: 'Other started', onSelect, children: [] },
        { id: 'Finished', name: 'Finished', onSelect, children: [] },
      ],
    },
  ]
  return items
}

export default getTeamEditSideBarItems
