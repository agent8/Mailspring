/* eslint global-require: 0 */
import Model from './model';
import Attributes from '../attributes';
import {
  InboxCategoryStates,
  inboxFocusedCategories,
  inboxNotOtherCategories,
  inboxOtherCategories,
} from '../../constant';

// We look for a few standard categories and display them in the Mailboxes
// portion of the left sidebar. Note that these may not all be present on
// a particular account.
const ToObject = arr => {
  return arr.reduce((o, v) => {
    o[v] = v;
    return o;
  }, {});
};
const mappings = {
  none: 0,
  inbox: 1,
  sent: 2,
  drafts: 3,
  flagged: 4,
  important: 5,
  spam: 6,
  archive: 7,
  trash: 8,
  all: 9,
  snoozed: 10,
  '[Mailspring]': 11,
};

const toJSONMapping = val => {
  if (!val) {
    return 0;
  }
  return mappings[val];
};
const fromJSONMapping = val => {
  if (val === -1) {
    return undefined;
  }
  const keys = Object.keys(mappings);
  const role = keys[parseInt(val)];
  return role === 'none' ? null : role;
};

const StandardRoleMap = ToObject([
  'inbox',
  'important',
  'flagged',
  'snoozed',
  'sent',
  'drafts',
  'all',
  'spam',
  'archive',
  'trash',
]);

const LockedRoleMap = ToObject(['sent', 'drafts']);

const HiddenRoleMap = ToObject([
  'sent',
  'drafts',
  'all',
  'archive',
  'flagged',
  'important',
  'snoozed',
  '[Mailspring]',
]);

/**
Private:
This abstract class has only two concrete implementations:
  - `Folder`
  - `Label`

See the equivalent models for details.

Folders and Labels have different semantics. The `Category` class only exists to help DRY code where they happen to behave the same

## Attributes

`role`: {AttributeString} The internal role of the label or folder. Queryable.

`path`: {AttributeString} The IMAP path name of the label or folder. Queryable.

Section: Models
*/
const fromDelimiterJsonMappings = val => {
  return String.fromCharCode(val);
};
const toDelimiterJSONMappings = val => {
  if (typeof val !== 'string' || val.length === 0) {
    return 47;
  }
  return val.charCodeAt(0);
};
const ignoredPrefixes = ['INBOX', '[Gmail]', '[Google Mail]'];
export default class Category extends Model {
  get displayName() {
    return Category.pathToDisplayName(this.name, this.delimiter);
  }
  get fullDisplayName() {
    // return utf7.imap.decode(this.name);
    return this.name;
  }
  pathWithPrefixStripped(ignoreGmailPrefix) {
    const name = this.fullDisplayName;
    for (const prefix of ignoredPrefixes) {
      if (prefix !== 'INBOX' && !ignoreGmailPrefix) {
        if (name.startsWith(`${prefix}${this.delimiter}`)) {
          return name.substr(prefix.length + 1); // + delimiter
        }
        if (name.length === prefix.length && name === prefix) {
          return name.substr(prefix.length + 1); // + delimiter;
        }
      }
      if (prefix === 'INBOX') {
        if (name.toLocaleUpperCase().startsWith(`${prefix}${this.delimiter}`)) {
          return name.substr(prefix.length + 1); // + delimiter;
        }
        if (name.length === prefix.length && name.toLocaleUpperCase() === prefix) {
          return name.substr(prefix.length + 1); // + delimiter;
        }
      }
    }
    return name;
  }
  static pathToDisplayName(pathString, delimiter = '', ignoreGmailPrefix = false) {
    if (!pathString) {
      return '';
    }
    // const decoded = utf7.imap.decode(pathString);
    const decoded = pathString;

    for (const prefix of ignoredPrefixes) {
      if (decoded.startsWith(`${prefix}${delimiter}`) && decoded.length > prefix.length + 2) {
        if (prefix !== 'INBOX' && ignoreGmailPrefix) {
          return decoded;
        }
        return decoded.substr(prefix.length + 1); // + delimiter
      }
      if (
        prefix === 'INBOX' &&
        decoded.toLocaleUpperCase().startsWith(`${prefix}${delimiter}`) &&
        decoded.length > prefix.length + 2
      ) {
        return decoded.substr(prefix.length + 1); // + delimiter
      }
    }
    // if (decoded.startsWith('Mailspring/') || decoded.startsWith('Mailspring.')) {
    //   return decoded.substr(11);
    // }
    if (decoded === 'INBOX') {
      return 'Inbox';
    }
    return decoded;
  }

  /* Available for historical reasons, do not use. */
  // get name() {
  //   console.error('using get name()');
  //   return this.role;
  // }

  static attributes = Object.assign({}, Model.attributes, {
    role: Attributes.String({
      queryable: true,
      modelKey: 'role',
      loadFromColumn: true,
      toJSONMapping,
      fromJSONMapping,
    }),
    name: Attributes.String({
      queryable: true,
      loadFromColumn: true,
      modelKey: 'name',
    }),
    path: Attributes.String({
      queryable: true,
      loadFromColumn: true,
      modelKey: 'path',
    }),
    parentId: Attributes.String({
      queryable: true,
      loadFromColumn: true,
      modelKey: 'parentId',
    }),
    state: Attributes.Number({
      modelKey: 'state',
      queryable: true,
      loadFromColumn: true,
    }),
    selectable: Attributes.Boolean({
      modelKey: 'selectable',
      queryable: true,
      loadFromColumn: true,
    }),
    type: Attributes.Number({
      modelKey: 'type',
      queryable: true,
      loadFromColumn: true,
    }),
    delimiter: Attributes.String({
      modelKey: 'delimiter',
      queryable: true,
      loadFromColumn: true,
      fromJSONMapping: fromDelimiterJsonMappings,
      toJSONMapping: toDelimiterJSONMappings,
    }),
  });

  static Types = {
    Standard: 'standard',
    Locked: 'locked',
    User: 'user',
    Hidden: 'hidden',
  };

  static InboxCategoryState = InboxCategoryStates;

  static inboxFocusedCategorys = inboxFocusedCategories;

  static inboxOtherCategorys = inboxOtherCategories;

  static inboxNotOtherCategorys = inboxNotOtherCategories;

  static StandardRoles = Object.keys(StandardRoleMap);
  static LockedRoles = Object.keys(LockedRoleMap);
  static HiddenRoles = Object.keys(HiddenRoleMap);

  static categoriesSharedRole(cats) {
    if (!cats || cats.length === 0) {
      return null;
    }
    const role = cats[0].role;
    if (!cats.every(cat => cat.role === role)) {
      return null;
    }
    return role;
  }

  displayType() {
    throw new Error('Base class');
  }

  hue() {
    if (!this.displayName) {
      return 0;
    }

    let hue = 0;
    for (let i = 0; i < this.displayName.length; i++) {
      hue += this.displayName.charCodeAt(i);
    }
    hue *= 396.0 / 512.0;
    return hue;
  }

  isStandardCategory(forceShowImportant) {
    let showImportant = forceShowImportant;
    if (showImportant === undefined) {
      showImportant = AppEnv.config.get('core.workspace.showImportant');
    }
    if (showImportant === true) {
      return !!StandardRoleMap[this.role];
    }
    return !!StandardRoleMap[this.role] && this.role !== 'important';
  }

  isLockedCategory() {
    return !!LockedRoleMap[this.role] || !!LockedRoleMap[this.path];
  }

  isHiddenCategory() {
    return !!HiddenRoleMap[this.role] || !!HiddenRoleMap[this.path];
  }

  isUserCategory() {
    return !this.isStandardCategory() && !this.isHiddenCategory();
  }

  isDeleted() {
    return this.state === 1;
  }
  areStrangers(otherCategory) {
    if (!(otherCategory instanceof Category)) {
      return false;
    }
    if (this.accountId !== otherCategory.accountId) {
      //Since this relationship only applies to same account,
      return false;
    }
    const currentLayers = this.displayName.split(this.delimiter);
    const otherLayers = otherCategory.displayName.split(otherCategory.delimiter);
    return otherLayers[0] !== currentLayers[0];
  }
  isParentOf(otherCategory) {
    if (!(otherCategory instanceof Category)) {
      return false;
    }
    if (this.accountId !== otherCategory.accountId) {
      return false;
    }
    const currentLayers = this.displayName.split(this.delimiter);
    const otherLayers = otherCategory.displayName.split(otherCategory.delimiter);
    if (otherLayers.length - 1 !== currentLayers.length) {
      return false;
    }
    return (
      otherLayers.length - 1 === currentLayers.length &&
      otherCategory.displayName.startsWith(this.displayName) &&
      this.displayName.length ===
        otherCategory.displayName.length -
          otherLayers[otherLayers.length - 1].length -
          otherCategory.delimiter.length
    );
  }
  isAncestorOf(otherCategory) {
    if (!(otherCategory instanceof Category)) {
      return false;
    }
    if (this.accountId !== otherCategory.accountId) {
      return false;
    }
    const currentLayers = this.displayName.split(this.delimiter);
    const otherLayers = otherCategory.displayName.split(otherCategory.delimiter);
    return (
      otherLayers.length - currentLayers.length >= 2 &&
      this.displayName === otherLayers.slice(0, currentLayers.length).join(this.delimiter)
    );
  }
  areSiblings(otherCategory) {
    if (!(otherCategory instanceof Category)) {
      return false;
    }
    if (this.accountId !== otherCategory.accountId) {
      return false;
    }
    const currentLayers = this.displayName.split(this.delimiter);
    const otherLayers = otherCategory.displayName.split(otherCategory.delimiter);
    if (otherLayers.length !== currentLayers.length) {
      return false;
    }
    if (currentLayers.length > 1) {
      const indexOfLastCurrentLayer = this.displayName.lastIndexOf(
        currentLayers[currentLayers.length - 1]
      );
      if (indexOfLastCurrentLayer === -1) {
        return false;
      }
      const indexOfLastOtherLayer = otherCategory.displayName.lastIndexOf(
        otherLayers[otherLayers.length - 1]
      );
      if (indexOfLastOtherLayer === -1) {
        return false;
      }
      const currentParentName = this.displayName.slice(0, indexOfLastCurrentLayer);
      const otherParentName = otherCategory.displayName.slice(0, indexOfLastOtherLayer);
      return currentParentName === otherParentName;
    } else {
      return false;
    }
  }
  areRelatives(otherCategory) {
    if (!(otherCategory instanceof Category)) {
      return false;
    }
    if (this.accountId !== otherCategory.accountId) {
      return false;
    }
    return (
      !this.areStrangers(otherCategory) &&
      !this.isAncestorOf(otherCategory) &&
      !this.isParentOf(otherCategory) &&
      !this.areSiblings(otherCategory)
    );
  }

  isArchive() {
    return ['all', 'archive'].includes(this.role);
  }
}
