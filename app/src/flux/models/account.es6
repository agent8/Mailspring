/* eslint global-require:0 */
import Attributes from '../attributes';
import ModelWithMetadata from './model-with-metadata';

let CategoryStore = null;
let Contact = null;

const noticeTypeEnum = [{ type: 'None', title: 'None/Mute' }, { type: 'All', title: 'All mail' }];
const noticeTypeImportant = [{ type: 'Important', title: 'Marked as Important' }];
/*
 * Public: The Account model represents a Account served by the Nylas Platform API.
 * Every object on the Nylas platform exists within a Account, which typically represents
 * an email account.
 *
 * ## Attributes
 *
 * `name`: {AttributeString} The name of the Account.
 *
 * `provider`: {AttributeString} The Account's mail provider  (ie: `gmail`)
 *
 * `emailAddress`: {AttributeString} The Account's email address
 * (ie: `ben@nylas.com`). Queryable.
 *
 * This class also inherits attributes from {Model}
 *
 * Section: Models
 */
export default class Account extends ModelWithMetadata {
  static SYNC_STATE_OK = 'ok';

  static SYNC_STATE_AUTH_FAILED = 'invalid';
  static INSUFFICIENT_PERMISSION = 'ErrorInsufficientPermission';
  static SYNC_STATE_ERROR = 'sync_error';

  static attributes = Object.assign({}, ModelWithMetadata.attributes, {
    name: Attributes.String({
      modelKey: 'name',
    }),

    provider: Attributes.String({
      modelKey: 'provider',
    }),

    emailAddress: Attributes.String({
      queryable: true,
      modelKey: 'emailAddress',
    }),

    settings: Attributes.Object({
      modelKey: 'settings',
    }),

    mailsync: Attributes.Object({
      modelKey: 'mailsync',
    }),

    label: Attributes.String({
      modelKey: 'label',
    }),

    autoaddress: Attributes.Object({
      modelKey: 'autoaddress',
    }),

    aliases: Attributes.Object({
      modelKey: 'aliases',
    }),

    defaultAlias: Attributes.Object({
      modelKey: 'defaultAlias',
    }),

    syncState: Attributes.String({
      modelKey: 'syncState',
    }),

    syncError: Attributes.Object({
      modelKey: 'syncError',
    }),
    lastVerified: Attributes.Number({
      modelkey: 'lastVerified',
    }),
    picture: Attributes.String({
      modelKey: 'picture',
    }),
    notifacation: Attributes.Object({
      modelKey: 'notifacation',
    }),
    highFrequencyFolders: Attributes.Object({
      modelKey: 'highFrequencyFolders',
    }),
  });

  constructor(args) {
    super(args);
    this.aliases = this.aliases || [];
    this.label = this.label || this.emailAddress;
    this.syncState = this.syncState || Account.SYNC_STATE_OK;
    this.autoaddress = this.autoaddress || {
      type: 'bcc',
      value: '',
    };
    this.lastVerified = this.lastVerified || 0;
    this.notifacation = this.notifacation || {
      noticeType: 'All',
      sound: true,
    };

    if (
      this.getNoticeTypeEnum()
        .map(item => item.type)
        .indexOf(this.notifacation.noticeType) < 0
    ) {
      this.notifacation.noticeType = 'All';
    }
  }

  toJSON(...args) {
    // ensure we deep-copy our settings object into the JSON
    const json = super.toJSON(...args);
    json.settings = Object.assign({}, json.settings);
    return json;
  }

  fromJSON(json) {
    super.fromJSON(json);
    if (!this.label) {
      this.label = this.emailAddress;
    }
    return this;
  }

  // Returns a {Contact} model that represents the current user.
  me() {
    Contact = Contact || require('./contact').default;

    return new Contact({
      // used to give them random strings, let's try for something consistent
      id: `local-${this.id}-${this.emailAddress}-${this.name}`,
      accountId: this.id,
      name: this.name,
      email: this.emailAddress,
    });
  }
  signatureId() {
    return `local-${this.id}-${this.emailAddress}-${this.name}`;
  }

  meUsingAlias(alias) {
    Contact = Contact || require('./contact').default;

    if (!alias) {
      return this.me();
    }
    const meAlias = Contact.fromString(alias, {
      accountId: this.id,
    });

    // meAlias.isAlias = true;
    // meAlias.aliasName = `${meAlias.name} <${meAlias.email}>`;

    return meAlias || this.me();
  }

  defaultMe() {
    if (this.defaultAlias && this.meUsingAlias(this.defaultAlias)) {
      return this.meUsingAlias(this.defaultAlias);
    }
    return this.me();
  }

  getAllEmails() {
    const ret = [this.me().email];
    if (this.aliases.length > 0) {
      for (let alias of this.aliases) {
        const meAlias = Contact.fromString(alias, { accountId: this.id });
        if (meAlias) {
          ret.push(meAlias.email);
        }
      }
    }
    return ret;
  }
  getAllAliasContacts() {
    const ret = this.getAllIsMeContacts();
    return ret.slice(1);
  }
  getAllIsMeContacts() {
    const ret = [this.me()];
    if (this.aliases.length > 0) {
      for (let alias of this.aliases) {
        const meAlias = Contact.fromString(alias, { accountId: this.id });
        if (meAlias) {
          ret.push(meAlias);
        }
      }
    }
    return ret;
  }
  isExchange() {
    return (this.provider || '').includes('exchange');
  }
  isOnmail() {
    return (this.provider || '').includes('onmail');
  }
  isMyEmail(emailAddress) {
    return this.getAllEmails().includes(emailAddress);
  }

  usesLabels() {
    return this.provider === 'gmail';
  }

  getNoticeTypeEnum() {
    const tmp = [...noticeTypeEnum];
    const enableFocusedInboxKey = AppEnv.config.get('core.workspace.enableFocusedInbox');
    if (enableFocusedInboxKey) {
      tmp.push({ type: 'All_include_other', title: 'All mail' });
    }
    if (this.provider === 'gmail') {
      tmp.push(...noticeTypeImportant);
    }
    return tmp;
  }

  // Public: Returns the localized, properly capitalized provider name,
  // like Gmail, Exchange, or Outlook 365
  displayProvider() {
    if (this.provider === 'eas') {
      return 'Exchange';
    } else if (this.provider === 'gmail') {
      return 'Gmail';
    } else if (this.provider === 'yahoo') {
      return 'Yahoo';
    } else if (this.provider === 'imap') {
      return 'IMAP';
    } else if (this.provider.includes('office365')) {
      return 'Office 365';
    }
    return this.provider;
  }

  canArchiveThreads() {
    CategoryStore = CategoryStore || require('../stores/category-store').default;
    return CategoryStore.getArchiveCategory(this) || (this.provider || '') === 'gmail';
  }

  canTrashThreads() {
    CategoryStore = CategoryStore || require('../stores/category-store').default;
    return CategoryStore.getTrashCategory(this);
  }

  preferredRemovalDestination() {
    CategoryStore = CategoryStore || require('../stores/category-store').default;
    const preferDelete = AppEnv.config.get('core.reading.backspaceDelete');
    if (preferDelete || !CategoryStore.getArchiveCategory(this)) {
      return CategoryStore.getTrashCategory(this);
    }
    return CategoryStore.getArchiveCategory(this);
  }
  preferDelete() {
    return AppEnv.config.get('core.reading.backspaceDelete');
  }

  hasSyncStateError() {
    return this.syncState !== Account.SYNC_STATE_OK;
  }
}
