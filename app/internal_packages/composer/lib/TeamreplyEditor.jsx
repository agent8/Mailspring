import React, { Component } from 'react'
import keyMannager from '../../../src/key-manager'
import InvitePadMember from './InvitePadMember'

export default class TeamreplyEditor extends Component {
  state = {}

  constructor (props) {
    super(props)
  }
  showInvitePadMember = () => {
    this.setState({ inviteVisible: true })
  }

  render () {
    const { padInfo } = this.props
    const { inviteVisible } = this.state
    const { draft } = this.props
    if (!padInfo) {
      return <div>No edit pad information found for this email!</div>
    }
    const { padId, userId, userName, token } = padInfo
    if (!padId) {
      return <div> Can not get AND create proper edit pad for this email!</div>
    }
    return (
      <div className='teamreply-editor-container'>
        <iframe
          className='teamreply-editor'
          src={`http://0.0.0.0:8080/p/${padId}?userId=${userId}&userName=${userName}&token=${token}`}
        />
        <div className='teamreply-editor-invite-btn' onClick={this.showInvitePadMember}>
          Invite
        </div>
        <InvitePadMember visible={inviteVisible} padInfo={padInfo} draft={draft} />
      </div>
    )
  }
}
