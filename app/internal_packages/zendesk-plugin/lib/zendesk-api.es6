const Zendesk = require('zendesk-node')
export default class ZendeskApi {
  constructor (options) {
    this.zendesk = Zendesk(options)
    this.authEmail = options.email
    this.cachedUsers = null
  }
  listTickets = async queryParams => {
    return await this.zendesk.tickets.list(queryParams)
  }

  findTicket = async ticketNumber => {
    const ticket = await this.zendesk.tickets.get(ticketNumber)
    return ticket.body.ticket
  }
  searchAssignableUsers = async data => {
    const res = await this.zendesk.users.list()
    return res.body.users
  }
  getUser = async id => {
    const res = await this.zendesk.users.get(id, {})
    return res.body.user
  }
  getUserByEmail = async email => {
    let users
    if (this.cachedUsers) {
      users = this.cachedUsers
    } else {
      const res = await this.zendesk.users.list()
      users = res.body.users
      this.cachedUsers = users
    }
    for (let user of users) {
      if (user.email === email) {
        return user
      }
    }
  }
  updateTicketField = async (ticket, field, value) => {
    return await this.zendesk.tickets.update(ticket.id, { ticket: { [field]: value } })
  }
  getComments = async ticket => {
    const res = await this.zendesk.tickets.listComments(ticket.id)
    return res.body.comments
  }
}
