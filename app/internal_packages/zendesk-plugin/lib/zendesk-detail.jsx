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
const zendeskDirPath = path.join(configDirPath, 'zendesk_cache')
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
  }
  componentWillUnmount () {
    this.mounted = false
  }
  login = config => {
    if (config && Object.keys(config).length > 0) {
      this.zendesk = new ZendeskApi(config)
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
    if (!data.followerError) {
      data.followerError = ''
    }
    if (this.mounted) {
      this.setState(data)
    }
  }
  componentWillReceiveProps (nextProps) {
    this.findTicket(nextProps)
  }
  _findTicketKey (messages) {
    for (const m of messages) {
      const match = m.body.match(
        /href=["'](https:\/\/\w+\.zendesk\.com\/agent\/tickets\/(\d+))["']/
      )
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
        ticket = await this.zendesk.findTicket(ticketKey)
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
      if (this.state.allUsers.length === 0) {
        const users = await this.zendesk.searchAssignableUsers({
          ticketKey: ticketKey,
          maxResults: 500,
        })
        this.safeSetState({
          allUsers: users,
        })
      }
      this.safeSetState({ loading: false, commentLoading: true })
      ticket.assignee = await this.zendesk.getUser(ticket.assigneeId)
      this.safeSetState({
        loading: false,
        ticket,
        link: ticketLink,
      })
      ticket.submitter = await this.zendesk.getUser(ticket.submitterId)
      ticket.followers = []
      for (let id of ticket.followerIds) {
        const follower = await this.zendesk.getUser(id)
        ticket.followers.push(follower)
      }
      console.log(
        ' assignee submitter ticket.followers:',
        ticket.assignee,
        ticket.submitter,
        ticket.followers
      )
      this.safeSetState({
        loading: false,
        ticket,
        link: ticketLink,
      })
      await this.getComments(ticket)
      return
    }
  }
  getComments = async ticket => {
    const comments = await this.zendesk.getComments(ticket)
    this.safeSetState({
      loading: false,
      commentLoading: false,
    })
    for (let item of comments) {
      item.author = await this.zendesk.getUser(item.authorId)
    }
    ticket.comments = comments
    this.safeSetState({
      loading: false,
      commentLoading: false,
    })
  }
  selectFilter = (inputVal, option) => {
    return option.props.displayname.toLocaleLowerCase().indexOf(inputVal.toLocaleLowerCase()) !== -1
  }
  renderUserNode (userInfo) {
    return (
      <span className='zendesk-user'>
        {/* <img src={userInfo.avatarUrls['24x24']} /> */}
        <span>{userInfo && userInfo.name}</span>
      </span>
    )
  }
  onAssigneeChange = async item => {
    await this.asyncUpdateField('assignee', item.key, 'assignee_id')
  }
  onPriorityChange = async item => {
    await this.asyncUpdateField('priority', item.key)
  }
  onTypeChange = async item => {
    await this.asyncUpdateField('type', item.key)
  }
  onStatusChange = async item => {
    await this.asyncUpdateField('status', item.key)
  }
  onAddTag = async event => {
    const tag = this.tagInput.value
    const { ticket } = this.state
    var tags = ticket.tags
    tags.push(tag)
    await this.asyncUpdateField('tags', tags)
  }
  onRemoveTag = async index => {
    const { ticket } = this.state
    var tags = ticket.tags
    tags.splice(index, 1)
    await this.asyncUpdateField('tags', tags)
  }
  onRemoveFollower = async index => {
    const { ticket } = this.state
    var followerIds = ticket.followerIds
    followerIds.splice(index, 1)
    let followers = ticket.followers
    followers.splice(index, 1)
    const submitFollowers = followers.map(item => ({ user_email: item.email }))
    await this.asyncUpdateField('followers', submitFollowers)
  }
  onAddFollower = async event => {
    const email = this.followerInput.value
    if (!email) {
      return
    }
    const { ticket } = this.state
    var followers = ticket.followers
    let follower = await this.zendesk.getUserByEmail(email)
    if (!follower) {
      this.setState({ followerError: `no user with email: ${email}` })
      return
    }
    followers.push(follower)
    const submitFollowers = followers.map(item => ({ user_email: item.email }))
    await this.asyncUpdateField('followers', submitFollowers)
  }
  addComment = async () => {
    const commentContent = this.commentInput.value
    console.log('add comment:', commentContent, this.zendesk)
    const email = this.zendesk.authEmail
    const user = this.zendesk.getUserByEmail(email)
    const comment = { body: commentContent, author_id: user.id }
    this.asyncUpdateField('comment', comment)
    const { ticket } = this.state
    comment.author = await this.zendesk.getUserByEmail(email)
    comment.createdAt = new Date()
    comment.htmlBody = commentContent
    ticket.comments.unshift(comment)
    this.commentInput.value = ''
    this.setState({ ticket })
  }
  asyncUpdateField = async (name, value, field) => {
    field = field || name
    const upperName = name[0].toUpperCase() + name.substring(1)
    AppEnv.trackingEvent(`zendesk-Change-${upperName}`)
    let { ticket } = this.state
    ticket[name] = value
    try {
      this.safeSetState({
        [`${field}Progress`]: 'loading',
      })
      await this.zendesk.updateTicketField(ticket, field, value)
      this.safeSetState({
        [`${field}Progress`]: 'success',
      })
      AppEnv.trackingEvent('zendesk-Change-Tags-Success')
    } catch (err) {
      AppEnv.trackingEvent(`zendesk-Tags-${upperName}-Failed`)
      console.error(`****Change tags failed: ${ticket.id}:`, err)
      AppEnv.reportError(new Error(`Change ${field} failed: ${ticket.id}:`), { errorData: err })
      if (err.message && err.message.includes('invalid refresh token')) {
        this.logout()
      }
      this.safeSetState({
        [`${field}Progress`]: 'error',
      })
    }
  }

  openAttachment = id => {
    const { attachments, originalFiles } = this.state
    const path = originalFiles[id] || attachments[id]
    const currentWin = AppEnv.getCurrentWindow()
    currentWin.previewFile(path)
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
      if (el.src.includes('zendesk_cache')) {
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

  renderComments = comments => {
    const { commentLoading } = this.state
    if (commentLoading) {
      return <div>{this._renderLoading(20)}</div>
    }
    if (!comments) {
      return null
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
              <span className='datetime'>{DateUtils.mediumTimeString(item.createdAt)}</span>
            </div>
            <div dangerouslySetInnerHTML={{ __html: item.htmlBody }}></div>
          </div>
        ))}
      </CSSTransitionGroup>
    )
  }

  render () {
    const {
      ticket,
      loading,
      assignProgress,
      allUsers,
      ticketKey,
      priorityProgress,
      typeProgress,
      statusProgress,
      tagsProgress,
      errorMessage,
      followersProgress,
      commentProgress,
      followerError,
      commentSaving,
    } = this.state
    if (loading) {
      return <div className='large-loading'>{this._renderLoading(40)}</div>
    }
    const { currentUser } = this.props.config
    const userLogo = (
      <div className='zendesk-current-user' onClick={this.showMore}>
        {currentUser && currentUser.avatarUrls ? (
          <img src={currentUser.avatarUrls && currentUser.avatarUrls['48x48']} />
        ) : (
          <RetinaImg name={'zendesk.svg'} isIcon mode={RetinaImg.Mode.ContentIsMask} />
        )}
      </div>
    )
    if (!ticket) {
      // || !ticket.assignee || !ticket.submitters
      return (
        <div className='zendesk-detail'>
          {userLogo}
          <div className='error'>{errorMessage}</div>
        </div>
      )
    }
    const description = ticket.description.replace('\n', '<br/>')
    const status = ticket.status
    const assgineeOptions = allUsers.map((item, idx) => (
      <Option key={item.name} displayname={item.name} value={item.id}>
        {this.renderUserNode(item)}
      </Option>
    ))
    const priorityOptions = ['low', 'normal', 'high', 'urgent'].map(item => (
      <Option key={item} value={item}>
        {item}
      </Option>
    ))
    const typeOptions = ['question', 'incident', 'problem', 'task'].map(item => (
      <Option key={item} value={item}>
        {item}
      </Option>
    ))
    const statusOptions = ['open', 'pending', 'solved'].map(item => (
      <Option key={item} value={item}>
        {item}
      </Option>
    ))
    const statusKey = 'status:' + status
    statusOptions.push(
      <Option key={statusKey} value={statusKey}>
        {status}
      </Option>
    )
    const ticketFollwers = ticket.followers || []
    const followers = ticketFollwers.map((item, index) => {
      return (
        <span className='piece' key={index}>
          <span>{item.email || item.user_email}</span>
        </span>
      )
    })
    var tags = ticket.tags.map((item, index) => {
      return (
        <span className='piece' key={index}>
          <span>{item}</span>
          <RetinaImg
            isIcon
            name='close.svg'
            className='remove-tag'
            mode={RetinaImg.Mode.ContentIsMask}
            onClick={() => this.onRemoveTag(index)}
          />
        </span>
      )
    })
    return (
      <div className='zendesk-detail'>
        {userLogo}
        <div className='zendesk-title'>
          <a href={this.state.link}>ticket {ticketKey}</a>
        </div>
        <div className='wrapper'>
          <header>
            <div>
              <span className='label'>Assignee</span>
              <div className='content with-progress'>
                <span>{ticket.assignee && ticket.assignee.name}</span>
              </div>
            </div>
            <div>
              <span className='label'>Submitter</span>
              <span className='content'>
                {ticket.submitter && this.renderUserNode(ticket.submitter)}
              </span>
            </div>
            <div>
              <span className='label'>Followers</span>
              <div>{followers}</div>
            </div>
            <div>
              <span className='label'>Priority</span>
              <div className='content with-progress'>
                <Select
                  className='zendesk-status'
                  value={{ key: ticket.priority, value: ticket.priority }}
                  optionLabelProp='children'
                  labelInValue={true}
                  notFoundContent=''
                  showSearch={false}
                  onChange={this.onPriorityChange}
                  dropdownClassName='zendesk-dropdown'
                >
                  {priorityOptions}
                </Select>
                {this._renderProgress(priorityProgress)}
              </div>
            </div>
            <div>
              <span className='label'>Type</span>
              <div className='content with-progress'>
                <Select
                  className='zendesk-status'
                  value={{ key: ticket.type, value: ticket.type }}
                  optionLabelProp='children'
                  labelInValue={true}
                  notFoundContent=''
                  showSearch={false}
                  onChange={this.onTypeChange}
                  dropdownClassName='zendesk-dropdown'
                >
                  {typeOptions}
                </Select>
                {this._renderProgress(typeProgress)}
              </div>
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
                  {statusOptions}
                </Select>
                {this._renderProgress(statusProgress)}
              </div>
            </div>
            <div>
              <span className='label'>Tags</span>
              <div>{tags}</div>
              <input
                style={{ width: '60px' }}
                ref={el => {
                  this.tagInput = el
                }}
              ></input>
              <RetinaImg
                className='change-done'
                style={{ width: 16 }}
                name={'check-alone.svg'}
                isIcon
                mode={RetinaImg.Mode.ContentIsMask}
                onClick={this.onAddTag}
              />
              {this._renderProgress(tagsProgress)}
            </div>
          </header>
          <div className='zendesk-description' onClick={this.openOrignalImage}>
            <span className='label'>Description</span>
            <div dangerouslySetInnerHTML={{ __html: description }}></div>
          </div>
          <div className='zendesk-comments' onClick={this.openOrignalImage}>
            <span className='label'>Comments</span>
            {this.renderComments(ticket.comments)}
          </div>
          <div className='zendesk-submit-comment'>
            <textarea ref={el => (this.commentInput = el)}></textarea>
            {commentSaving ? (
              this._renderLoading(20)
            ) : (
              <button className='btn btn-zendesk' onClick={this.addComment}>
                Add Comment
              </button>
            )}
            {this._renderProgress(commentProgress)}
          </div>
        </div>
      </div>
    )
  }
}
