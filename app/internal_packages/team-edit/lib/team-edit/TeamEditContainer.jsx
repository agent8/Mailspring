import React, {Component} from 'react'
import { Flexbox } from 'mailspring-component-kit';
import {ConversationStore} from 'chat-exports'
import PadStore from './PadStore'
import TeamEditSideBar from './TeamEditSideBar'
import TeamEditPadList from './TeamEditPadList'
import PadMessagePanel from './PadMessagePanel'
import ResizableRegion from '../../../../src/components/resizable-region'

class TeamEditContainer extends Component {
  static displayName = 'TeamEditContainer';
  state = {}

  enterPadChatRoom = async (pad) => {
    const convJid = pad.chatRoomId + '@muc.im.edison.tech'
    const conv = await ConversationStore.getConversationByJid(convJid)
    let {userId, email, token} = PadStore
    if (!conv) {
      const name = 'Pad: ' + pad.name
      const roomId = convJid
      const curJid = userId + '@im.edison.tech'
      const contacts = []
      const isExistedAppRoom = true
      const payload = {
        contacts,
        roomId,
        name,
        curJid,
        isExistedAppRoom,
      }
      await ConversationStore.createGroupConversation(payload)
    }
    PadStore.setPad(pad)
    if (!userId){
      const chatAccounts = AppEnv.config.get('chatAccounts') || {}
      const acc = Object.values(chatAccounts)[0]
      if (!acc) {
        return
      }
      userId = acc.userId
      email = acc.email
      token = await getTokenByUserId(userId)
    }
    const padId = pad.id
    const padInfo = {padId, userId, token, email}
    const chatRoomVisible = true
    this.setState({chatRoomVisible, padInfo})
  }

  hidePadChatRoom = () => {
    this.setState({chatRoomVisible: false})
  }

  render = () => {
    const {chatRoomVisible, padInfo} = this.state
    return (<div className="pad-edit-container">
      <TeamEditSideBar></TeamEditSideBar>
      <TeamEditPadList
        enterPadChatRoom = {this.enterPadChatRoom}
        hidePadChatRoom = {this.hidePadChatRoom}
        >
      </TeamEditPadList>
      {chatRoomVisible? <PadMessagePanel padInfo={padInfo}></PadMessagePanel>: null}
    </div>)
  }
}

export default TeamEditContainer