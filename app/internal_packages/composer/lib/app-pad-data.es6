/*
load and save the complete informations on this local machine for edison mail app;
the file is a json file with tha data structure like below:
{padId: padInfo, ...}
*/
import path from 'path'
import fs from 'fs'

// load all pad's data
export const loadPadData = () => {
  const configPath = AppEnv.getConfigDirPath()
  console.log(' loadPadData: ', configPath)
  const padDataFilePath = path.join(configPath, 'app-pad-data.json')
  if (!fs.existsSync(padDataFilePath)) {
    return {}
  }
  const content = fs.readFileSync(padDataFilePath)
  if (!content) {
    return {}
  }
  const appPadData = JSON.parse(content)
  return appPadData
}

// load single pad info
export const loadPadInfo = padInfo => {
  const appPadData = window.appPadData || loadPadData()
  const { padId } = padInfo
  Object.assign(padInfo, appPadData[padId])
  return padInfo
}

// save all pad'sdata
export const savePadData = appPadData => {
  const configPath = AppEnv.getConfigDirPath()
  console.log(' loadPadData: ', configPath)
  const padDataFilePath = path.join(configPath, 'app-pad-data.json')
  const content = JSON.stringify(appPadData)
  fs.writeFileSync(padDataFilePath, content)
}

// save single pad data
export const savePadInfo = padInfo => {
  const appPadData = window.appPadData || loadPadData()
  const token = padInfo.token
  appPadData[padInfo.padId] = padInfo
  savePadData(appPadData)
  padInfo.token = token
}

export default {
  loadPadData,
  loadPadInfo,
  savePadData,
  savePadInfo
}
