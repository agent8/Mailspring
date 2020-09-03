const path = require('path');
const fs = require('fs');
const { downloadFile, uploadFile } = require('./s3-utils');
const { dirExists, deleteFileOrFolder, unCompressDir, compressDir } = require('./fs-utils');
const { INVALID_TEMPLATE_NAME_REGEX } = require('./constant');

async function downloadAndUnCompress(key) {
  const dirName = path.join(AppEnv.getConfigDirPath(), 'tmp');
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName);
  }
  const { exists, errorMsg } = dirExists(dirName);
  if (!exists) {
    throw new Error(errorMsg);
  }
  const downloadPath = path.join(dirName, `${key}.zip`);
  const zipPath = await downloadFile(key, downloadPath);
  const zipDirName = await unCompressDir(zipPath);
  return zipDirName;
}

async function compressAndUpload(key) {
  const dir = path.join(AppEnv.getConfigDirPath(), 'tmp', key);
  const { exists, errorMsg } = dirExists(dirName);
  if (!exists) {
    throw new Error(errorMsg);
  }
  const zipPath = await compressDir(dir);
  await uploadFile(key, zipPath);
  return zipPath;
}

async function cleanUpFiles(key) {
  const dirName = path.join(AppEnv.getConfigDirPath(), 'tmp');
  const zipPath = path.join(dirName, `${key}.zip`);
  const zipDirPath = path.join(dirName, key);
  deleteFileOrFolder(zipPath);
  deleteFileOrFolder(zipDirPath);
}

export function generateDiffData(oldList, newList) {
  const newIds = [];
  const removes = [];
  const updates = [];
  newList.forEach(n => {
    newIds.push(n.subId);
    const old = oldList.find(oldItem => n.subId === oldItem.subId);
    if (old && old.value === n.value) {
      return;
    }
    updates.push({
      subId: n.subId,
      value: n.value,
      tsClientUpdate: new Date().getTime(),
    });
  });
  oldList.forEach(o => {
    if (!newIds.includes(o.subId)) {
      removes.push({
        subId: o.subId,
        value: o.value,
        tsClientUpdate: new Date().getTime(),
      });
    }
  });
  return { update: updates, remove: removes };
}

export function diffListData(oldList, newList) {
  const newIds = [];
  const removes = [];
  const updates = [];
  newList.forEach(n => {
    newIds.push(n.subId);
    const old = oldList.find(oldItem => n.subId === oldItem.subId);
    if (old && old.value === n.value) {
      return;
    }
    updates.push({
      subId: n.subId,
      value: n.value,
      tsClientUpdate: new Date().getTime(),
    });
  });
  oldList.forEach(o => {
    if (!newIds.includes(o.subId)) {
      removes.push({
        subId: o.subId,
        value: o.value,
        tsClientUpdate: new Date().getTime(),
      });
    }
  });
  return { update: updates, remove: removes };
}

export const mergeLocalSignaturesToServer = async () => {};

export const mergeServerSignaturesToLocal = async () => {};

export const mergelocalTemplatesToServer = async () => {};

export const mergeServerTemplatesToLocal = async () => {};

export const mergeLocalAccountsToServer = async accounts => {
  return accounts.map(a => {
    function copyAndFilterSetting(account = {}) {
      const copy = {
        ...account,
      };
      delete copy.settings;
      return JSON.stringify(copy);
    }
    return {
      subId: a.pid,
      value: copyAndFilterSetting(a),
      tsClientUpdate: new Date().getTime(),
    };
  });
};

export const mergeServerAccountsToLocal = async accountListInServer => {
  const newAccountList = accountListInServer.map(subConf => JSON.parse(subConf.value));
  const localAccountList = AppEnv.config.get('accounts');
  return localAccountList.map(account => {
    const aInNewList = newAccountList.find(a => a.pid === account.pid);
    if (aInNewList) {
      return {
        ...aInNewList,
        settings: account.settings,
      };
    } else {
      return account;
    }
  });
};
