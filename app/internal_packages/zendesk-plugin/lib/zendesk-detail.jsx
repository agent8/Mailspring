import React, { Component } from 'react'
import fs from 'fs'
import path from 'path'
import Select, { Option } from 'rc-select'
import { remote } from 'electron'
import { DateUtils } from 'mailspring-exports'
import ZendeskApi from './zendesk-api'
const Zendesk = require('zendesk-node')
import { CSSTransitionGroup } from 'react-transition-group'
const cheerio = require('cheerio')
const { RetinaImg, LottieImg } = require('mailspring-component-kit')
const configDirPath = AppEnv.getConfigDirPath()
const jiraDirPath = path.join(configDirPath, 'zendesk_cache')
const { Menu, MenuItem } = remote
const CONFIG_KEY = 'plugin.zendesk.config'

export default class ZendeskDetail extends Component {
  constructor (props) {
    super(props)
    this.state = { allUsers: [] }
  }
  componentDidMount = async () => {
    this.mounted = true
    this.login(this.props.config)
    this.findTicket(this.props)
    // this.getCurrentUserInfo(this.props.config)
  }
  componentWillUnmount () {
    this.mounted = false
  }
  login = config => {
    if (config && Object.keys(config).length > 0) {
      const apiVersion = '2'
      if (config.access_token) {
        this.zendesk = new ZendeskApi({
          protocol: 'https',
          host: 'api.atlassian.com',
          base: `/ex/jira/${config.resource.id}`,
          bearer: config.access_token,
          refreshToken: config.refresh_token,
          method: 'POST',
          apiVersion,
          strictSSL: true,
        })
      } else {
        this.zendesk = new ZendeskApi({
          authType: Zendesk.AUTH_TYPES.API_TOKEN,
          zendeskSubdomain: config.subdomain,
          email: config.username,
          zendeskAdminToken: config.password,
        })
      }
    }
  }
  logout () {
    AppEnv.config.set(CONFIG_KEY, {})
  }
  getCurrentUserInfo = async config => {
    if (!config.currentUser) {
      try {
        const currentUser = await this.zendesk.getCurrentUser()
        console.log('****currentUser', currentUser)
        config.currentUser = currentUser
        AppEnv.config.set(CONFIG_KEY, config)
      } catch (err) {
        console.log('****getCurrentUserInfo failed', err)
        return
      }
    }
  }
  safeSetState = data => {
    if (this.mounted) {
      this.setState(data)
    }
  }
  componentWillReceiveProps (nextProps) {
    this.findTicket(nextProps)
  }
  _findTicketKey (messages) {
    for (const m of messages) {
      const match = m.body.match(/href="(https:\/\/edison\.zendesk\.com\/agent\/tickets\/(\d+))">/)
      console.log(' _findTicketKey match:', match)
      if (match) {
        return { ticketLink: match[1], ticketKey: +match[2] }
      }
    }
    return {}
  }
  findTicket = async props => {
    const { thread, messages } = props
    if (!thread) {
      return
    }

    const { ticketLink, ticketKey } = this._findTicketKey(messages)

    if (ticketLink) {
      if (ticketLink === this.ticketLink) {
        return
      }
      this.state
      let ticket = null
      this.safeSetState({
        ticketKey,
        loading: true,
        assignProgress: null,
        statusProgress: null,
        attachments: {},
        originalFiles: {},
        ticket: null,
        comments: [],
        commentLoading: true,
      })
      this.ticketLink = ticketLink
      try {
        console.log(' findTicket:', ticketKey)
        ticket = await this.zendesk.findTicket(ticketKey)
        console.log(' ticket:', ticket)
      } catch (err) {
        console.log(`****find ticket error ${ticketKey}`, err)
        AppEnv.reportError(new Error(`find ticket error ${ticketKey}`), { errorData: err })
        if (err.message && err.message.includes('invalid refresh token')) {
          this.logout()
        }
        const errorMessage = err.error && err.error.errorMessages && err.error.errorMessages[0]
        this.safeSetState({
          loading: false,
          ticket: null,
          errorMessage,
        })
        return
      }
      // download attachments
      if (ticket && ticket.fields.attachment) {
        this.downloadUri(ticket.fields.attachment, true)
        this.downloadUri(ticket.fields.attachment, false)
      }
      // get comments
      this.findComments(ticketKey)
      // get users
      if (this.state.allUsers.length === 0) {
        const users = await this.zendesk.searchAssignableUsers({
          ticketKey: ticketKey,
          maxResults: 500,
        })
        console.log(' searchAssignableUsers:', users)
        this.safeSetState({
          allUsers: users,
        })
        ticket.assignee = await this.zendesk.getUser(ticket.assigneeId)
        ticket.submitter = await this.zendesk.getUser(ticket.submitterId)
        console.log(' assignee submitter:', ticket.assignee, ticket.submitter)
        this.safeSetState({
          loading: false,
          ticket,
          link: ticketLink,
        })
      }
    }
  }
  findComments = async (ticketKey, shouldTransition) => {
    this.safeSetState({
      shouldTransition,
    })
    let rst = await this.zendesk.findComments(ticketKey)
    console.log(' findComments:', rst)
    this.safeSetState({
      comments: rst.comments,
      commentSaving: false,
      commentLoading: false,
    })
  }
  downloadUri = async (attachments, isThumbnail = true) => {
    let downloadApi = isThumbnail ? this.zendesk.downloadThumbnail : this.zendesk.downloadAttachment
    for (const attachment of attachments) {
      // Only download orginal image file
      if (!attachment.mimeType.includes('image') && !isThumbnail) {
        return
      }
      const localPath = path.join(
        jiraDirPath,
        `${isThumbnail ? '' : 'origin_'}${attachment.id}_${attachment.filename}`
      )
      if (!fs.existsSync(localPath)) {
        const downloadAtt = await downloadApi(attachment)
        fs.writeFileSync(localPath, downloadAtt)
      }
      const { attachments = {}, originalFiles = {} } = this.state
      if (isThumbnail) {
        attachments[attachment.id] = localPath
      } else {
        originalFiles[attachment.id] = localPath
      }
      this.safeSetState({
        attachments,
        originalFiles,
      })
    }
  }
  replaceImageSrc = html => {
    if (!html) {
      return ''
    }
    const { attachments } = this.state
    // replace image src
    html = html.replace(/<img\s+src=".*\/secure\/(attachment|thumbnail)\/.+?\//g, function (str) {
      const matchs = /<img\s+src=".*\/secure\/(attachment|thumbnail)\/(.+?)\//g.exec(str)
      // find if the image is downloaded.
      console.log('****matchs', matchs, attachments)
      const attachmentId = matchs[2]
      if (matchs && attachmentId && attachments[attachmentId]) {
        if (matchs[1] === 'thumbnail') {
          return `<img src="${jiraDirPath}/${attachmentId}_`
        }
        return `<img src="${jiraDirPath}/`
      }
      return `<img style='display: none;' src="${jiraDirPath}/`
    })
    // replace link href
    html = html.replace(/href="\/secure/g, `href="https://${this.zendesk.host}/secure`)
    return html
  }
  _renderComments = comments => {
    const { commentLoading } = this.state
    if (commentLoading) {
      return <div>{this._renderLoading(20)}</div>
    }
    return (
      <CSSTransitionGroup
        component='div'
        transitionEnterTimeout={350}
        transitionLeaveTimeout={350}
        transitionName={this.state.shouldTransition ? 'transition-slide' : ''}
      >
        {comments.map(item => (
          <div key={item.id} className='row'>
            <div className='comment-header'>
              {this.renderUserNode(item.author)}
              <span className='datetime'>{DateUtils.mediumTimeString(item.created)}</span>
            </div>
            <div
              dangerouslySetInnerHTML={{ __html: this.replaceImageSrc(item.renderedBody) }}
            ></div>
          </div>
        ))}
      </CSSTransitionGroup>
    )
  }
  selectFilter = (inputVal, option) => {
    return option.props.displayname.toLocaleLowerCase().indexOf(inputVal.toLocaleLowerCase()) !== -1
  }
  renderUserNode (userInfo) {
    return (
      <span className='zendesk-user'>
        {/* <img src={userInfo.avatarUrls['24x24']} /> */}
        <span>{userInfo.name}</span>
      </span>
    )
  }
  onAssigneeChange = async item => {
    AppEnv.trackingEvent('zendesk-Change-Assignee')
    try {
      this.safeSetState({
        assignProgress: 'loading',
      })
      console.log(' onAssigneeChange:', item)
      const { ticket } = this.state
      let res = await this.zendesk.updateTicketAssignee(ticket.id, item.key)
      console.log(' onAssigneeChange res:', res)
      this.safeSetState({
        assignProgress: 'success',
      })
      // this._showDialog('Change assignee successful.');
      AppEnv.trackingEvent('zendesk-Change-Assignee-Success')
    } catch (err) {
      AppEnv.trackingEvent('zendesk-Change-Assignee-Failed')
      console.error(`****Change assignee failed:`, err, item.name)
      AppEnv.reportError(new Error(`Change assignee failed ${ticket.id}`), { errorData: err })
      if (err.message && err.message.includes('invalid refresh token')) {
        this.logout()
      }
      this.safeSetState({
        assignProgress: 'error',
      })
    }
  }
  onStatusChange = async item => {
    console.log(' onStatusChange:', item)
    AppEnv.trackingEvent('zendesk-Change-Status')
    let { ticket } = this.state
    try {
      ticket.status = item.key
      const res = await this.zendesk.updateTicketStatus(ticket.id, item.key)
      console.log(' onStatusChange res:', res)
      this.safeSetState({
        statusProgress: 'success',
      })
      AppEnv.trackingEvent('zendesk-Change-Status-Success')
    } catch (err) {
      AppEnv.trackingEvent('zendesk-Change-Status-Failed')
      console.error(`****Change status failed ${ticket.id}`, err)
      AppEnv.reportError(new Error(`Change status failed ${ticket.id}`), { errorData: err })
      if (err.message && err.message.includes('invalid refresh token')) {
        this.logout()
      }
      this.safeSetState({
        statusProgress: 'error',
      })
    }
  }
  openAttachment = id => {
    const { attachments, originalFiles } = this.state
    const path = originalFiles[id] || attachments[id]
    const currentWin = AppEnv.getCurrentWindow()
    currentWin.previewFile(path)
  }
  addComment = async () => {
    const comment = this.commentInput.value
    if (!comment) {
      return
    }
    AppEnv.trackingEvent('zendesk-AddComment')
    try {
      this.safeSetState({
        commentSaving: true,
      })
      await this.zendesk.addComment(this.ticketKey, comment)
      this.findComments(this.ticketKey, true)
      this.commentInput.value = ''
      // this._showDialog('Add comment successful.');
      AppEnv.trackingEvent('zendesk-AddComment-Success')
    } catch (err) {
      console.error('****err', err)
      AppEnv.trackingEvent('zendesk-AddComment-Failed')
      if (err.message && err.message.includes('invalid refresh token')) {
        this.logout()
      }
      this._showDialog('Add comment failed.')
    }
  }
  _showDialog (message, type = 'info') {
    remote.dialog.showMessageBox({
      type,
      buttons: ['OK'],
      message,
    })
  }
  _renderLoading (width) {
    return (
      <LottieImg
        name='loading-spinner-blue'
        size={{ width, height: width }}
        style={{ margin: 'none', display: 'inline-block' }}
      />
    )
  }
  _renderProgress (progress) {
    let p = null
    if (progress === 'loading') {
      p = this._renderLoading(20)
    } else if (progress === 'success') {
      p = (
        <RetinaImg
          className='zendesk-success'
          style={{ width: 24 }}
          name={'check-alone.svg'}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      )
    } else if (progress === 'error') {
      p = (
        <RetinaImg
          className='zendesk-error'
          style={{ width: 24 }}
          name={'close.svg'}
          isIcon
          mode={RetinaImg.Mode.ContentIsMask}
        />
      )
    }
    return <span className='zendesk-progress'>{p}</span>
  }
  showMore = () => {
    this.menu = new Menu()

    let menuItem
    menuItem = new MenuItem({
      label: 'Logout',
      click: () => {
        this.logout()
        this.menu.closePopup()
      },
    })
    this.menu.append(menuItem)
    this.menu.popup({ x: event.clientX, y: event.clientY })
  }
  openOrignalImage = e => {
    const el = e.target
    if (el.tagName === 'IMG') {
      if (el.src.includes('jira_cache')) {
        const { attachments } = this.state
        for (const index in attachments) {
          if (el.src.includes(encodeURI(attachments[index]))) {
            this.openAttachment(index)
            break
          }
        }
      }
    }
  }
  render () {
    const {
      ticket,
      loading,
      commentSaving,
      assignProgress,
      statusProgress,
      attachments = {},
      comments = [],
      allUsers,
      ticketKey,
      transitions = ['Open', 'Pending', 'Solved'],
      errorMessage,
    } = this.state
    console.log(
      ' zendesk-detail.render:',
      this.state,
      ticket && ticket.assignee,
      ticket && ticket.submitter
    )
    if (loading) {
      return <div className='large-loading'>{this._renderLoading(40)}</div>
    }
    const { currentUser } = this.props.config
    const userLogo = (
      <div className='zendesk-current-user' onClick={this.showMore}>
        {currentUser && currentUser.avatarUrls ? (
          <img src={currentUser.avatarUrls && currentUser.avatarUrls['48x48']} />
        ) : (
          <RetinaImg name={'jira.svg'} isIcon mode={RetinaImg.Mode.ContentIsMask} />
        )}
      </div>
    )
    if (!ticket || !ticket.assignee || !ticket.submitter) {
      return (
        <div className='zendesk-detail'>
          {userLogo}
          <div className='error'>{errorMessage}</div>
        </div>
      )
    }
    console.log(' zendesk-detail.render 2:', this.state)
    const status = ticket.status
    const assgineeOptions = allUsers.map((item, idx) => (
      <Option key={item.name} displayname={item.name} value={item.id}>
        {this.renderUserNode(item)}
      </Option>
    ))
    const transitionOptions = transitions.map(item => (
      <Option key={item} value={item}>
        {item}
      </Option>
    ))
    const statusKey = 'status:' + status
    transitionOptions.push(
      <Option key={statusKey} value={statusKey}>
        {status}
      </Option>
    )
    console.log(' ticket.assignee, ticket.submitter:', ticket.assignee, ticket.submitter)
    return (
      <div className='zendesk-detail'>
        {userLogo}
        <div className='zendesk-title'>
          <a href={this.state.link}>{ticketKey}</a>
        </div>
        <div className='wrapper'>
          <header>
            <div>
              <span className='label'>Assignee</span>
              <div className='content with-progress'>
                <Select
                  ref={el => (this.assignee = el)}
                  className='assign-users'
                  defaultValue={{
                    key: ticket.assignee.name,
                    value: this.renderUserNode(ticket.assignee),
                  }}
                  optionLabelProp='children'
                  filterOption={this.selectFilter}
                  labelInValue={true}
                  notFoundContent=''
                  showSearch={true}
                  onChange={this.onAssigneeChange}
                  dropdownClassName='zendesk-dropdown'
                >
                  {assgineeOptions}
                </Select>
                {this._renderProgress(assignProgress)}
              </div>
            </div>
            <div>
              <span className='label'>Submitter</span>
              <span className='content'>
                {ticket.submitter && this.renderUserNode(ticket.submitter)}
              </span>
            </div>
            <div>
              <span className='label'>Priority</span>
              <span className='content'>{ticket.priority}</span>
            </div>
            <div>
              <span className='label'>Status</span>
              <div className='content with-progress'>
                <Select
                  className='zendesk-status'
                  value={{ key: statusKey, value: status }}
                  optionLabelProp='children'
                  labelInValue={true}
                  notFoundContent=''
                  showSearch={false}
                  onChange={this.onStatusChange}
                  dropdownClassName='zendesk-dropdown'
                >
                  {transitionOptions}
                </Select>
                {this._renderProgress(statusProgress)}
              </div>
            </div>
          </header>
          <div className='zendesk-description' onClick={this.openOrignalImage}>
            <span className='label'>Description</span>
            <div
              dangerouslySetInnerHTML={{ __html: this.replaceImageSrc(ticket.description) }}
            ></div>
          </div>
          <div className='zendesk-comments' onClick={this.openOrignalImage}>
            <span className='label'>Comments</span>
            {this._renderComments(comments)}
          </div>
          {/* <div className='zendesk-attachments'>
            <span className='label'>Attachments</span>
            <div className='attachments'>
              {fields.attachment.map(item => (
                <div
                  title={item.filename}
                  key={item.id}
                  onClick={() => this.openAttachment(item.id)}
                >
                  {attachments[item.id] ? (
                    <img src={attachments[item.id]} />
                  ) : (
                    this._renderLoading(20)
                  )}
                </div>
              ))}
            </div>
          </div> */}
        </div>
        <div className='zendesk-submit-comment'>
          <textarea ref={el => (this.commentInput = el)}></textarea>
          {commentSaving ? (
            this._renderLoading(20)
          ) : (
            <button className='btn btn-jira' onClick={this.addComment}>
              Add Comment
            </button>
          )}
        </div>
      </div>
    )
  }
}
