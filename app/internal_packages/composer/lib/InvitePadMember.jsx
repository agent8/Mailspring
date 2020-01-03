import React, { Component } from 'react'
import { RetinaImg } from 'mailspring-component-kit'
import Select, { Option } from 'rc-select'
import { ContactStore, AppStore, ContactAvatar, Button } from 'chat-exports'
import keyMannager from '../../../src/key-manager'
import { postAsync } from '../../edison-beijing-chat/utils/httpex'
// import axios from 'axios'
const { AccountStore, DraftStore } = require('mailspring-exports')

export default class InvitePadMember extends Component {
  static displayName = 'InvitePadMember'

  constructor () {
    super()
    this.state = {
      members: [],
      contacts: [],
      loading: true,
    }
    this._mounted = false
  }

  componentWillMount () {
    this.initContacts()
    this.setState({ visible: this.props.visible })
  }

  UNSAFE_componentWillReceiveProps (nextProps) {
    this.setState({ visible: nextProps.visible })
  }

  componentDidMount () {
    this._mounted = true
    this.unsub = AppStore.listen(() => {
      this.initContacts()
    })
    const select_container = document.querySelector('.rc-select-dropdown')
    if (select_container) {
      select_container.style.top = '180px'
    }
    window.addEventListener('resize', this.setUlListPosition)
  }

  initContacts = async () => {
    const contacts = await ContactStore.getContacts()
    if (this._mounted) {
      this.setState({ contacts, loading: false })
    }
  }

  componentWillUnmount () {
    this._mounted = false
    window.removeEventListener('resize', this.setUlListPosition)
    this.unsub()
  }

  componentDidUpdate (prevProps, prevState, snapshot) {
    if (this.state.members.length !== prevState.members.length) {
      this.setUlListPosition()
    }

    setTimeout(this._setDropDownHeight, 1)
  }

  isMe (email) {
    return !!AccountStore.accountForEmail(email)
  }

  setUlListPosition () {
    const container = document.querySelector('#contact-select')
    const ulList = document.querySelector('#contact-select ul')
    if (container && ulList) {
      const widthDiff =
        ulList.getBoundingClientRect().width - container.getBoundingClientRect().width
      if (widthDiff <= 0) {
        ulList.setAttribute('style', 'margin-left: 0')
      } else {
        ulList.setAttribute('style', `margin-left: -${widthDiff + 20}px`)
      }
    }
  }

  _setDropDownHeight () {
    const dropDown = document.querySelector('.rc-select-dropdown')
    if (dropDown) {
      const offsetTop = dropDown.offsetTop
      dropDown.style.maxHeight = `calc(100vh - ${offsetTop + 5}px)`
    }
  }

  handleChange = (_, options) => {
    const members = options.map(item => ({
      name: item.props.label,
      jid: item.props.jid,
      curJid: item.props.curjid,
      email: item.props.email,
    }))
    this.setState(
      {
        members,
      },
      () => {
        document.querySelector('#contact-select input').focus()
      }
    )
  }

  InvitePadMember = async () => {
    const { members } = this.state
    const { draft, padInfo } = this.props
    if (!members || members.length === 0) {
      return
    }
    const from = padInfo.email
    let token = await keyMannager.getAccessTokenByEmail(from)
    const permission = 'edit'
    const coworkers = members.map(member => {
      const jid = member.jid
      const at = jid.indexOf('@')
      const userId = jid.substring(0, at)
      return { userId, permission }
    })
    const editMembersOptions = {
      userId: padInfo.userId,
      token,
      padID: padInfo.padId,
      add: coworkers,
    }
    console.log(' editMembersOptions: ', editMembersOptions)
    const apiPath = window.teamPadConfig.teamEditAPIUrl + 'editMembers'
    console.log(' InvitePadMember, apiPath, editMembersOptions: ', apiPath, editMembersOptions)
    let res = await postAsync(apiPath, editMembersOptions)
    if (typeof res === 'string') {
      res = JSON.parse(res)
    }
    console.log(' InvitePadMember, res: ', res)
    if (!res || res.code !== 0) {
      alert('fail to add edit members for the pad.')
      return
    }
    const { padId } = padInfo
    for (let member of members) {
      const jid = member.jid
      if (!jid) {
        continue
      }
      const at = jid.indexOf('@')
      const userId = jid.substring(0, at)
      const url = `edisonmail://teamedit.edison.tech/${draft.headerMessageId}?padId=${padId}&inviterEmail=${from}&userId=${userId}&userName=${member.name}&email=${member.email}`
      const to = [member.email]
      const cc = []
      await DraftStore.createAndSendMessage({
        subject: 'invitation to write email together',
        body: `I want to invite you to edit an email together. To open the team editor for the email,
        please open this message in EdisonMail App,
        and then click the link to <a href="${url}">the team editor for the email</a>`,
        to,
        cc,
        from,
        draft,
      })
    }

    this._close()
  }

  _close = () => {
    this.props.hideInvitePadMember()
  }

  onKeyUp = event => {
    if (event.keyCode === 27) {
      // ESC
      this._close()
      event.stopPropagation()
      event.preventDefault()
    }
  }

  focusIntoInput = () => {
    document.querySelector('#contact-select').focus()
    document.querySelector('#contact-select input').focus()
  }

  render () {
    const { members, contacts, loading, visible } = this.state

    if (!visible) {
      return null
    }

    const children = contacts.map((contact, index) => (
      <Option
        key={contact.jid}
        jid={contact.jid}
        curjid={contact.curJid}
        value={contact.name + contact.email}
        email={contact.email}
        label={contact.name}
      >
        <div className='chip'>
          <ContactAvatar jid={contact.jid} name={contact.name} email={contact.email} size={32} />
          <span className='contact-name'>{contact.name}</span>
          <span className='contact-email'>{contact.email}</span>
        </div>
      </Option>
    ))
    return (
      <div className='invite-member-popup'
        tabIndex={1}
        onKeyUp={this.onKeyUp}>
        <div  className='invite-member-panel'>
          <div className='to'>
            <span className='close' onClick={this.props.hideInvitePadMember}>
              <RetinaImg
                name={'close_1.svg'}
                style={{ width: 24, height: 24 }}
                isIcon
                mode={RetinaImg.Mode.ContentIsMask}
              />
            </span>
            <span className='new-message-title'>Invite Pad Member</span>
          </div>
          <div
            ref={el => {
              this.contactInputEl = el
            }}
            style={{ display: 'flex' }}
            onClick={this.focusIntoInput}
            className='contact-select-wrapper'
          >
            <Select
              mode='tags'
              id='contact-select'
              style={{ width: '400px', flex: 1, height: '70px' }}
              onChange={this.handleChange}
              onSelect={this.focusIntoInput}
              defaultOpen
              multiple
              autoFocus
              open
              placeholder='Find a contact or enter an email'
              tokenSeparators={[',']}
              optionLabelProp='label'
              loading={loading}
            >
              {children}
            </Select>
            <Button
              className={`btn go ${members.length === 0 ? 'btn-disabled' : ''}`}
              onClick={this.InvitePadMember}
            >
              Go
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
