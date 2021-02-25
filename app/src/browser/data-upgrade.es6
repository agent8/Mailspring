import uuid from 'uuid';
import path from 'path';
import fs from 'fs';

function configDataUpgrade(configDirPath) {
  const configFilePath = path.join(configDirPath, 'config.json');
  if (!fs.existsSync(configFilePath)) {
    return;
  }
  let configJson = {};
  try {
    configJson = JSON.parse(fs.readFileSync(configFilePath));
  } catch (err) {
    return;
  }
  const json = configJson['*'];
  if (!configJson || !json) {
    return;
  }
  console.log('Running config upgrade');

  const { templates, signatures, defaultSignatures = {} } = json;
  const renameFileList = [];
  const sigDir = path.join(configDirPath, 'signatures');
  const tempDir = path.join(configDirPath, 'templates');

  // change old date(object) to new(array)
  if (signatures && !Array.isArray(signatures)) {
    const newDefaultSignatures = { ...defaultSignatures };
    const newSignature = Object.keys(signatures).map(signatureFileName => {
      const newId = uuid().toLowerCase();
      const oldValue = signatures[signatureFileName];
      renameFileList.push([
        path.join(sigDir, `${signatureFileName}.html`),
        path.join(sigDir, `${newId}.html`),
      ]);
      const DefaultSignatureAccount = Object.keys(defaultSignatures).find(
        key => defaultSignatures[key] === signatureFileName
      );
      if (DefaultSignatureAccount) {
        newDefaultSignatures[DefaultSignatureAccount] = newId;
      }
      return {
        id: newId,
        state: 0,
        title: oldValue.title,
        tsClientUpdate: 0,
        attachments: [],
      };
    });
    json['signatures'] = newSignature;
    json['defaultSignatures'] = newDefaultSignatures;
  }
  // change old date(object) to new(array)
  if (!templates || !Array.isArray(templates)) {
    let templateList = [];
    if (fs.existsSync(tempDir)) {
      templateList = fs.readdirSync(tempDir).filter(fileName => path.extname(fileName) === '.html');
    }
    const newTemplates = templateList.map(templateFileName => {
      const newId = uuid().toLowerCase();
      const fileName = path.basename(templateFileName, '.html');
      const oldValue = templates ? templates[templateFileName] || {} : {};
      const attachments = (oldValue.files || []).map(filePath => ({
        inline: false,
        path: filePath,
      }));
      renameFileList.push([
        path.join(tempDir, templateFileName),
        path.join(tempDir, `${newId}.html`),
      ]);
      return {
        id: newId,
        state: 0,
        title: fileName,
        CC: oldValue.CC || '',
        BCC: oldValue.BCC || '',
        tsClientUpdate: 0,
        attachments: attachments,
      };
    });
    json['templates'] = newTemplates;
  }
  const sameUuid = '4ad7f986-de23-44a6-b579-3e2f9703b943';
  // change same uuid to new
  if (json['signatures'] && json['signatures'].find(sig => sig.id === sameUuid)) {
    const newId = uuid().toLowerCase();
    json['signatures'] = json['signatures'].map(sig => {
      if (sig.id === sameUuid) {
        return {
          ...sig,
          id: newId,
        };
      } else {
        return sig;
      }
    });
    renameFileList.push([
      path.join(sigDir, `${sameUuid}.html`),
      path.join(sigDir, `${newId}.html`),
    ]);
  }
  // change same uuid to new
  if (json['templates'] && json['templates'].find(t => t.id === sameUuid)) {
    const newId = uuid().toLowerCase();
    json['templates'] = json['templates'].map(t => {
      if (t.id === sameUuid) {
        return {
          ...t,
          id: newId,
        };
      } else {
        return t;
      }
    });
    renameFileList.push([
      path.join(tempDir, `${sameUuid}.html`),
      path.join(tempDir, `${newId}.html`),
    ]);
  }
  if (renameFileList.length) {
    renameFileList.forEach(item => {
      if (fs.existsSync(item[0])) {
        fs.renameSync(item[0], item[1]);
      }
    });
  }
  configJson['*'] = json;
  const newConfigStr = JSON.stringify(configJson);
  fs.writeFileSync(configFilePath, newConfigStr);
}

export async function dataUpgrade(configDirPath) {
  try {
    configDataUpgrade(configDirPath);
  } catch (err) {
    throw new Error('Update config data fail');
  }
}
