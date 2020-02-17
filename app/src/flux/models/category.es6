/* eslint global-require: 0 */
import utf7 from 'utf7';
import Model from './model';
import Attributes from '../attributes';

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
  'none': 0,
  'inbox': 1,
  'sent': 2,
  'drafts': 3,
  'flagged': 4,
  'important': 5,
  'spam': 6,
  'archive': 7,
  'trash': 8,
  'all': 9,
  'snoozed': 10,
  '[Mailspring]': 11,
};

const toJSONMapping = val => {
  if (!val){
    return 0
  }
  return mappings[val];
};
const fromJSONMapping = val => {
  if( val === -1){
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
  'starred',
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
  if(typeof val !== 'string' || val.length === 0){
    return 47;
  }
  return val.charCodeAt(0);
};
export default class Category extends Model {
  get displayName() {
    return Category.pathToDisplayName(this.path);
  }
  static pathToDisplayName(pathString) {
    if (!pathString) {
      return '';
    }
    const decoded = utf7.imap.decode(pathString);

    for (const prefix of ['INBOX', '[Gmail]', '[Google Mail]', '[Mailspring]']) {
      if (decoded.startsWith(prefix) && decoded.length > prefix.length + 1) {
        return decoded.substr(prefix.length + 1); // + delimiter
      }
    }
    if (decoded.startsWith('Mailspring/') || decoded.startsWith('Mailspring.')) {
      return decoded.substr(11);
    }
    if (decoded === 'INBOX') {
      return 'Inbox';
    }
    return decoded;
  }

  /* Available for historical reasons, do not use. */
  get name() {
    return this.role;
  }

  static attributes = Object.assign({}, Model.attributes, {
    role: Attributes.String({
      queryable: true,
      modelKey: 'role',
      loadFromColumn: true,
      toJSONMapping,
      fromJSONMapping
    }),
    path: Attributes.String({
      queryable: true,
      loadFromColumn: true,
      modelKey: 'path',
    }),
    state: Attributes.Number({
      modelKey: 'state',
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
    })
  });

  static Types = {
    Standard: 'standard',
    Locked: 'locked',
    User: 'user',
    Hidden: 'hidden',
  };

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

  isArchive() {
    return ['all', 'archive'].includes(this.role);
  }
}