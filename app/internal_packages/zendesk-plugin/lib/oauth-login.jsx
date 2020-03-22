import React, { Component } from 'react'
import { remote } from 'electron'
import http from 'http'
import url from 'url'
import { postAsync } from '../../edison-beijing-chat/utils/httpex'
const Zendesk = require('zendesk-node')
const CONFIG_KEY = 'plugin.zendesk.config'
const LOCAL_SERVER_PORT = 12141

export default class OauthLogin extends Component {
  constructor (props) {
    super(props)
    this.state = {}
  }
  componentDidMount () {
    const client_id = 'zdg-global-edisonmail-desktop-zendesk-plugin'
    const { subdomain } = this.props
    const redirectUrl = encodeURIComponent('http://127.0.0.1:12141')
    const scope = encodeURIComponent('read write')
    let urlString = `https://${subdomain}.zendesk.com/oauth/authorizations/new?response_type=code&client_id=${client_id}&redirectUrl=${redirectUrl}&scope=${scope}`
    console.log(' urlString:', urlString)
    this.setState({ src: urlString })
    this._server = http.createServer((request, response) => {
      console.log('after redirected:' + request.url)
      const { query } = url.parse(request.url, { querystring: true })
      if (query.code) {
        this._onReceivedCode(query.code)
        // when oauth succeed, display Edison homepage
        response.writeHead(302, { Location: 'http://email.easilydo.com' })
        response.end()
      } else if (query.error === 'access_denied') {
        OnboardingActions.moveToPage('account-choose')
        return
      } else {
        response.end('Unknown Request')
      }
    })
    this._server.listen(LOCAL_SERVER_PORT, err => {
      if (err) {
        AppEnv.showErrorDialog({
          title: 'Unable to Start Local Server',
          message: `To listen for the Oauth response, Edison Mail needs to start a webserver on port ${LOCAL_SERVER_PORT}. Please go back and try linking your account again. If this error persists, use the IMAP/SMTP option with an App Password.\n\n${err}`,
        })
        return
      } else {
        console.log(' local server is listening:' + LOCAL_SERVER_PORT)
      }
    })
    console.log(' urlString:', urlString)
    remote.shell.openExternal(urlString)
  }
  componentWillUnmount () {
    if (this._server) {
      this._server.close()
    }
  }
  _onReceivedCode = async code => {
    const options = {
      grant_type: 'authorization_code',
      code,
      client_id: 'zdg-global-edisonmail-desktop-zendesk-plugin',
      client_secret: 'fa4d5970bb79deed1b2e3b4760516d7f579339f6e5fb4caca9838a062fe88e3e',
      redirect_uri: 'http://127.0.0.1:12141',
      scope: 'read write',
    }
    const zendeskSubdomain = this.props.subdomain
    let res = await postAsync(`https://${zendeskSubdomain}.zendesk.com/oauth/tokens`, options)
    console.log('  postAsync res:', res)
    if (typeof res === 'string') {
      res = JSON.parse(res)
    }
    if (res.error) {
      AppEnv.showErrorDialog({
        title: res.error,
        message: res.error_description,
      })
    } else {
      const zendeskOauthAccessToken = res.access_token
      console.log('  zendeskOauthAccessToken:', zendeskOauthAccessToken)
      const zendeskOptions = {
        authType: Zendesk.AUTH_TYPES.OAUTH_ACCESS_TOKEN,
        zendeskSubdomain,
        zendeskAdminToken: zendeskOauthAccessToken,
      }
      const config = zendeskOptions
      console.log(' zendeskOptions:', zendeskOptions)
      AppEnv.trackingEvent('Zendesk-Login-Success')
      AppEnv.config.set(CONFIG_KEY, config)
      remote.dialog.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        defaultId: 0,
        title: 'Login Succeed',
        message: `You login ${zendeskSubdomain}.zendesk.com.`,
      })
    }
    if (this._server) {
      this._server.close()
    }
  }
  render () {
    const { src } = this.state
    return (
      // <webview
      //   src={src}
      //   style={{
      //     position: 'absolute',
      //     top: 0,
      //     left: 0,
      //     width: '100%',
      //     height: '100%',
      //     zIndex: 99,
      //   }}
      // ></webview>
      <div className='sign-prompt'> Sign in Zendesk in the browser.</div>
    )
  }
}
