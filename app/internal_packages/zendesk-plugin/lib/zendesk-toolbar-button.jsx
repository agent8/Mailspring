import React, { Component } from 'react'
const { RetinaImg } = require('mailspring-component-kit')
const { AccountStore } = require('mailspring-exports')
const ZENDESK_SHOW_KEY = 'plugin.zendesk.show'
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
  _isZendesk () {
    const { thread } = this.props
    if (thread && thread.participants) {
      for (const att of thread.participants) {
        if (att.email && att.email.split('@')[1].includes('zendesk.com')) {
          return true
        }
      }
    }
    return false
    // return this.props.thread.isJIRA;
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
    if (!this.props.thread || !this._isZendesk() || !isEdisonMail) {
      return null
    }
    return (
      <div className='button-group' style={{ order: -1 }}>
        <div
          className={`btn-toolbar message-toolbar-jira ${this.state.active ? 'active' : ''}`}
          key='jira-plugin'
          title='jira plugin'
          onClick={this.toggleZendesk}
        >
          <RetinaImg
            name={'jira.svg'}
            style={{ width: 24, height: 24 }}
            isIcon
            mode={RetinaImg.Mode.ContentIsMask}
          />
        </div>
      </div>
    )
  }
}
