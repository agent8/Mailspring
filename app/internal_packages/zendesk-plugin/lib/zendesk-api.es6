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
}
