import React, { Component } from 'react'
import path from 'path'
import fs from 'fs'
import keyMannager from '../../../src/key-manager'
import InvitePadMember from './InvitePadMember'
import PadMessagePanel from './team-edit/PadMessagePanel'
import { loadPadInfo, savePadInfo } from './app-pad-data'

window.padMap = {}
export default class TeamreplyEditor extends Component {
  state = {}

  constructor (props) {
    super(props)
  }
  componentWillMount = async () => {
    const { updatePadInfo } = this.props
    let { padInfo } = this.props
    loadPadInfo(padInfo)
    savePadInfo(padInfo)
    this.updatePadInfo = updatePadInfo
    const { email } = padInfo
    const token = await keyMannager.getAccessTokenByEmail(email)
    padInfo.token = token
    this.setState({ padInfo })
  }
  UNSAFE_componentWillReceiveProps (nextProps) {
    const { padInfo } = nextProps
    this.setState({ padInfo })
  }
  componentDidMount = async () => {
    const pad = window.pad
    setTimeout(() => {}, 10)
  }

  showInvitePadMember = () => {
    this.setState({ inviteVisible: true })
  }

  hideInvitePadMember = () => {
    this.setState({ inviteVisible: false })
  }

  render () {
    const { padInfo, inviteVisible } = this.state
    const { draft } = this.props
    if (!padInfo) {
      return <div>No edit pad information found for this email!</div>
    }
    const { padId, userId, userName, token } = padInfo
    if (!padId) {
      return <div> Can not get AND create proper edit pad for this email!</div>
    }
    const cwd = AppEnv.getLoadSettings().resourcePath
    let relPath = 'internal_packages/team-edit/teamreply-client/src/html/pad.html'
    if (cwd.endsWith('/Resources/app.asar')) {
      relPath = '../app.asar.unpacked/' + relPath
    }
    let htmlPath = path.join(cwd, relPath)
    const { resourcePath } = AppEnv.getLoadSettings()
    if (!fs.existsSync(htmlPath)) {
      htmlPath = path.join(
        resourcePath,
        './internal_packages/composer/teamreply-client/src/html/pad.html'
      )
      console.log('exist pad.html: ', fs.existsSync(htmlPath))
    }

    return (
      <div className='teamreply-editor-container'>
        <iframe
          className='teamreply-editor'
          src={`${htmlPath}?padId=${padId}&userId=${userId}&userName=${userName}&token=${token}`}
        />
        <div className='teamreply-editor-invite-btn' onClick={this.showInvitePadMember}>
          Invite
        </div>
        <InvitePadMember
          visible={this.state.inviteVisible}
          padInfo={padInfo}
          draft={draft}
          hideInvitePadMember={this.hideInvitePadMember}
        />
        <PadMessagePanel padInfo={padInfo}></PadMessagePanel>
      </div>
    )
  }
}
