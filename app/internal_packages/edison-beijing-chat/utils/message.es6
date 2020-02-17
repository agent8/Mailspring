import { isImageFilePath, isJsonStr } from './stringUtils'
import groupByTime from 'group-by-time'
import path from 'path'
import fs from 'fs'
import uuid from 'uuid/v4'
import { FILE_TYPE } from './filetypes'
import { uploadFile } from './awss3'
import { MESSAGE_STATUS_TRANSFER_FAILED } from '../model/Message'
import { ProgressBarStore, MessageStore, ConversationStore } from 'chat-exports'
import { alert } from './electron-utils'

var thumb = require('node-thumbnail').thumb

export const AT_BEGIN_CHAR = '\u2066'
export const AT_END_CHAR = '\u2067'
export const AT_EMPTY_CHAR = '\u200b'

export const removeTillAtChar = () => {
  const sel = window.getSelection()
  const focus = sel.focusNode
  const text = focus.textContent
  const focusOffset = sel.focusOffset
  let i = focusOffset
  while (i >= 0) {
    if (text[i] === '@') {
      break
    }
    i--
  }
  focus.textContent = text.substring(0, i) + text.substring(focusOffset)
  var range = document.createRange()
  range.setStart(focus, i)
  range.setEnd(focus, i) // here 0 and 4 is my location and length for the selection
  // if my string is "This is test string" in my case its must select "This"
  sel.removeAllRanges()
  sel.addRange(range)
}

export const groupMessages = async messages => {
  const groupedMessages = []
  const createGroup = message => ({
    sender: message.sender,
    messages: [message]
  })
  for (let index = 0; index < messages.length; index++) {
    let message = messages[index]
    const lastIndex = groupedMessages.length - 1
    if (index === 0 || groupedMessages[lastIndex].sender !== message.sender) {
      groupedMessages.push(createGroup(message))
    } else {
      groupedMessages[lastIndex].messages.push(message)
    }
  }

  return groupedMessages
}

/* kind: day, week, month */
export const groupMessagesByTime = async (messages, key, kind) => {
  var groupedByDay = groupByTime(messages, key, kind)
  const groupedMessages = []
  if (groupedByDay) {
    for (const time in groupedByDay) {
      groupedMessages.push({ time, messages: groupedByDay[time] })
    }
  }
  return groupedMessages
}

export const addMessagesSenderNickname = async messages => {
  const nicknames = chatLocalStorage.nicknames
  for (let message of messages) {
    message.senderNickname = nicknames[message.sender]
  }
}

const getMessageContent = message => {
  let body = message.body
  if (isJsonStr(body)) {
    body = JSON.parse(body)
  }
  if (typeof body === 'string') {
    return body
  } else {
    return body.content
  }
}

export const parseMessageBody = body => {
  if (isJsonStr(body)) {
    return JSON.parse(body)
  }
  return body
}

export const sendFileMessage = (file, index, reactInstance, messageBody) => {
  let { progress } = ProgressBarStore
  let { loading } = progress
  if (loading) {
    const loadConfig = progress.loadConfig
    const loadText = loadConfig.type === 'upload' ? 'An upload' : ' A download'
    alert(`${loadText} is processing, please wait it to be finished!`)
    return
  }

  const props = reactInstance.props
  const conversation = ConversationStore.selectedConversation
  const queueLoadMessage = reactInstance.queueLoadMessage || props.queueLoadMessage
  let filepath
  if (typeof file === 'object') {
    // the file is an description to an email attachment
    let id = file.id
    let configDirPath = AppEnv.getConfigDirPath()
    filepath = path.join(configDirPath, 'files', id.slice(0, 2), id.slice(2, 4), id, file.filename)
    if (!fs.existsSync(filepath)) {
      alert(
        `the selected file to be sent is not downloaded  to this computer: ${filepath}, ${file.id}, ${file.filename}`
      )
      return
    }
  } else {
    // the file is selected from the local file system
    filepath = file
  }
  const stats = fs.statSync(filepath)
  const fileSizeInBytes = stats.size
  if (fileSizeInBytes > 100000000) {
    alert('It is NOT supported to send the file which size is bigger than 100M.')
    return
  }
  const isdir = fs.lstatSync(filepath).isDirectory()
  if (isdir) {
    alert('Not support to send folder.')
    return
  }
  const messageId = uuid()

  const updating = false
  let message
  if (index === 0) {
    message = messageBody.trim()
  } else {
    message = '📄'
  }
  let filetype
  if (isImageFilePath(filepath)) {
    filetype = FILE_TYPE.IMAGE
    if (filepath.match(/.gif$/)) {
      filetype = FILE_TYPE.GIF
    }
  } else {
    filetype = FILE_TYPE.OTHER_FILE
  }
  let body = {
    type: filetype,
    isUploading: true,
    content: path.basename(filepath) || 'file',
    timeSend: new Date().getTime() + edisonChatServerDiffTime,
    localFile: filepath
  }
  if (file !== filepath) {
    body.emailSubject = file.subject
    body.emailMessageId = file.messageId
  }
  const loadConfig = {
    conversation,
    messageId,
    msgBody: body,
    filepath,
    type: 'upload'
  }
  queueLoadMessage(loadConfig)
}