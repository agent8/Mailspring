import path from 'path'
import fs from 'fs'
import { downloadFileAsync, uploadFileAsync } from '../../edison-beijing-chat/utils/awss3'
import { ConversationStore, MessageSend } from 'chat-exports'
const { ipcRenderer } = require('electron')
const { BrowserWindow, getCurrentWindow } = require('electron').remote

export const downloadPadFile = async (awsKey, aes) => {
  const configPath = AppEnv.getConfigDirPath()
  console.log(' loadPadData: ', configPath)
  const downloadPath = path.join(configPath, 'teampad-download')
  const downloadFilePath = path.join(downloadPath, awsKey)
  if (fs.existsSync(downloadFilePath)) {
    return downloadFilePath
  }
  const dir = path.dirname(downloadFilePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  await downloadFileAsync(awsKey, downloadFilePath, aes)
  return downloadFilePath
}
export const downloadPadInlineImage = async (awsKey, aes) => {
  const cwd = AppEnv.getLoadSettings().resourcePath
  console.log(' downloadPadInlineImage: cwd: ', cwd)
  let relPath = 'internal_packages/composer/teamreply-client/download-inline-images'
  if (cwd.endsWith('/Resources/app.asar')) {
    relPath = '../app.asar.unpacked/' + relPath
  }
  const downloadDir = path.join(cwd, relPath)
  const downloadFilePath = path.join(downloadDir, awsKey)
  console.log(' downloadPadFile: downloadFilePath: ', fs.existsSync(downloadFilePath))
  if (fs.existsSync(downloadFilePath)) {
    return downloadFilePath
  }
  const dir = path.dirname(downloadFilePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  console.log(' downloadPadInlineImage: ', downloadFilePath)
  await downloadFileAsync(awsKey, downloadFilePath, aes)
  return downloadFilePath
}

// const getAesFromIpc = conv => {
//   return new Promise(function (resolve) {
//     console.log(' getAesFromIpc: ', conv)
//     const win = getCurrentWindow()
//     console.log(' getAesFromIpc win: ', win)
//     ipcRenderer.send('get-aes-by-conv', { win: win.id, conv: conv.jid })
//     ipcRenderer.once('return-aes', (event, aes) => {
//       console.log(' receive return-aes: ', event, aes)
//       resolve(aes)
//     })
//   })
// }

const getAesFromIpc = async conv => {
  // return await MessageSend.getAESKey(conv)
  return null
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
  const stats = fs.statSync(file)
  const size = stats.size
  const res = await uploadFileAsync(jidLocal, aes, file)
  res.aes = aes
  res.size = size
  console.log(' uploadPadFile: res: ', res)
  return res
}

export default {
  downloadPadFile,
  uploadPadFile,
}
