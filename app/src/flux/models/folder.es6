import Category from './category';
import Attributes from '../attributes';

const FolderType = {
  Folder: 0,
  Label: 1,
};

export default class Folder extends Category {
  static attributes = Object.assign({}, Category.attributes, {
    updatedAt: Attributes.DateTime({
      modelKey: 'updatedAt',
      queryable: false,
    }),
    bgColor: Attributes.Number({
      jsModelKey: 'bgColor',
      modelKey: 'bgcolor',
      queryable: true,
      loadFromColumn: true,
    }),
  });
  displayType() {
    if (this.type === FolderType.Folder) {
      return 'folder';
    } else {
      return 'label';
    }
  }
  isLabel() {
    return this.type === FolderType.Label;
  }
  isFolder() {
    return this.type === FolderType.Folder;
  }
}
