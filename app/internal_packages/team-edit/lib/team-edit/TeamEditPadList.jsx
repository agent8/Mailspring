import React, {Component} from 'react'
import { postAsync } from '../../../edison-beijing-chat/utils/httpex'
import { getTokenByUserId } from '../../../edison-beijing-chat/utils/chat-account'
import { ScrollRegion } from 'mailspring-component-kit';
import Pad from './Pad'
import PadStore from './PadStore'
import {ConversationStore} from 'chat-exports'

class TeamEditPadList extends Component {
  static displayName = 'TeamEditPadList';
  state = {}
  constructor(){super()}
  componentDidMount = async () => {
    this.unsub = PadStore.listen(this.update)
    this.unsub2 = ConversationStore.listen(this.update)
    await PadStore.refreshPads()
    const padList = PadStore.pads
    this.setState({padList})
  }
  componentWillUnmount = () => {
    this.unsub()
    this.unsub2()
  }
  update = () => {
    console.log(' TeamEditPadList.update: ')
    this.setState({ padList: PadStore.pads })
  }
  render = () => {
    console.log( 'TeamEditPadList.render:', this.props)
    const {enterPadChatRoom, hidePadChatRoom} = this.props
    const {padList} = this.state
    console.log('render: padList: ', padList)
    if (!padList) {
      return null
    }
    const pads = padList.map((pad, index) => {
      return (<Pad pad={pad} key={index}
        enterPadChatRoom={enterPadChatRoom}
        hidePadChatRoom={hidePadChatRoom}
        > </Pad>)
    })
    return (
      <div className='team-edit-pad-list'> {pads}</div>
    )
  }
}

export default TeamEditPadList