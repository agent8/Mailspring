import MailspringStore from 'mailspring-store'
import { ConversationStore } from 'chat-exports'
import PadModel from './PadModel'
import { postAsync } from '../../../edison-beijing-chat/utils/httpex'
import { getTokenByUserId } from '../../../edison-beijing-chat/utils/chat-account'
import { Thumbnail } from 'react-bootstrap'

const MeStarted = 'MeStarted'
const OtherStarted = 'OtherStarted'
const Finished = 'Finished'
const All = 'All'

class PadStore extends MailspringStore {
  constructor () {
    super()
    this.kind = All
    this.updated = false
    this.pads = null
    this.refreshPads()
    ConversationStore.listen(this.refreshPads)
  }

  setKind = kind => {
    this.kind = kind
    this.refreshPads()
  }
  refreshPads = async () => {
    console.log(' PadStore.refreshPads:')
    let condition
    if (this.kind == MeStarted) {
      condition = { permission: 'owner' }
    } else if (this.kind == MeStarted) {
      condition = { permission: { ne: 'owner' } }
    } else if (this.kind == Finished) {
      condition = { status: 1 }
    } else {
      //All
      condition = {}
    }
    let data = await PadModel.findAll({ where: condition })
    console.log(' PadStore.refreshPads: this.updated, data', this.updated, data)
    if (!this.updated || !data.length) {
      await this.updateFromServer()
      this.updated = true
      data = await PadModel.findAll({ where: condition })
    }
    console.log('refreshPads PadModel.findAll:', data)
    this.pads = data
    if (data && !this.pad) {
      this.pad = this.pads[0]
    }
    this.trigger()
  }

  setPad = pad => {
    console.trace('setPad, pad:', pad)
    this.pad = pad
    this.trigger()
  }

  updateFromServer = async () => {
    const chatAccounts = AppEnv.config.get('chatAccounts') || {}
    console.log(' PadStore.updateFromServer chatAccounts:', chatAccounts)
    const acc = Object.values(chatAccounts)[0]
    if (!acc) {
      return
    }
    const userId = acc.userId
    this.email = acc.email
    this.userId = userId
    const token = await getTokenByUserId(userId)
    console.log(' PadStore.updateFromServer acc, userId, token:', acc, userId, token)
    if (!token) {
      return
    }
    this.token = token
    const apiPath = window.teamPadConfig.teamEditAPIUrl + 'listPadsOfAuthor'
    const options = { userId, token }
    console.log(
      ' PadStore.updateFromServer postAsync listPadsOfAuthor apiPath, options: ',
      apiPath,
      options
    )
    let res = await postAsync(apiPath, options, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    })
    console.log(' PadStore.updateFromServer postAsync listPadsOfAuthor res: ', res)
    if (!res) {
      return
    }
    if (typeof res === 'string') {
      try {
        res = JSON.parse(res)
      } catch (e) {
        console.error('error in parsing listPadsOfAuthor response:', res, e)
      }
    }
    if (!res.data) {
      return
    }
    const padList = res.data.padIDs
    for (let pad of padList) {
      pad.emaiOri = JSON.stringify(pad.emaiOri)
      pad.emailExtr = JSON.stringify(pad.emailExtr)
      await PadModel.upsert(pad)
    }
    this.updated = true
    return padList
  }

  getPadByPadId = async padId => {
    // await this.setKind(All)
    console.log(' getPadByPadId, this, this.pads, padId:', this, this.pads, padId)
    if (!this.pads) {
      return
    }
    console.log('getPadByPadId, this, padId 2:', this, padId)
    for (const pad of this.pads) {
      console.log('getPadByPadId, pad.id', pad.id)
      if (pad.id === padId) {
        return pad
      }
    }
  }
}
Object.assign(PadStore, { MeStarted, OtherStarted, Finished, All })
module.exports = new PadStore()
