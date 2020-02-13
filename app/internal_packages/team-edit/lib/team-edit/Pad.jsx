import React, { Component } from 'react';
import { RetinaImg } from 'mailspring-component-kit';
import Button from '../../../edison-beijing-chat/components/common/Button';
import { ipcRenderer, remote } from 'electron';
const {Menu, getCurrentWindow} = remote
import Actions from '../../../../src/flux/actions'
import PadStore from './PadStore'
import {WorkspaceStore} from 'mailspring-exports'
import { ChatActions, ConversationStore } from 'chat-exports'
import InvitePadMember from '../InvitePadMember'

export default class Pad extends Component {
  static displayName = 'Pad';
  state = {};
  componentWillMount = async () => {
    await this.updateStateFromProps(this.props)
    ipcRenderer.on('update-padroom-message', this.onPadRoomUpdateMessage)
  }
  componentWillUnmount = () => {
    ipcRenderer.removeListener('update-padroom-message', this.onPadRoomUpdateMessage)
  }
  UNSAFE_componentWillReceiveProps = async (nextProps) => {
    await this.updateStateFromProps(nextProps)
  }
  onPadRoomUpdateMessage = async (event, convJid) => {
    const {pad} = this.props
    if (convJid.includes(pad.chatRoomId)) {
      console.log( 'onPadRoomUpdateMessage: matched:', convJid)
      await this.updateStateFromProps(this.props)
      console.log( 'onPadRoomUpdateMessage: matched 2:', this.state)
    }
  }
  updateStateFromProps = async (props) => {
    const { pad } = this.props
    let {emaiOri} = pad
    if (typeof emaiOri === 'string') {
      try {
        emaiOri = JSON.parse(emaiOri)
      } catch(e) {
        emaiOri = {}
      }
    }
    if (typeof emaiOri === 'string') {
      try {
        emaiOri = JSON.parse(emaiOri)
      } catch(e) {
        emaiOri = {}
      }
    }
    const ownerEmail = pad.ownerEmail
    const subject = emaiOri && emaiOri.subject || ''
    const from = emaiOri && emaiOri.from || []
    const to = emaiOri && emaiOri.to || []
    const {status} = pad
    const unreadMessages = await this.getUnreadChatMessages(props)
    this.setState({subject, status, ownerEmail, unreadMessages, from, to})
  }

  getUnreadChatMessages = async (props) => {
    const {pad} = props
    const convJid = pad.chatRoomId + '@muc.im.edison.tech'
    const conv = await ConversationStore.getConversationByJid(convJid)
    if (!conv) {
      return
    }
    return conv.unreadMessages
  }

  showMenu = () => {
    const menus = [
      {
        label: `Open edit pad`,
        click: this.OpenEditPad,
      },
      {
        label: `Invite member`,
        click: this.inviteMember,
      },
      {
        label: `Remove member`,
        click: this.removeMember,
      },
      {
        label: `Enter chat room`,
        click: this.enterChatRoom,
      }
      ,
      {
        label: `hide chat room`,
        click: this.hidePadChatRoom,
      }
    ];
    const win = getCurrentWindow()
    this.menu = Menu.buildFromTemplate(menus)
    this.menu.popup(win);
  };

  OpenEditPad = () => {
    const {pad} = this.props
    const padInfo = {
      padId: pad.id,
      email: PadStore.email,
      userId: PadStore.userId,
      token: PadStore.token
    }
    PadStore.setPad(pad)
    Actions.popoutTeamEditor(padInfo)
  }

  inviteMember = () => {
    this.setState({inviteVisible: true})
  }

  hideInvitePadMember = () => {
    this.setState({inviteVisible: false})
  }
  removeMember = () => {
  }
  enterChatRoom = async (event) => {
    console.log( 'Pad.enterChatRoom:', this.props)
    const {pad, enterPadChatRoom} = this.props
    await enterPadChatRoom(pad)
    const convJid = pad.chatRoomId + '@muc.im.edison.tech'
    const conv = await ConversationStore.getConversationByJid(convJid)
    const {userId} = PadStore
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
      console.log('create pad conv: ', payload)
    }
    // ipcRenderer.send('command', 'application:show-main-window');
    // ipcRenderer.send('command', 'application:select-conversation', convJid);
  }
  hidePadChatRoom = () => {
    const {hidePadChatRoom} = this.props
    hidePadChatRoom()
  }

  render () {
    const {pad} = this.props
    let {subject, status, ownerEmail, from, to, inviteVisible, unreadMessages} = this.state
    let padInfo = {
      padId: pad.id,
      email:PadStore.email,
      userId: PadStore.userId,
      token: PadStore.token
    }
    const unreadMessageStr = unreadMessages == undefined ? '' : ''+unreadMessages
    const unReadBadge = (unreadMessageStr ? <span className='pad-badge' onClick={this.enterChatRoom}>{unreadMessageStr}</span>: null)
    from = from && from.join(', ') ||''
    to = to && to.join(', ') ||''
    const summary = `name:${pad.name}, owner:${ownerEmail}, from:[${from}], to:[${to}]`
    return (<div className='team-edit-pad' key={pad.id}>
      <div>
        <span className='pad-head'  onClick={this.OpenEditPad}>&#x25AA;</span>
        <span className='pad-title' onClick={this.OpenEditPad}>
        <label> Title: </label>
        <span>{subject}</span>
        </span>
        {unReadBadge}
        <Button className="more" onClick={this.showMenu}></Button>
      </div>
      <div>
        <label> status: </label>
        <span>{status===1?'Finished':'Unfinished'}</span>
      </div>
      <div>
        <label> summary: {summary}</label>
        <span></span>
      </div>
      <InvitePadMember
          visible={inviteVisible}
          padInfo={padInfo}
          hideInvitePadMember={this.hideInvitePadMember}
        />
    </div>)
  }
}
