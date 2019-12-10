import React, { Component } from 'react'
import path from 'path'
import keyMannager from '../../../src/key-manager'
import InvitePadMember from './InvitePadMember'
import { loadPadInfo, savePadInfo } from './app-pad-data'
window.padMap = {}
export default class TeamreplyEditor extends Component {
  state = {}

  constructor (props) {
    super(props)
  }
  componentWillMount = async () => {
    const { updatePadFiles } = this.props
    let { padInfo } = this.props
    loadPadInfo(padInfo)
    savePadInfo(padInfo)
    this.updatePadFiles = updatePadFiles
    const { email } = padInfo
    const token = await keyMannager.getAccessTokenByEmail(email)
    padInfo.token = token
    this.setState({ padInfo })
    console.log(' TeamreplyEditor.componentWillMount: padInfo: ', padInfo, this.props.padInfo)
    window.composerOnPadSocketHandler = this.composerOnPadSocketHandler
    window.composerOnPadConnect = this.composerOnPadConnect
  }
  UNSAFE_componentWillReceiveProps (nextProps) {
    const { padInfo } = nextProps
    this.setState({ padInfo })
  }
  componentDidMount = async () => {
    const pad = window.pad
    setTimeout(() => {
      console.log(' TeamreplyEditor.componentDidMount: pad: ', pad)
    }, 10)
  }
  composerOnPadConnect = data => {
    console.log(' composerOnPadConnect: data:  ', data)
    const { pad, query } = data
    window.padMap[query.padId] = pad
  }
  composerOnPadSocketHandler = async data => {
    console.log(' onComposerPadSocketHandler: data: ', data)
    const { padInfo } = this.props
    const { padId } = padInfo
    if (!data) {
      return
    }
    if (data.type === 'CLIENT_VARS') {
      // console.log(' composerOnPadSocketHandler: CLIENT_VARS: ', data)
    } else if (data.type === 'COLLABROOM' && data.data && data.data.type === 'EMAIL_EXTR') {
      // console.log(' composerOnPadSocketHandler: COLLABROOM: EMAIL_EXTR: ', data)
      const email = data.data.email
      const files = email.attachments
      const fileMap = padInfo.files || {}
      for (const name of files) {
        const file = fileMap[name] || {}
        if (!file.downloadPath) {
          file.downloadPath = await downloadPadFile(name)
          file.filename = getAwsOriginalFilename(file)
        }
        fileMap[name] = file
      }
      this.updatePadFiles(fileMap)
    }
  }
  showInvitePadMember = () => {
    this.setState({ inviteVisible: true })
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
    const cwd = process.cwd()
    const htmlPath = path.join(cwd, 'app/internal_packages/composer/teamreply-client/src/html/pad.html')
    return (
      <div className='teamreply-editor-container'>
        <iframe
          className='teamreply-editor'
          src={`${htmlPath}?padId=${padId}&userId=${userId}&userName=${userName}&token=${token}`}
        />
        <div className='teamreply-editor-invite-btn' onClick={this.showInvitePadMember}>
          Invite
        </div>
        <InvitePadMember visible={inviteVisible} padInfo={padInfo} draft={draft} />
      </div>
    )
  }
}
