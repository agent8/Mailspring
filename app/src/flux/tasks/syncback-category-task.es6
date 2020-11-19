import utf7 from 'utf7';
import Task from './task';
import Attributes from '../attributes';
import Folder from '../models/folder';
const fromDelimiterJsonMappings = val => {
  return String.fromCharCode(val);
};
const toDelimiterJSONMappings = val => {
  if (typeof val !== 'string' || val.length === 0) {
    return 47;
  }
  return val.charCodeAt(0);
};
export default class SyncbackCategoryTask extends Task {
  static attributes = Object.assign({}, Task.attributes, {
    path: Attributes.String({
      modelKey: 'path',
    }),
    name: Attributes.String({
      modelKey: 'name',
    }),
    bgColor: Attributes.String({
      modelKey: 'bgColor',
    }),
    existingPath: Attributes.String({
      modelKey: 'existingPath',
    }),
    created: Attributes.Object({
      modelKey: 'created',
      itemClass: Folder,
    }),
    delimiter: Attributes.String({
      modelKey: 'delimiter',
      fromJSONMapping: fromDelimiterJsonMappings,
      toJSONMapping: toDelimiterJSONMappings,
    }),
  });
  fromJSON(json) {
    const ret = super.fromJSON(json);
    if (ret.created) {
      ret.created = new Folder(ret.created);
    }
    return ret;
  }

  static forCreating({
    name,
    accountId,
    bgColor = 0,
    parentId = '',
    isExchange = false,
    delimiter = '/',
  }) {
    return new SyncbackCategoryTask({
      name: name,
      path: isExchange ? '' : utf7.imap.encode(name),
      bgColor: bgColor,
      accountId: accountId,
      parentId,
      delimiter,
    });
  }

  static forRenaming({ path, accountId, newName, isExchange = false }) {
    return new SyncbackCategoryTask({
      existingPath: path,
      path: isExchange ? '' : utf7.imap.encode(newName),
      name: newName,
      accountId: accountId,
    });
  }
  static editLabel({ newName, currentName, accountId, newColor }) {
    return new SyncbackCategoryTask({
      existingPath: utf7.imap.encode(currentName),
      path: utf7.imap.encode(newName),
      name: newName,
      accountId: accountId,
      bgColor: newColor,
    });
  }

  label() {
    return this.existingPath
      ? `Renaming ${utf7.imap.decode(this.existingPath)}`
      : `Creating ${utf7.imap.decode(this.path)}`;
  }
}
