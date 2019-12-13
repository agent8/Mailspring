import fs from 'fs';
import path from 'path';
import Utils from './flux/models/utils';

export function atomicWriteFileSync(filepath, content) {
  const randomId = Utils.generateTempId();
  const backupPath = `${filepath}.${randomId}.bak`;
  fs.writeFileSync(backupPath, content);
  fs.renameSync(backupPath, filepath);
}

export function autoGenerateFileName(dirPath, fileName) {
  const files = fs.readdirSync(dirPath);

  if (files.indexOf(fileName) < 0) {
    return fileName;
  }

  const extname = path.extname(fileName);
  const basename = path.basename(fileName, extname);
  const reg = new RegExp(`^${basename}(?:\\((\\d+)\\))?${extname}$`);
  const fileNums = [];
  files.forEach(name => {
    const result = reg.exec(name);
    if (result) {
      const fileNum = result[1];
      if (fileNum && Number(fileNum) && Number(fileNum) > 0) {
        fileNums.push(Number(fileNum));
      }
    }
  });
  const nextNum = findMinNotInArr(fileNums);
  return `${basename}(${nextNum})${extname}`;
}

// this func is for to find the min positive integer that dont in the array
function findMinNotInArr(arr) {
  const arrFilter = arr.filter(num => num > 0 && parseInt(num) === num);
  const sortList = arrFilter.sort((a, b) => a - b);

  for (let i = 0; i < sortList.length; i++) {
    if (sortList[i] > i + 1) {
      return i + 1;
    }
  }
  return sortList.length + 1;
}
