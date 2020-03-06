import React, { Component } from 'react'
const { RetinaImg } = require('mailspring-component-kit')
const { AccountStore } = require('mailspring-exports')
const ZENDESK_SHOW_KEY = 'plugin.zendesk.show'
import { MessageStore } from 'mailspring-exports'
export default class ZendeskToolbarButton extends Component {
  static displayName = 'ZendeskToolbarButton'
  constructor (props) {
    super(props)
    this.state = {
      active: !!AppEnv.config.get(ZENDESK_SHOW_KEY),
    }
  }
  toggleZendesk = () => {
    const newStatus = !!!AppEnv.config.get(ZENDESK_SHOW_KEY)
    AppEnv.config.set(ZENDESK_SHOW_KEY, newStatus)
    this.setState({
      active: newStatus,
    })
  }
  componentWillMount = async () => {
    this.state.isZendesk = await this._isZendesk()
  }
  fetchMessages = async () => {
    const { thread } = this.props
    const query = MessageStore.findAllByThreadIdWithBody({ threadId: thread.id })
    return await query
  }
  _isZendesk = async () => {
    const { thread } = this.props
    if (thread && thread.participants) {
      for (const att of thread.participants) {
        if (att.email && att.email.split('@')[1].includes('zendesk.com')) {
          return true
        }
      }
    }
    const messages = await this.fetchMessages()
    for (let message of messages) {
      if (message.body.match(/href="https:\/\/\w+\.zendesk\.com\/agent\/tickets\/\d+"/)) {
        return true
      }
    }
    return false
  }
  render () {
    const accounts = AccountStore.accounts()
    let isEdisonMail = false
    for (const acc of accounts) {
      if (acc.emailAddress.includes('edison.tech')) {
        isEdisonMail = true
        break
      }
    }
    if (!this.props.thread || !this.state.isZendesk || !isEdisonMail) {
      return null
    }
    return (
      <div className='button-group' style={{ order: -1 }}>
        <div
          className={`btn-toolbar message-toolbar-zendesk ${this.state.active ? 'active' : ''}`}
          key='zendesk-plugin'
          title='zendesk plugin'
          onClick={this.toggleZendesk}
        >
          <RetinaImg
            name={'zendesk.svg'}
            style={{ width: 24, height: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </div>
      </div>
    )
  }
}
