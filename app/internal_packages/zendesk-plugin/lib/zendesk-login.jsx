import React, { Component } from 'react'
import ZendeskApi from './zendesk-api'
import OauthLogin from './oauth-login'
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
    const fields = [this.subdomain, this.email, this.password, this.apitoken]
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
    if (!this.subdomain || !this.email || (!this.password && !this.apitoken)) {
      return
    }
    let config
    AppEnv.trackingEvent('Zendesk-Login')
    if (this.password.value) {
      config = {
        authType: Zendesk.AUTH_TYPES.BASIC_AUTH,
        zendeskSubdomain: this.subdomain.value,
        email: this.email.value,
        password: this.password.value,
      }
    } else if (this.apitoken.value) {
      config = {
        authType: Zendesk.AUTH_TYPES.API_TOKEN,
        zendeskSubdomain: this.subdomain.value,
        email: this.email.value,
        zendeskAdminToken: this.apitoken.value,
      }
    }
    this.zendesk = new ZendeskApi(config)
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
    }
    AppEnv.trackingEvent('Zendesk-Login-Success')
    AppEnv.config.set(CONFIG_KEY, config)
  }
  openOauth = () => {
    if (!this.subdomain.value) {
      this.subdomain.className = 'error'
      this.setState({ subdomainErrorMessage: 'Please input subdomain before do oauth login' })
    } else {
      this.setState({ openOauth: true, subdomain: this.subdomain.value })
    }
  }
  render () {
    const { username, apitoken } = this.props.config
    const { subdomain, subdomainErrorMessage } = this.state
    const { error, loading, openOauth } = this.state
    if (openOauth) {
      return <OauthLogin subdomain={subdomain}></OauthLogin>
    }
    return (
      <div className='zendesk-login'>
        <div className='zendesk-logo'>
          <RetinaImg name={'zendesk.svg'} isIcon mode={RetinaImg.Mode.ContentIsMask} />
        </div>
        {error && <div className='error'>{error}</div>}
        <div className='row'>
          <span className='label'>Zendesk subdomain</span>
          <input
            type='text'
            ref={el => (this.subdomain = el)}
            placeholder='your-subdomain for zendesk'
          />
          <span className='error'>{subdomainErrorMessage}</span>
        </div>
        <div className='row'>
          <span className='label'>Email</span>
          <input type='text' defaultValue={username} ref={el => (this.email = el)} />
        </div>
        <div className='row'>
          <span className='label'>Password</span>
          <span className='prefer'>(if you prefer password)</span>
          <input type='password' ref={el => (this.password = el)} />
        </div>
        <div className='row'>
          <span className='label'>API token</span>
          <span className='prefer'>(if you prefer api token)</span>
          <input type='password' defaultValue={apitoken} ref={el => (this.apitoken = el)} />
          <span>
            <a href='https://support.zendesk.com/hc/en-us/articles/226022787-Generating-a-new-API-token-'>
              see here on how to get api token
            </a>
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
              <button className='btn btn-zendesk btn-zendesk-oauth-login' onClick={this.openOauth}>
                Oauth Login
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }
}
