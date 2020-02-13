import SidebarActions from '../../../account-sidebar/lib/sidebar-actions'
import SidebarStore from '../../../account-sidebar/lib/sidebar-store'
import PadStore from './PadStore'

const isItemCollapsed = function (id) {
  AppEnv.savedState.sidebarKeysCollapsed = AppEnv.savedState.sidebarKeysCollapsed || {}
  if (AppEnv.savedState.sidebarKeysCollapsed[id] !== undefined) {
    return AppEnv.savedState.sidebarKeysCollapsed[id];
  } else {
    return true;
  }
};

const toggleItemCollapsed = function (item) {
  if (!(item.children.length > 0)) {
    return;
  }
  SidebarActions.setKeyCollapsed(item.id, !isItemCollapsed(item.id));
};

const getTeamEditSideBarItems = () =>{
  AppEnv.savedState.sidebarKeysCollapsed = AppEnv.savedState.sidebarKeysCollapsed || {}
  const onSelect = (item) => {PadStore.setKind(item.id)}
  const teamEditSideBarItems = {
    title: 'team edit pad',
    items: [{
      id: 'TeamReplyMails',
      name: 'Team Reply Mails',
      onCollapseToggled: toggleItemCollapsed,
      collapsed: AppEnv.savedState.sidebarKeysCollapsed['Team Reply Mails'],
      children:[
        { id: 'All',
          name: 'All',
          onSelect,
          children:[]
        },
        { id: 'MeStarted',
          name: 'Me started',
          onSelect,
          children:[]
        },
        { id: 'OtherStarted',
          name: 'Other started',
          onSelect,
          children:[]
        },
        { id: 'Finished',
          name: 'Finished',
          onSelect,
          children:[]
        }
      ]
    }]
  }
  return teamEditSideBarItems
}


export default getTeamEditSideBarItems