const path = require('path');
const fs = require('fs');
const uuid = require('uuid');

const { downloadFile, uploadFile } = require('./s3-utils');
const { dirExists, deleteFileOrFolder, unCompressDir, compressDir } = require('./fs-utils');
const { PreferencesSubListStateEnum } = require('./constant');

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

function diffListData(oldList, newList) {
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

function generateSubIdForSig(defaultSignature, account) {
  const signatureId =
    typeof account.signatureId === 'function'
      ? account.signatureId()
      : `local-${account.id}-${account.emailAddress}-${account.name}`;
  if (signatureId === defaultSignature) {
    return `${account.settings.imap_host}:${account.emailAddress}`;
  }
  const chooseAlias = (account.getAllAliasContacts() || []).find(alias => {
    const signatureIdForAlias =
      typeof alias.signatureId === 'function'
        ? alias.signatureId()
        : `local-${alias.accountId}-${alias.email}-${alias.name}`;
    return signatureIdForAlias === defaultSignature;
  });
  if (chooseAlias) {
    return `${account.settings.imap_host}:${account.emailAddress}:${chooseAlias.name}`;
  }
  return '';
}

async function mkdirAndWriteJson(signatureOrTemplate, bodyDirPath) {
  const key = signatureOrTemplate.id;

  const tmpDirName = path.join(AppEnv.getConfigDirPath(), 'tmp');
  if (!fs.existsSync(tmpDirName)) {
    fs.mkdirSync(tmpDirName);
  }

  const dirName = path.join(tmpDirName, key);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName);
  }

  const filePath = path.join(bodyDirPath, `${key}.html`);
  const body = fs.readFileSync(filePath).toString();

  const attachments = (signatureOrTemplate.attachments || []).map(file => {
    const name = path.basename(file.path);
    const extName = path.extname(name);
    const fileAttId = `${uuid()}${extName}`;
    fs.copyFileSync(file.path, path.join(dirName, fileAttId));
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

  const jsonFilePath = path.join(dirName, `${key}.json`);
  fs.writeFileSync(jsonFilePath, JSON.stringify(jsonObj));

  return dirName;
}

export const mergeLocalSignaturesToServer = async oldValueInServer => {
  const updateSignatureIdList = [];
  const removeSignatureIdList = [];
  const localSignatureList = AppEnv.config.get('signatures');
  for (const signature of localSignatureList) {
    if (signature.state === PreferencesSubListStateEnum.synchronized) {
      continue;
    }
    if (!signature.tsClientUpdate) {
      continue;
    }
    const key = signature.id;
    if (key.length !== 36) {
      continue;
    }

    if (signature.state !== PreferencesSubListStateEnum.deleted) {
      const signatureDir = path.join(AppEnv.getConfigDirPath(), 'signatures');
      await mkdirAndWriteJson(signature, signatureDir);
      await compressAndUpload(key);
      await cleanUpFiles(key);
      updateSignatureIdList.push(key);
      continue;
    }

    if (signature.state === PreferencesSubListStateEnum.deleted) {
      removeSignatureIdList.push(key);
    }
  }
  const cb = () => {
    const oldConfigList = AppEnv.config.get('signatures');
    const newConfigList = oldConfigList
      .filter(s => !removeSignatureIdList.includes(s.id))
      .map(s => {
        if (updateSignatureIdList.includes(s.id)) {
          return { ...s, state: PreferencesSubListStateEnum.synchronized };
        }
        return s;
      });
    AppEnv.config.set('signatures', newConfigList, true);
  };

  // handle defaultSignatures
  const newDefaultSig = [];
  const defaultSig = AppEnv.config.get('defaultSignatures');
  const AccountStore = require('./flux/stores/account-store').default;
  Object.keys(defaultSig).forEach(sigAccount => {
    const sigId = defaultSig[sigAccount];
    if (!sigId) {
      return;
    }
    const sigAccountReg = /^local\-(?<aid>[a-zA-Z0-9]+)\-.*$/g;
    const regResult = sigAccountReg.exec(sigAccount);

    const aid = (regResult && regResult.groups && regResult.groups.aid) || '';
    if (aid) {
      const theAccount = AccountStore.accountForId(aid);
      const subId = generateSubIdForSig(sigAccount, theAccount);
      if (subId) {
        newDefaultSig.push({
          subId: subId,
          value: sigId,
        });
        return;
      }
    }
    newDefaultSig.push({
      subId: sigId,
      value: sigId,
    });
  });
  const { update, remove } = diffListData(oldValueInServer, newDefaultSig);
  return { update: update, remove: remove, callback: cb };
};

export const mergeServerSignaturesToLocal = async value => {
  // handle default signature
  const newDefaultSig = {};
  const AccountStore = require('./flux/stores/account-store').default;
  value.forEach(({ subId, value }) => {
    const accountInfoReg = /^[^:]+\:(?<emailAdress>[^:]+)\:?(?<alias>.*)?$/g;
    const regResult = accountInfoReg.exec(subId);
    if (!regResult || !regResult.groups) {
      return;
    }
    const { emailAdress, alias } = regResult.groups;
    if (!emailAdress) {
      return;
    }
    const theAccount = AccountStore.accountForEmail({ email: emailAdress });
    if (!theAccount) {
      return;
    }
    const signatureId = `local-${theAccount.id}-${theAccount.emailAddress}-${alias ||
      theAccount.name}`;
    newDefaultSig[signatureId] = value;
  });
  AppEnv.config.set('defaultSignatures', newDefaultSig);

  // handle signature
  const newSignatureList = [];
  const sigIdList = new Set();
  for (const sig of value) {
    sigIdList.add(sig.value);
  }
  for (const key of sigIdList) {
    const dirName = await downloadAndUnCompress(key);
    const jsonPath = path.join(dirName, `${key}.json`);
    const json = require(jsonPath);
    const { attachments, html, name, lastUpdated } = json;
    const signatureName = name || 'Untitled';

    let signatureAttachments = [];
    if (attachments && attachments.length) {
      signatureAttachments = attachments.map(file => {
        const filePath = path.join(dirName, file.attId);
        const preferencesPath = path.join(AppEnv.getConfigDirPath(), 'preference');
        const destPath = path.join(preferencesPath, file.name);
        if (!fs.existsSync(preferencesPath)) {
          fs.mkdirSync(preferencesPath);
        }
        fs.copyFileSync(filePath, destPath);
        return { inline: file.inline, path: destPath };
      });
    }
    newSignatureList.push({
      id: key,
      title: signatureName,
      tsClientUpdate: lastUpdated,
      state: PreferencesSubListStateEnum.synchronized,
      attachments: signatureAttachments,
      body: html,
    });
    await cleanUpFiles(key);
  }

  // merge
  const signaturesDir = path.join(AppEnv.getConfigDirPath(), 'signatures');
  const oldSigList = AppEnv.config.get('signatures');
  const newList = [];

  newSignatureList.forEach(s => {
    const inOld = oldSigList.find(oldS => oldS.id === s.id);
    if (inOld && inOld.tsClientUpdate > s.tsClientUpdate) {
      newList.push(inOld);
      return;
    }
    fs.writeFileSync(path.join(signaturesDir, `${s.id}.html`), s.body);
    newList.push({
      id: s.id,
      state: s.state,
      title: s.title,
      tsClientUpdate: s.tsClientUpdate,
      attachments: s.attachments,
    });
  });
  oldSigList.forEach(s => {
    const inNew = newSignatureList.find(newS => newS.id === s.id);
    if (inNew) {
      return;
    }
    if (s.tsClientUpdate === 0) {
      newList.unshift(s);
    }
  });
  return newList;
};

export const mergelocalTemplatesToServer = async (oldValueInServer, value) => {
  const updates = [];
  const removes = [];
  for (const template of value) {
    if (template.state === PreferencesSubListStateEnum.synchronized) {
      continue;
    }
    if (!template.tsClientUpdate) {
      continue;
    }
    const key = template.id;
    if (key.length !== 36) {
      continue;
    }

    if (template.state !== PreferencesSubListStateEnum.deleted) {
      const templateDir = path.join(AppEnv.getConfigDirPath(), 'templates');
      await mkdirAndWriteJson(template, templateDir);
      await compressAndUpload(key);
      await cleanUpFiles(key);
      const subItem = {
        subId: key,
      };
      updates.push(subItem);
      continue;
    }

    if (template.state === PreferencesSubListStateEnum.deleted) {
      removes.push({
        subId: key,
      });
    }
  }
  const cb = () => {
    const removeIds = removes.map(item => item.subId);
    const updateIds = updates.map(item => item.subId);
    const oldConfigList = AppEnv.config.get('templates');
    const newConfigList = oldConfigList
      .filter(t => !removeIds.includes(t.id))
      .map(t => {
        if (updateIds.includes(t.id)) {
          return { ...t, state: PreferencesSubListStateEnum.synchronized };
        }
        return t;
      });
    AppEnv.config.set('templates', newConfigList, true);
  };
  return { update: updates, remove: removes, callback: cb };
};

export const mergeServerTemplatesToLocal = async value => {
  const newTemplateList = [];
  for (const template of value) {
    const key = template.subId;
    const dirName = await downloadAndUnCompress(key);
    const jsonPath = path.join(dirName, `${key}.json`);
    const json = require(jsonPath);
    const { attachments, html, name } = json;
    const templateName = name || 'Untitled';
    let templateAttachments = [];
    if (attachments && attachments.length) {
      templateAttachments = attachments.map(file => {
        const filePath = path.join(dirName, file.attId);
        const preferencesPath = path.join(AppEnv.getConfigDirPath(), 'preference');
        const destPath = path.join(preferencesPath, file.name);
        if (!fs.existsSync(preferencesPath)) {
          fs.mkdirSync(preferencesPath);
        }
        fs.copyFileSync(filePath, destPath);
        return { inline: file.inline, path: destPath };
      });
    }
    newTemplateList.push({
      id: key,
      state: PreferencesSubListStateEnum.synchronized,
      title: templateName,
      tsClientUpdate: template.tsClientUpdate,
      attachments: templateAttachments,
      body: html,
    });
    await cleanUpFiles(key);
  }
  // merge
  const templatesDir = path.join(AppEnv.getConfigDirPath(), 'templates');
  const oldTemplates = AppEnv.config.get('templates');
  const newList = [];
  newTemplateList.forEach(t => {
    const inOld = oldTemplates.find(oldT => oldT.id === t.id);
    if (inOld && inOld.tsClientUpdate > t.tsClientUpdate) {
      newList.push(inOld);
      return;
    }
    if (inOld && inOld.tsClientUpdate === 0) {
      newList.push(inOld);
      return;
    }
    fs.writeFileSync(path.join(templatesDir, `${t.id}.html`), t.body);
    newList.push({
      id: t.id,
      state: t.state,
      title: t.title,
      tsClientUpdate: t.tsClientUpdate,
      attachments: t.attachments,
    });
  });
  oldTemplates.forEach(t => {
    const inNew = newTemplateList.find(newT => newT.id === t.id);
    if (inNew) {
      return;
    }
    if (t.tsClientUpdate === 0) {
      newList.unshift(t);
    }
  });
  return newList;
};

export const mergeLocalAccountsToServer = async (oldValueInServer, value) => {
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
  return diffListData(oldValueInServer, newAccounts);
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
