import path from 'path'
import { downloadFileAsync } from '../../edison-beijing-chat/utils/awss3'

export const downloadPadFile = async file => {
  const configPath = AppEnv.getConfigDirPath()
  console.log(' loadPadData: ', configPath)
  const downloadPath = path.join(configPath, 'teampad-download', file)
  await downloadFileAsync(null, file, downloadPath)
  retuen downloadPath;
}

export default {
  downloadPadFile
}
