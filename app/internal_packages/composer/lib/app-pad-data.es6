/*
load and save the complete informations on this local machine for edison mail app;
the file is a json file with tha data structure like below:
{padId: padInfo, ...}
*/
import path from 'path'
import fs from 'fs'

export const loadDraftPadMap = () => {
  const configPath = AppEnv.getConfigDirPath()
  console.log(' loadDraftPadMap: ', configPath)
  const filePath = path.join(configPath, 'draftid-padid-map.json')
  if (!fs.existsSync(filePath)) {
    return {}
  }
  const content = fs.readFileSync(filePath)
  if (!content) {
    return {}
  }
  const result = JSON.parse(content)
  return result
}
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

// save the data for map from draft id to pad id
export const saveDraftPadMap = draftIdPadIdMap => {
  const configPath = AppEnv.getConfigDirPath()
  console.log(' saveDraftPadMap: ', configPath)
  const filePath = path.join(configPath, 'draftid-padid-map.json')
  const content = JSON.stringify(draftIdPadIdMap)
  fs.writeFileSync(filePath, content)
}

// save all pad data
export const savePadData = appPadData => {
  const configPath = AppEnv.getConfigDirPath()
  console.log(' savePadData: ', configPath)
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
  loadDraftPadMap,
  saveDraftPadMap,
  loadPadData,
  loadPadInfo,
  savePadData,
  savePadInfo
}
