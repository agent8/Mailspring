/*
load and save the complete informations on this local machine for edison mail app;
the file is a json file with tha data structure like below:
{padId: padInfo, ...}
*/
import path from 'path'
import fs from 'fs'

export const loadDraftPadMap = () => {
  const configPath = AppEnv.getConfigDirPath()
  const filePath = path.join(configPath, 'draftid-padid-map.json')
  if (!fs.existsSync(filePath)) {
    return {}
  }
  const content = fs.readFileSync(filePath)
  if (!content) {
    return {}
  }
  try {
    const result = JSON.parse(content)
    return result
  } catch (e) {
  }
}
// load all pad's data
export const loadPadData = () => {
  const configPath = AppEnv.getConfigDirPath()
  const padDataFilePath = path.join(configPath, 'app-pad-data.json')
  if (!fs.existsSync(padDataFilePath)) {
    return {}
  }
  const content = fs.readFileSync(padDataFilePath)
  if (!content) {
    return {}
  }
  try {
    const appPadData = JSON.parse(content)
    return appPadData
  } catch (e) {
    console.log('loadPadData: parse error: ', e, '' + content)
    return {}
  }
}

// load single pad info
export const loadPadInfo = padInfo => {
  const appPadData = window.appPadData || loadPadData()
  const { padId, userId } = padInfo
  Object.assign(padInfo, appPadData[padId + '-' + userId])
  return padInfo
}

// save the data for map from draft id to pad id
export const saveDraftPadMap = draftIdPadIdMap => {
  const configPath = AppEnv.getConfigDirPath()
  const filePath = path.join(configPath, 'draftid-padid-map.json')
  const content = JSON.stringify(draftIdPadIdMap)
  fs.writeFileSync(filePath, content)
}

// save all pad data
export const savePadData = appPadData => {
  const configPath = AppEnv.getConfigDirPath()
  const padDataFilePath = path.join(configPath, 'app-pad-data.json')
  const content = JSON.stringify(appPadData)
  fs.writeFileSync(padDataFilePath, content)
}

// save single pad data
export const savePadInfo = padInfo => {
  const appPadData = window.appPadData || loadPadData()
  const token = padInfo.token
  const { padId, userId } = padInfo
  delete padInfo.token
  appPadData[padId + '-' + userId] = padInfo
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
