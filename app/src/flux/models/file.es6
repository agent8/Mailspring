/* eslint global-require: 0 */
import path from 'path';
import Model from './model';
import Attributes from '../attributes';
import { MS_TNEF_TYPES } from '../../constant';

/**
Public: File model represents an email attachment.

#// Attributes

`filename`: {AttributeString} The display name of the file. Queryable.

`size`: {AttributeNumber} The size of the file, in bytes.

`contentType`: {AttributeString} The content type of the file (ex: `image/png`)

`contentId`: {AttributeString} If this file is an inline attachment, contentId
is a string that matches a cid:<value> found in the HTML body of a {Message}.

This class also inherits attributes from {Model}

Section: Models
*/
export default class File extends Model {
  static attributes = Object.assign({}, Model.attributes, {
    data: Attributes.Ignore(),
    filename: Attributes.String({
      modelKey: 'filename',
      queryable: true,
      loadFromColumn: true,
    }),
    size: Attributes.Number({
      modelKey: 'size',
      queryable: true,
      loadFromColumn: true,
    }),
    contentType: Attributes.String({
      modelKey: 'contentType',
      queryable: true,
      loadFromColumn: true,
    }),
    mimeType: Attributes.String({
      modelKey: 'mimeType',
      queryable: false,
    }),
    messageId: Attributes.String({
      modelKey: 'messageId',
      queryable: true,
      loadFromColumn: true,
    }),
    contentId: Attributes.String({
      modelKey: 'contentId',
      queryable: true,
      loadFromColumn: true,
    }),
    isInline: Attributes.Boolean({
      modelKey: 'isInline',
      queryable: true,
      loadFromColumn: true,
    }),
    missingData: Attributes.Boolean({
      modelKey: 'missingData',
      queryable: false,
    }),
    originFilePath: Attributes.String({
      modelKey: 'originFilePath',
      queryable: false,
    }),
    filePath: Attributes.String({
      modelKey: 'filePath',
      queryable: false,
    }),
    state: Attributes.Number({
      modelKey: 'state',
      queryable: true,
      loadFromColumn: true,
    }),
  });
  static fromPartialData(data) {
    const tmp = new File(data);
    // tmp.fromJSON(data);
    if (!tmp.id && (data.id || data.pid)) {
      tmp.id = data.id || data.pid;
    }
    if (!tmp.contentType && tmp.mimeType) {
      tmp.contentType = tmp.mimeType;
    }
    tmp.missingData = !Object.prototype.hasOwnProperty.call(tmp, 'size');
    return tmp;
  }
  constructor({ mimeType = '', ...extra } = {}) {
    super(extra);
    if (mimeType) {
      this.contentType = mimeType;
    }
    if (this.mimeType && !this.contentType) {
      this.contentType = this.mimeType;
    }
    if (this.size && typeof this.size === 'string') {
      const tmp = parseInt(this.size, 10);
      this.size = isNaN(tmp) ? 0 : tmp;
    }
  }
  fromJSON(json) {
    const ret = super.fromJSON(json);
    if (ret.mimeType && !ret.contentType) {
      ret.contentType = ret.mimeType;
    }
    return ret;
  }

  // Public: Files can have empty names, or no name. `displayName` returns the file's
  // name if one is present, and falls back to appropriate default name based on
  // the contentType. It will always return a non-empty string.
  displayName() {
    // BG: This logic has been moved to the sync side - all files should always have names
    // as of the 1.1 release. This is just here still because people's local dbs could
    // still contain unnammed files.
    const defaultNames = {
      'text/calendar': 'Event.ics',
      'image/png': 'Unnamed Image.png',
      'image/jpg': 'Unnamed Image.jpg',
      'image/jpeg': 'Unnamed Image.jpg',
    };
    if (this.filename && this.filename.length) {
      return this.filename;
    }
    if (defaultNames[this.contentType]) {
      return defaultNames[this.contentType];
    }
    return 'Unnamed Attachment';
  }

  safeDisplayName() {
    // RegExpUtils = RegExpUtils || require('../../regexp-utils');
    // return this.displayName().replace(RegExpUtils.illegalPathCharactersRegexp(), '-');
    return this.displayName().replace(/\//g, ':');
  }

  // Public: Returns the file extension that should be used for this file.
  // Note that asking for the displayExtension is more accurate than trying to read
  // the extension directly off the filename. The returned extension may be based
  // on contentType and is always lowercase.

  // Returns the extension without the leading '.' (ex: 'png', 'pdf')
  displayExtension() {
    return path.extname(this.displayName().toLowerCase()).substr(1);
  }

  displayFileSize(bytes = this.size) {
    if (bytes === 0) {
      return 'Empty';
    }
    if (this && !(this.id || '').includes('local-')) {
      bytes = Math.floor(((bytes || 0) * 3) / 4);
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    let threshold = 1000000000;
    let idx = units.length - 1;

    let result = bytes / threshold;
    while (result < 1 && idx >= 0) {
      threshold /= 1000;
      result = bytes / threshold;
      idx--;
    }

    // parseFloat will remove trailing zeros
    const decimalPoints = idx >= 2 ? 1 : 0;
    const rounded = parseFloat(result.toFixed(decimalPoints));
    return `${rounded} ${units[idx]}`;
  }
  isTNEFType() {
    return MS_TNEF_TYPES.includes((this.contentType || '').toLocaleLowerCase());
  }
}
