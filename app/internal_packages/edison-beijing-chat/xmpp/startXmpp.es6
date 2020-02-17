import { Xmpp } from '.'
import {
  ChatActions,
  MessageStore,
  OnlineUserStore,
  ConversationStore,
  RoomStore,
  E2eeStore,
  BlockStore,
} from 'chat-exports'
import { getName } from '../utils/name'
import { registerLoginEmailAccountForChat } from '../utils/register-login-chat'
import { postAsync } from '../utils/httpex'
import { getChatAccountByUserId, getTokenByUserId } from '../utils/chat-account'

/**
 * Creates a middleware for the XMPP class to dispatch actions to a redux store whenever any events
 * are received
 * @param   {Xmpp}    xmpp            An instance of the Xmpp class
 * @param   {Object}  eventActionMap  An object with keys being the string value of the xmpp event
 *                                    and values being functions that return redux actions
 * @throws  {Error}                   Throws an error if xmpp is not an instance of Xmpp
 * @returns {Middleware}              The redux middleware function
 */
const startXmpp = xmpp => {
  if (!(xmpp instanceof Xmpp)) {
    throw Error('xmpp must be an instance of Xmpp')
  }

  let pullMessage = (ts, jid) => {
    xmpp.pullMessage(ts, jid).then(data => {
      const jidLocal = jid.split('@')[0]
      if (data && data.edipull && data.edipull.more == 'true') {
        saveLastTs2(jidLocal, data.edipull.since)
        pullMessage(data.edipull.since, jid)
      } else {
        xmpp.tmpData[jidLocal + '_tmp_message_state'] = false
        let tmpTs = xmpp.tmpData[jidLocal + '_tmp_message_ts']
        let ts = AppEnv.config.get(jidLocal + '_message_ts')
        if (!ts || (tmpTs && ts < tmpTs)) {
          AppEnv.config.set(jidLocal + '_message_ts', tmpTs)
        }
      }
    })
  }
  let saveLastTs2 = (jidLocal, ts) => {
    let msgTs = parseInt(ts)
    if (msgTs) {
      AppEnv.config.set(jidLocal + '_message_ts', msgTs)
    }
  }
  let saveLastTs = data => {
    let jidLocal = data.curJid.split('@')[0]
    const msgTs = parseInt(data.ts)
    let tmpTs = xmpp.tmpData[jidLocal + '_tmp_message_ts']
    if (xmpp.tmpData[jidLocal + '_tmp_message_state']) {
      if (!tmpTs || tmpTs < msgTs) {
        xmpp.tmpData[jidLocal + '_tmp_message_ts'] = msgTs
      }
      return
    }
    if (tmpTs) {
      if (tmpTs > msgTs) {
        msgTs = tmpTs
      }
      xmpp.tmpData[jidLocal + '_tmp_message_ts'] = 0
    }
    let ts = AppEnv.config.get(jidLocal + '_message_ts')
    if (!ts || ts < msgTs) {
      AppEnv.config.set(jidLocal + '_message_ts', msgTs)
    }
  }
  // receive group chat
  xmpp.on('groupchat', data => {
    saveLastTs(data)
    MessageStore.receiveGroupChat(data)
  })
  // receive private chat
  xmpp.on('chat', data => {
    saveLastTs(data)
    MessageStore.receivePrivateChat(data)
  })
  xmpp.on('message:received', data => {
    // console.log('yazz.groupchat', data.ts, data.appEvent, data.id)
    saveLastTs(data)
  })
  // user online
  xmpp.on('available', data => {
    OnlineUserStore.addOnlineUser(data)
    ChatActions.userOnlineStatusChanged(data.from.bare)
  })
  // user online
  xmpp.on('unavailable', data => {
    OnlineUserStore.removeOnlineUser(data)
    ChatActions.userOnlineStatusChanged(data.from.bare)
  })
  // Chat account online
  xmpp.on('session:started', data => {
    OnlineUserStore.addOnLineAccount(data)
    let ts = AppEnv.config.get(data.local + '_message_ts')
    if (ts) {
      pullMessage(ts, data.bare)
    } else {
      xmpp.tmpData[data.local + '_tmp_message_state'] = false
    }
  })
  // Chat account offline
  xmpp.on('disconnected', data => {
    console.log('xmpp:disconnected: ', data)
    OnlineUserStore.removeOnLineAccount(data)
  })

  // change conversation name
  xmpp.on('edimucconfig', data => {
    ConversationStore.onChangeConversationName(data)
  })

  // member join / quit
  xmpp.on('memberschange', data => {
    RoomStore.onMembersChange(data)
  })

  xmpp.on('message:ext-e2ee', data => {
    E2eeStore.saveE2ee(data)
  })

  xmpp.on('message:error', async data => {
    let msgInDb = await MessageStore.getMessageById(data.id, data.from && data.from.bare)
    if (!msgInDb) {
      return
    }
    const msg = msgInDb.get({ plain: true })
    let body = msg.body
    body = JSON.parse(body)
    if (data.error && data.error.code == 403 && data.id) {
      body.content = 'You are not in this conversation.'
      body.type = 'error403'
    } else if (
      data.error &&
      data.error.type === 'cancel' &&
      data.from &&
      data.from.bare &&
      data.from.bare.match(/\d+@im/)
    ) {
      const name = await getName(data.from.bare)
      const who = name || data.from.bare
      body.failMessage = `this message failed to be sent, because ${who} has signed out from edison chat system`
      body.type = 'error-signout'
    }
    body = JSON.stringify(body)
    msg.body = body
    MessageStore.saveMessagesAndRefresh([msg])
  })
  xmpp.on('message:success', async data => {
    let msgInDb = await MessageStore.getMessageById(data.$received.id, data.from.bare)
    if (!msgInDb) {
      return
    }
    const msg = msgInDb.get({ plain: true })
    let body = msg.body
    body = JSON.parse(body)
    if (body.type && body.type.match && body.type.match(/^error/)) {
      delete body.type
    }
    if (body.failMessage) {
      delete body.failMessage
    }
    body = JSON.stringify(body)
    msg.body = body
    msg.status = 'MESSAGE_STATUS_DELIVERED'
    MessageStore.saveMessagesAndRefresh([msg])
  })

  xmpp.on('message:failed', async message => {})

  xmpp.on('auth:failed', async data => {
    const account = OnlineUserStore.getSelfAccountById(data.curJid)
    const emailAccounts = AppEnv.config.get('accounts')
    let emailAccount
    for (const acc of emailAccounts) {
      if (acc.emailAddress === account.email) {
        emailAccount = acc
        break
      }
    }
    let accounts = AppEnv.config.get('chatAccounts')
    if (accounts && account.email && accounts[account.email]) {
      delete accounts[account.email]
    }
    AppEnv.config.set('chatAccounts', accounts)
    registerLoginEmailAccountForChat(emailAccount)
  })

  xmpp.on('block', async ({ curJid }) => {
    await BlockStore.refreshBlocksFromXmpp(curJid)
  })
  xmpp.on('unblock', async ({ curJid }) => {
    await BlockStore.refreshBlocksFromXmpp(curJid)
  })

  xmpp.on('app-event', async data => {
    if (!data || !data.eventData) {
      return
    }
    const userId = data && data.to && data.to.local
    const from = data.from
    const fromjid = data.from.bare
    const padId = data.eventData.padID
    const curJid = data.curJid
    if (!userId || !padId) {
      return
    }
    const token = await getTokenByUserId(userId)
    if (!token) {
      return
    }
    const padActionMembers = data.eventData.members
    const padActionType = data.eventData.type
    const options = { userId, token }
    const apiPath = window.teamPadConfig.teamEditAPIUrl + 'listPadsOfAuthor'
    let res = await postAsync(apiPath, options, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
      },
    })
    if (!res) {
      return
    }
    if (typeof res === 'string') {
      res = JSON.parse(res)
    }
    if (!res.data) {
      return
    }
    const apidata = res.data
    const pads = apidata.padIDs
    let pad
    for (pad of pads) {
      if (pad.id === padId) {
        break
      }
    }
    if (!pad) {
      return
    }
    const convJid = data.from.bare // pad.chatRoomId + '@muc.im.edison.tech'
    console.log(' app-event: convJid, pad.chatRoomId: ', convJid, pad.chatRoomId)
    const conv = await ConversationStore.getConversationByJid(convJid)
    if (!conv) {
      const name = `Pad: ${pad.name}`
      const roomId = convJid
      const curJid = userId + '@im.edison.tech'
      const contacts = []
      const isExistedAppRoom = true
      const payload = {
        contacts,
        roomId,
        name,
        curJid,
        isExistedAppRoom,
      }
      await ConversationStore.createGroupConversation(payload)
    }
    const chatAccount = getChatAccountByUserId(userId)
    // const url = `edisonmail://teamedit.edison.tech/${draft.headerMessageId}?padId=${padId}&inviterEmail=${from}
    // &userId=${userId}&userName=${member.name}&email=${member.email}`
    const padMemberChangeData = {
      from,
      curJid,
      padId,
      fromjid,
      convJid,
      userId,
      name: chatAccount.name,
      email: chatAccount.email,
      padActionMembers,
      padActionType,
    }
    await RoomStore.onPadMemberChange(padMemberChangeData)
  })
}

export default startXmpp
