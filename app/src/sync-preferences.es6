const path = require('path');
const fs = require('fs');
const uuid = require('uuid');

const { downloadFile, uploadFile } = require('./s3-utils');
const { dirExists, deleteFileOrFolder, unCompressDir, compressDir } = require('./fs-utils');
const { PreferencesSubListStateEnum, EdisonPlatformType } = require('./constant');
const ConfigType = {
  template: { dirName: 'templates', configKey: 'templates' },
  signature: { dirName: 'signatures', configKey: 'signatures' },
};
const defaultSignaturesKey = 'defaultSignatures';

function replaceStr(oldStr, searchStr, replaceStr) {
  const oldStrSplit = oldStr.split(searchStr);
  return oldStrSplit.join(replaceStr);
}

const ServerTemplageTagClassName = 'holderSpan';
const LocalTemplageTagClassName = 'template-variable';

function replaceTemplateTagToLocal(body) {
  const box = document.createElement('div');
  box.innerHTML = body;
  const allSpan = box.querySelectorAll('span');
  allSpan.forEach(span => {
    const spanClassNames = (span.className || '').split(/\s/);
    if (spanClassNames.includes(ServerTemplageTagClassName)) {
      const newClassNames = spanClassNames.filter(
        c => c !== LocalTemplageTagClassName && c !== ServerTemplageTagClassName
      );
      span.className = [...newClassNames, LocalTemplageTagClassName].join(' ');
      span.setAttribute('data-tvar', span.innerText);
    }
  });
  return box.innerHTML;
}

function replaceTemplateTagToServer(body) {
  const box = document.createElement('div');
  box.innerHTML = body;
  const allSpan = box.querySelectorAll('span');
  allSpan.forEach(span => {
    const spanClassNames = (span.className || '').split(/\s/);
    if (spanClassNames.includes(LocalTemplageTagClassName)) {
      const newClassNames = spanClassNames.filter(
        c => c !== LocalTemplageTagClassName && c !== ServerTemplageTagClassName
      );
      span.className = [...newClassNames, ServerTemplageTagClassName].join(' ');
    }
  });
  return box.innerHTML;
}

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
  const { exists, errorMsg } = dirExists(dir);
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

async function mkdirAndWriteJson(signatureOrTemplate, type) {
  const key = signatureOrTemplate.id;

  const tmpDirName = path.join(AppEnv.getConfigDirPath(), 'tmp');
  if (!fs.existsSync(tmpDirName)) {
    fs.mkdirSync(tmpDirName);
  }

  const dirName = path.join(tmpDirName, key);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName);
  }
  const bodyDirName = ConfigType[type].dirName;
  const bodyDirPath = path.join(AppEnv.getConfigDirPath(), bodyDirName);
  const filePath = path.join(bodyDirPath, `${key}.html`);
  let body = fs.readFileSync(filePath).toString();

  const attachments = (signatureOrTemplate.attachments || []).map(file => {
    const name = path.basename(file.path);
    const extName = path.extname(name);
    const fileAttId = `${uuid()}${extName}`;
    fs.copyFileSync(file.path, path.join(dirName, fileAttId));
    body = replaceStr(body, file.path, `file://${fileAttId}`);
    return {
      attId: fileAttId,
      inline: file.inline,
      name: name,
    };
  });
  const jsonObj = {
    lastUpdated: signatureOrTemplate.tsClientUpdate,
    name: signatureOrTemplate.title,
    id: key,
    html: body,
    attachments: attachments,
    subject: '',
  };

  if (type === 'template') {
    jsonObj['CC'] = signatureOrTemplate.CC;
    jsonObj['BCC'] = signatureOrTemplate.BCC;
    jsonObj.html = replaceTemplateTagToServer(jsonObj.html);
  }
  const jsonFilePath = path.join(dirName, `${key}.json`);
  fs.writeFileSync(jsonFilePath, JSON.stringify(jsonObj));

  return dirName;
}

async function getTheDifferenceForSigOrTemp(list, type) {
  if (!Object.keys(ConfigType).includes(type)) {
    return {};
  }
  if (!Array.isArray(list)) {
    return {};
  }
  const updates = [];
  const removes = [];
  for (const signatureOrTemplate of list) {
    if (!signatureOrTemplate.tsClientUpdate) {
      continue;
    }
    const key = signatureOrTemplate.id;
    // key must is a uuid and all is lowercase
    if (key.length !== 36 || key.toLowerCase() !== key) {
      continue;
    }
    const item = {
      subId: key,
    };
    switch (signatureOrTemplate.state) {
      case PreferencesSubListStateEnum.synchronized:
        continue;
      case PreferencesSubListStateEnum.deleted:
        removes.push(item);
        continue;
      case PreferencesSubListStateEnum.updated:
        await mkdirAndWriteJson(signatureOrTemplate, type);
        await compressAndUpload(key);
        await cleanUpFiles(key);
        updates.push(item);
        continue;
      default:
        continue;
    }
  }
  const cb = () => {
    const removeIds = removes.map(item => item.subId);
    const updateIds = updates.map(item => item.subId);
    const configKey = ConfigType[type].configKey;
    const oldConfigList = AppEnv.config.get(configKey);
    const newConfigList = oldConfigList
      .filter(s => !removeIds.includes(s.id))
      .map(s => {
        if (updateIds.includes(s.id)) {
          return { ...s, state: PreferencesSubListStateEnum.synchronized };
        }
        return s;
      });
    AppEnv.config.set(configKey, newConfigList, true);
  };
  return { update: updates, remove: removes, callback: cb };
}

async function generateNewListForSigOrTemp(list, type) {
  if (!Array.isArray(list)) {
    return null;
  }
  const newSignatureOrTemplateList = [];
  for (const signatureOrTemplate of list) {
    const key = signatureOrTemplate.subId;
    try {
      const dirName = await downloadAndUnCompress(key);
      const jsonPath = path.join(dirName, `${key}.json`);
      const jsonStr = fs.readFileSync(jsonPath);
      const json = JSON.parse(jsonStr);
      const { attachments, html, name, CC, BCC } = json;
      const backupName =
        signatureOrTemplate.platform === EdisonPlatformType.COMMON ? 'From Mobile' : 'Untitled';
      const signatureOrTemplateName = name || backupName;
      let body = html;
      let attachmentList = [];
      if (attachments && attachments.length) {
        attachmentList = attachments.map(file => {
          const filePath = path.join(dirName, file.attId);
          const filename = file.name;
          const preferenceDir = path.join(AppEnv.getConfigDirPath(), 'preference');
          const newFileDirName = path.join(preferenceDir, uuid());
          const newFilePath = path.join(newFileDirName, filename);
          fs.mkdirSync(newFileDirName, {
            recursive: true,
          });
          fs.copyFileSync(filePath, newFilePath);
          body = replaceStr(body, `file://${file.attId}`, newFilePath);
          return { inline: file.inline, path: newFilePath };
        });
      }
      const newItem = {
        id: key,
        title: signatureOrTemplateName,
        tsClientUpdate: signatureOrTemplate.tsClientUpdate,
        state: PreferencesSubListStateEnum.synchronized,
        attachments: attachmentList,
        body,
      };
      if (type === 'template') {
        newItem['CC'] = CC || '';
        newItem['BCC'] = BCC || '';
        newItem.body = replaceTemplateTagToLocal(newItem.body);
      }
      newSignatureOrTemplateList.push(newItem);
      // await cleanUpFiles(key);
    } catch (error) {
      console.error(error.message);
    }
  }
  // merge
  const dirName = ConfigType[type].dirName;
  const configKey = ConfigType[type].configKey;
  const signatureOrTemplateDir = path.join(AppEnv.getConfigDirPath(), dirName);
  const oldSignatureOrTemplateList = AppEnv.config.get(configKey);
  const newIdMap = new Map();
  oldSignatureOrTemplateList.forEach(old => {
    newIdMap.set(old.id, old);
  });
  newSignatureOrTemplateList.forEach(newItem => {
    const inOld = newIdMap.get(newItem.id);
    if (!inOld || !inOld.tsClientUpdate || inOld.tsClientUpdate < newItem.tsClientUpdate) {
      fs.writeFileSync(path.join(signatureOrTemplateDir, `${newItem.id}.html`), newItem.body);
      delete newItem.body;
      newIdMap.set(newItem.id, newItem);
    }
  });

  const newList = [...newIdMap.values()];
  return newList;
}

export const mergeLocalSignaturesToServer = async value => {
  const data = await getTheDifferenceForSigOrTemp(value, 'signature');
  return data;
};

export const mergeServerSignaturesToLocal = async value => {
  const newList = await generateNewListForSigOrTemp(value, 'signature');
  return newList;
};

export const mergeLocalTemplatesToServer = async value => {
  const data = await getTheDifferenceForSigOrTemp(value, 'template');
  return data;
};

export const mergeServerTemplatesToLocal = async value => {
  const newList = await generateNewListForSigOrTemp(value, 'template');
  return newList;
};

export const mergeLocalAccountsToServer = async value => {
  const newAccounts = value.map(a => {
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
  const cb = () => {};
  return { update: newAccounts, remove: [], callback: cb };
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

export const mergeLocalDefaultSignaturesToServer = async value => {
  const update = [
    {
      subId: defaultSignaturesKey.toLowerCase(),
      value: JSON.stringify(value),
      tsClientUpdate: new Date().getTime(),
    },
  ];

  return { update: update, remove: [] };
};

export const mergeServerDefaultSignaturesToLocal = async defaultSigInServer => {
  const configInServer = defaultSigInServer.find(
    item => item.subId === defaultSignaturesKey.toLowerCase()
  );
  if (configInServer && configInServer.value) {
    try {
      const newConfig = JSON.parse(configInServer.value);
      return newConfig;
    } catch (err) {}
  }
  const configInLocal = AppEnv.config.get(defaultSignaturesKey);
  return configInLocal;
};
