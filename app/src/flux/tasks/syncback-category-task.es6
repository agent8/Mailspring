import utf7 from 'utf7';
import Task from './task';
import Attributes from '../attributes';
import Folder from '../models/folder';

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
  });
  fromJSON(json) {
    const ret = super.fromJSON(json);
    if (ret.created) {
      ret.created = new Folder(ret.created);
    }
    return ret;
  }

  static forCreating({ name, accountId, bgColor = 0, parentId = '', isExchange = false }) {
    return new SyncbackCategoryTask({
      name: name,
      path: isExchange ? '' : utf7.imap.encode(name),
      bgColor: bgColor,
      accountId: accountId,
      parentId,
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

  label() {
    return this.existingPath
      ? `Renaming ${utf7.imap.decode(this.existingPath)}`
      : `Creating ${utf7.imap.decode(this.path)}`;
  }
}
