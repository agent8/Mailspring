import React, {Component} from 'react'
import SidebarActions from '../../../account-sidebar/lib/sidebar-actions'
const { OutlineView } = require('mailspring-component-kit')
// import SidebarStore from '../../../account-sidebar/lib/sidebar-store'
import getTeamEditSideBarItems from './team-edit-sidebar-items'

class TeamEditSideBar extends Component {
  static displayName = 'TeamEditSideBar';
  componentWillMount = () => {
    const teamEditSideBarItems = getTeamEditSideBarItems()
    this.setState({teamEditSideBarItems})
  }
  componentDidMount = () => {
    SidebarActions.setKeyCollapsed.listen(this.update)
  }
  update = () => {
    const teamEditSideBarItems = getTeamEditSideBarItems()
    this.setState({teamEditSideBarItems})
  }
  render = () => {
    const {teamEditSideBarItems} = this.state
    return (<div className="pad-sidebar account-sidebar-sections">
      <OutlineView {...teamEditSideBarItems} />
    </div>)
  }
}

export default TeamEditSideBar