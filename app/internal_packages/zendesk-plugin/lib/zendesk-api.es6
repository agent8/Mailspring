const ZENDESK_CLIENT_ID = 'k5w4G817nXJRIEpss2GYizMxpTXbl7tn'
const ZENDESK_CLIENT_SECRET = 'cSTiX-4hpKKgwHSGdwgRSK5moMypv_v1-CIfTcWWJC8BkA2E0O0vK7CYhdglbIDE'
const Zendesk = require('zendesk-node')
const zendesk = require('node-zendesk')
export default class ZendeskApi {
  constructor (props) {
    this.zendesk = zendesk.createClient({
      username: props.email,
      token: props.zendeskAdminToken,
      remoteUri: 'https://edison.zendesk.com/api/v2',
    })
  }
  listTickets = () => {
    const client = this.zendesk
    const promise = new Promise((resolve, reject) => {
      client.tickets.list(function (err, req, result) {
        if (err) {
          return reject(err)
        } else {
          return resolve(result)
        }
      })
    })
    return promise
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
  findTicket = ticketNumber => {
    const client = this.zendesk
    const promise = new Promise((resolve, reject) => {
      client.tickets.show(ticketNumber, function (err, req, result) {
        if (err) {
          return reject(err)
        } else {
          console.log('findTicket result:', result)
          return resolve(result)
        }
      })
    })
    return promise
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
  findComments = ticketKey => {
    const client = this.zendesk
    const promise = new Promise((resolve, reject) => {
      client.tickets.getComments(ticketKey, function (err, _, result) {
        if (err) {
          return reject(err)
        } else {
          return resolve(result)
        }
      })
    })
    return promise
  }
  searchAssignableUsers = () => {
    const client = this.zendesk
    const promise = new Promise((resolve, reject) => {
      client.users.list(function (err, _, result) {
        if (err) {
          return reject(err)
        } else {
          return resolve(result)
        }
      })
    })
    return promise
  }
  getUser = async id => {
    const client = this.zendesk
    const promise = new Promise((resolve, reject) => {
      client.users.list(function (err, _, result) {
        if (err) {
          return reject(err)
        } else {
          for (const user of result) {
            if (user.id === id) {
              return resolve(user)
            }
          }
          return reject(new Error(`Got no user with id:${id}`))
        }
      })
    })
    return promise
  }
  updateTicketAssignee = async (ticket, userId) => {
    const { id } = ticket
    const client = this.zendesk
    ticket.assignee_id = userId
    const promise = new Promise((resolve, reject) => {
      client.tickets.update(id, ticket, function (err, _, result) {
        if (err) {
          return reject(err)
        } else {
          resolve(result)
        }
      })
    })
    return promise
  }
  updateTicketStatus = async (ticket, status) => {
    const { id } = ticket
    const client = this.zendesk
    ticket.status = status
    const promise = new Promise((resolve, reject) => {
      client.tickets.update(id, ticket, function (err, _, result) {
        if (err) {
          return reject(err)
        } else {
          resolve(result)
        }
      })
    })
    return promise
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
