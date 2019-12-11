import path from 'path'
import fs from 'fs'
import { downloadFileAsync, uploadFileAsync } from '../../edison-beijing-chat/utils/awss3'
import { ConversationStore, MessageSend } from 'chat-exports'
const { ipcRenderer } = require('electron')
const { BrowserWindow } = require('electron').remote

export const downloadPadFile = async (file, aes) => {
  const configPath = AppEnv.getConfigDirPath()
  console.log(' loadPadData: ', configPath)
  const downloadPath = path.join(configPath, 'teampad-download')
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath)
  }
  const downloadFilePath = path.join(downloadPath, file)
  if (!fs.existsSync(downloadFilePath)) {
    await downloadFileAsync(aes, file, downloadFilePath)
  }
  return downloadFilePath
}

const getAesFromIpc = conv => {
  return new Promise(function (resolve, reject) {
    const wins = BrowserWindow.getAllWindows()
    console.log(' getAesFromIpc: ', conv, wins, this)
    // ipcRenderer.send('get-aes-by-conv', { conv, resolve })
  })
}
export const uploadPadFile = async (file, jidLocal) => {
  let aes = null
  await ConversationStore.refreshConversations()
  let conv = ConversationStore.getSelectedConversation()
  if (!conv) {
    const convs = ConversationStore.conversations || []
    conv = convs[0]
  }
  console.log(' uploadPadFile: conv: ', conv)
  if (conv) {
    aes = await getAesFromIpc(conv)
  }
  console.log(' uploadPadFile: aes: ', aes)
  const res = await uploadFileAsync(jidLocal, aes, file)
  res.aes = aes
  console.log(' uploadPadFile: resL ', res)
  return res
}

export default {
  downloadPadFile,
  uploadPadFile
}
