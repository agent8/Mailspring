import React, { Component } from 'react'
import keyMannager from '../../../src/key-manager'
var axios = require('axios')

export default class TeamreplyEditor extends Component {
  state = {}

  constructor (props) {
    super(props)
  }
  async componentDidMount () {
    console.log('tm-editor.componentDidMount: ')
    const chatAccounts = AppEnv.config.get('chatAccounts') || {}
    const emails = Object.keys(chatAccounts)
    const email = emails[0] || 'yazz@qq.com'
    const token = await keyMannager.getAccessTokenByEmail(email)
    const chatAccountList = Object.values(chatAccounts)
    console.log('tm-editor.render: chatAccounts: ', chatAccounts)
    const chatAccount = chatAccountList[0] || {}
    console.log('tm-editor.render: chatAccount: ', chatAccount)
    const userId = chatAccount.userId || '100007'
    const name = chatAccount.name
    const userName = name
    let padId = chatAccount.padId
    if (!padId) {
      let res = await axios.post('http://127.0.0.1:9001/api/1.2.12/createPad', {
        userId,
        email,
        name,
        token,
        text: '',
        emailOri: { id: 'emailId', cc: ['cc'], to: ['11', '2'] },
        emailExtr: { to: ['11', '2'] },
        coWorkers: [
          { name: 'caoxm3456', userId: '427284', permission: 'edit' },
          { name: 'Xingming Cao', userId: '460359so2dx', permission: 'edit' }
        ]
      })
      console.log(' axios.post:createPad: res: ', res)
      if (res && res.status === 200 && res.data && res.data.data && res.data.data.padId) {
        padId = res.data.data.padId
        chatAccount.padId = padId
        console.log(' new padId: chatAccounts: ', chatAccounts)
        AppEnv.config.set('chatAccounts', chatAccounts)
      }
    }
    const padInfo = { padId, userId, userName, token }
    this.setState({ padInfo })
  }

  render () {
    const { padInfo } = this.state
    if (!padInfo) {
      return <div>No edit pad information found for this email!</div>
    }
    const { padId, userId, userName, token } = padInfo
    if (!padId) {
      return <div> Can not get AND create proper edit pad for this email!</div>
    }
    return (
      <iframe
        className='teamreply-editor'
        src={`http://0.0.0.0:8080/p/${padId}?userId=${userId}&userName=${userName}&token=${token}`}
      />
    )
  }
}
