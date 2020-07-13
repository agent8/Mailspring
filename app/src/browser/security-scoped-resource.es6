import path from 'path';
import fs from 'fs-plus';
import { atomicWriteFileSync } from '../fs-utils';

const RETRY_SAVES = 3;

export default class SecurityScopedResource {
  constructor({ configDirPath } = {}) {
    this.configDirPath = configDirPath;
    this.bookMarkFilePath = path.join(this.configDirPath, 'bookMark.json');
    this.bookMarkMapForPath = new Map();
    this.saveRetries = 0;
    this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.bookMarkFilePath)) {
        return;
      }
      const json = JSON.parse(fs.readFileSync(this.bookMarkFilePath));
      if (!json || !json['bookMarks'] || !Array.isArray(json['bookMarks'])) {
        return;
      }
      json['bookMarks'].forEach(bookmarkData => {
        const { path, bookMark } = bookmarkData;
        if (!this.bookMarkMapForPath.get(path)) {
          this.bookMarkMapForPath.set(path, bookMark);
        }
      });
    } catch (error) {}
  }

  getBookMark(path) {
    return this.bookMarkMapForPath.get(path) || '';
  }

  setBookMark(path, bookMark) {
    this.bookMarkMapForPath.set(path, bookMark);
    this.save();
  }

  save() {
    const bookMarks = [];
    this.bookMarkMapForPath.forEach((bookMark, path) => {
      bookMarks.push({
        path,
        bookMark,
      });
    });
    const allSettings = { bookMarks: bookMarks };
    const allSettingsJSON = JSON.stringify(allSettings, null, 2);
    try {
      atomicWriteFileSync(this.bookMarkFilePath, allSettingsJSON);
      this.saveRetries = 0;
    } catch (error) {
      if (this.saveRetries >= RETRY_SAVES) {
        return;
      }
      this.saveRetries++;
      this.save();
    }
  }
}
