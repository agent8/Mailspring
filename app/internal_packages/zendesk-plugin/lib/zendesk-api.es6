const ZENDESK_CLIENT_ID = 'k5w4G817nXJRIEpss2GYizMxpTXbl7tn'
const ZENDESK_CLIENT_SECRET = 'cSTiX-4hpKKgwHSGdwgRSK5moMypv_v1-CIfTcWWJC8BkA2E0O0vK7CYhdglbIDE'
const Zendesk = require('zendesk-node')
debugger
export default class ZendeskApi {
  constructor (props) {
    this.zendesk = Zendesk(props)
  }
  listTickets = async queryParams => {
    return await this.zendesk.tickets.list(queryParams)
  }
  refreshAccessToken = async () => {
    const body = []
    body.push(`refresh_token=${encodeURIComponent(this.refreshToken)}`)
    body.push(`client_id=${encodeURIComponent(ZENDESK_CLIENT_ID)}`)
    body.push(`client_secret=${encodeURIComponent(ZENDESK_CLIENT_SECRET)}`)
    body.push(`grant_type=${encodeURIComponent('refresh_token')}`)

    const resp = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      body: body.join('&'),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
    })
    const json = (await resp.json()) || {}
    if (!resp.ok) {
      throw new Error(
        `Jira OAuth Code exchange returned ${resp.status} ${resp.statusText}: ${JSON.stringify(
          json
        )}`
      )
    }
    const { access_token } = json
    console.log('*****this', this)
    this.baseOptions.auth.bearer = access_token
    console.log('******get new token', access_token)
    AppEnv.config.set('plugin.jira.config.access_token', access_token)
  }
  async safeDoRequest (url) {
    console.log('****safeDoRequest', url)
    let res = null
    try {
      res = await this.doRequest(...arguments)
    } catch (err) {
      console.error('****safeDoProcess - 1', err)
      // if Oauth, refresh token
      if (this.baseOptions.auth.bearer && err.error.message === 'Unauthorized') {
        try {
          await this.refreshAccessToken()
        } catch (refreshError) {
          console.error('****safeDoProcess - 2', refreshError.message)
          throw refreshError
        }
        res = await this.doRequest(...arguments)
      } else {
        throw err
      }
    }
    return res
  }
  findTicket = async ticketNumber => {
    const ticket = await this.zendesk.tickets.get(ticketNumber)
    return ticket.body.ticket
  }
  downloadThumbnail = attachment => {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/thumbnail/'
            .concat(attachment.id, '/')
            .concat(encodeURI(encodeURI(attachment.filename.replace(/ /g, '')))),
          intermediatePath: '/secure',
        }),
        {
          json: false,
          encoding: null,
        }
      )
    )
  }
  downloadAttachment = attachment => {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/attachment/'
            .concat(attachment.id, '/')
            .concat(encodeURI(encodeURI(attachment.filename.replace(/ /g, '')))),
          intermediatePath: '/secure',
        }),
        {
          json: false,
          encoding: null,
        }
      )
    )
  }
  findComments = async ticketKey => {
    return await this.zendesk.tickets.listComments(ticketKey)
  }
  searchAssignableUsers = async data => {
    const res = await this.zendesk.users.list()
    console.log(' api.searchAssignableUsers:', data, res)
    return res.body.users
  }
  getUser = async id => {
    console.log(' getUser id:', id)
    const res = await this.zendesk.users.get(id, {})
    return res.body.user
  }
  updateTicketAssignee = async (ticketKey, userId) => {
    return await this.zendesk.tickets.update(ticketKey, { assignee_id: userId })
  }
  updateTicketStatus = async (ticketKey, status) => {
    return await this.zendesk.tickets.update(ticketKey, { status })
  }
  transitionIssue (issueId, issueTransition) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueId, '/transitions'),
        }),
        {
          body: issueTransition,
          method: 'POST',
          followAllRedirects: true,
        }
      )
    )
  }
  listTransitions (issueId) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueId, '/transitions'),
          query: {
            expand: 'transitions.fields',
          },
        })
      )
    )
  }
  addComment (issueId, comment) {
    return this.safeDoRequest(
      this.makeRequestHeader(
        this.makeUri({
          pathname: '/issue/'.concat(issueId, '/comment'),
        }),
        {
          body: {
            body: comment,
          },
          method: 'POST',
          followAllRedirects: true,
        }
      )
    )
  }
}
