import React, { Component } from 'react'
import ZendeskApi from './zendesk-api'
import { remote } from 'electron'
const { RetinaImg, LottieImg } = require('mailspring-component-kit')
const CONFIG_KEY = 'plugin.zendesk.config'
const ONBOARDING_WINDOW = 'onboarding'
export default class Login extends Component {
  constructor (props) {
    super(props)
    this.state = {}
  }
  submit = async () => {
    const fields = [this.host, this.email, this.password]
    let hasError = false
    this.setState({
      error: null,
      loading: true,
    })
    for (const f of fields) {
      f.className = ''
      if (!f.value) {
        f.className = 'error'
        hasError = true
      }
    }
    if (hasError) {
      return
    }
    AppEnv.trackingEvent('Zendesk-Login')
    const config = {
      host: this.host.value,
      username: this.email.value,
      password: this.password.value,
    }
    this.zendesk = new ZendeskApi({
      protocol: 'https',
      host: config.host,
      username: config.username,
      password: config.password,
      apiVersion: '2',
      strictSSL: true,
    })
    try {
      const currentUser = await this.zendesk.getCurrentUser()
      console.log('****currentUser', currentUser)
      config.currentUser = currentUser
    } catch (err) {
      console.log('****jira login failed', err)
      let message = 'Login failed, please check your Email and Api token.'
      if (err.statusCode === 404) {
        message = 'Login failed, please check your Zendesk workspace domain.'
      }
      this.setState({
        loading: false,
        error: message,
      })
      return
    }
    AppEnv.trackingEvent('Zendesk-Login-Success')
    AppEnv.config.set(CONFIG_KEY, config)
  }
  openOauth () {
    remote.getGlobal('application').windowManager.ensureWindow(ONBOARDING_WINDOW, {
      windowProps: {
        addingAccount: true,
        existingAccountJSON: {
          provider: 'zendesk-plugin',
        },
      },
      title: '',
    })
  }
  render () {
    const { host, username, password } = this.props.config
    const { error, loading } = this.state
    const apiSettingsUrl = `${(this.host && this.host.value) ||
      'https://zendesk.com'}/agent/admin/api/settings`
    return (
      <div className='jira-login'>
        <div className='jira-logo'>
          <RetinaImg name={'jira.svg'} isIcon mode={RetinaImg.Mode.ContentIsMask} />
        </div>
        {error && <div className='error'>{error}</div>}
        <div className='row'>
          <span className='label'>Jira workspace domain</span>
          <input
            type='text'
            defaultValue={'edison.zendesk.com'}
            ref={el => (this.host = el)}
            placeholder='eg. https://your-workspace.zendesk.com'
          />
        </div>
        <div className='row'>
          <span className='label'>Email</span>
          <input type='text' defaultValue={username} ref={el => (this.email = el)} />
        </div>
        <div className='row'>
          <span className='label'>API token</span>
          <input type='password' defaultValue={password} ref={el => (this.password = el)} />
          <span>
            <a href={apiSettingsUrl}>Get API token from here.</a>
          </span>
        </div>
        <div className='row'>
          {loading ? (
            <LottieImg
              name='loading-spinner-blue'
              size={{ width: 20, height: 20 }}
              style={{ margin: 'none' }}
            />
          ) : (
            <div>
              <button className='btn btn-jira btn-jira-login' onClick={this.submit}>
                Login
              </button>
              {/* <h1>Or</h1>
                            <button className="btn btn-jira btn-jira-login" onClick={this.openOauth}>Connect to Jira</button> */}
            </div>
          )}
        </div>
      </div>
    )
  }
}
