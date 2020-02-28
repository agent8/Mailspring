import React, { Component } from 'react'
import ZendeskApi from './zendesk-api'
import { remote } from 'electron'
const { RetinaImg, LottieImg } = require('mailspring-component-kit')
const Zendesk = require('zendesk-node')
const CONFIG_KEY = 'plugin.zendesk.config'
const ONBOARDING_WINDOW = 'onboarding'
export default class Login extends Component {
  constructor (props) {
    super(props)
    this.state = {}
  }
  submit = async () => {
    const fields = [this.subdomain, this.email, this.password]
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
    const zendeskSubdomain = this.subdomain.value
    AppEnv.trackingEvent('Zendesk-Login')
    const config = {
      subdomain: this.subdomain.value,
      username: this.email.value,
      password: this.password.value,
    }
    this.zendesk = new ZendeskApi({
      authType: Zendesk.AUTH_TYPES.API_TOKEN,
      zendeskSubdomain,
      email: config.username,
      zendeskAdminToken: config.password,
    })
    try {
      const tickets = await this.zendesk.listTickets()
      console.log('****tickets', tickets)
    } catch (err) {
      console.log('****zendesk login failed', err)
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
      <div className='zendesk-login'>
        <div className='zendesk-logo'>
          <RetinaImg name={'jira.svg'} isIcon mode={RetinaImg.Mode.ContentIsMask} />
        </div>
        {error && <div className='error'>{error}</div>}
        <div className='row'>
          <span className='label'>Zendesk subdomain</span>
          <input
            type='text'
            defaultValue={'edison'}
            ref={el => (this.subdomain = el)}
            placeholder='eg. your-subdomain for zendesk'
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
              <button className='btn btn-zendesk btn-zendesk-login' onClick={this.submit}>
                Login
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }
}
