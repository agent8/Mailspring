import MailspringStore from 'mailspring-store';
import Contact from '../models/contact';
import Matcher from '../attributes/matcher';
import RegExpUtils from '../../regexp-utils';
import DatabaseStore from './database-store';
import AccountStore from './account-store';
import ComponentRegistry from '../../registries/component-registry';
import TaskFactory from '../tasks/task-factory';
import Actions from '../actions';
import MailcoreProviderSettings from '../../../internal_packages/onboarding/lib/mailcore-provider-settings';
import Utils from '../models/utils';
const contactKey = 'contacts';
const currentVersion = 1;
const defaultData = { version: currentVersion };
const localStorage = window.localStorage;

/**
Public: ContactStore provides convenience methods for searching contacts and
formatting contacts. When Contacts become editable, this store will be expanded
with additional actions.

Section: Stores
*/
class ContactStore extends MailspringStore {
  findAllContactsByEmail(emailAddress) {
    return DatabaseStore.findAll(Contact).where([Contact.attributes.email.equal(emailAddress)]);
  }
  getMergedContactByEmail = emailAddress => {
    return new Promise((resolve, reject) => {
      this.findAllContactsByEmail(emailAddress).then(result => {
        let ret = null;
        if (Array.isArray(result) && result.length > 0) {
          result.forEach(contact => {
            if (ret && contact) {
              ret.refs += contact.refs;
              ret.sendToCount += contact.sendToCount;
              ret.recvFromCount += contact.recvFromCount;
            } else {
              ret = contact;
            }
          });
        }
        return ret;
      }, reject);
    });
  };
  getContactTypeForAllAccount = emailAddress => {
    return new Promise((resolve, reject) => {
      if (
        typeof emailAddress === 'string' &&
        emailAddress.length > 0 &&
        emailAddress.includes('@')
      ) {
        this.getMergedContactByEmail(emailAddress).then(contact => {
          const ret = { isColleague: false, isStrange: false, isWellKnownProvider: false };
          const domain = emailAddress
            .split('@')
            .pop()
            .toLocaleLowerCase();
          for (const template of Object.values(MailcoreProviderSettings)) {
            if (ret.isWellKnownProvider) {
              break;
            }
            if (Array.isArray(template['domain-match'])) {
              for (const test of template['domain-match']) {
                if (new RegExp(`(^${test}$)|(\.${test}$)`).test(domain)) {
                  ret.isWellKnownProvider = true;
                  break;
                }
              }
            }
          }
          if (!ret.isWellKnownProvider) {
            for (const myEmail of AccountStore.emailAddresses()) {
              if (Utils.emailsHaveSameDomain(emailAddress, myEmail)) {
                ret.isColleague = true;
              }
            }
          }
          const isNewContact = contact.sendToCount < 1 && contact.recvFromCount < 5;
          ret.isStrange = !ret.isColleague && isNewContact;
          resolve(ret);
        }, reject);
      } else {
        reject(new Error('Email Address invalid'));
      }
    });
  };
  // Public: Search the user's contact list for the given search term.
  // This method compares the `search` string against each Contact's
  // `name` and `email`.
  //
  // - `search` {String} A search phrase, such as `ben@n` or `Ben G`
  // - `options` (optional) {Object} If you will only be displaying a few results,
  //   you should pass a limit value. {::searchContacts} will return as soon
  //   as `limit` matches have been found.
  //
  // Returns an {Array} of matching {Contact} models
  //
  searchContacts(_search, options = {}) {
    const limit = Math.max(options.limit ? options.limit : 10, 0);
    const displayLimit = Math.max(options.displayLimit ? options.displayLimit : limit, 0);
    const search = _search.toLowerCase();

    const accountCount = AccountStore.accounts().length;
    const extensions = ComponentRegistry.findComponentsMatching({
      role: 'ContactSearchResults',
    });

    if (!search || search.length === 0) {
      return Promise.resolve([]);
    }

    // If we haven't found enough items in memory, query for more from the
    // database. Note that we ask for LIMIT * accountCount because we want to
    // return contacts with distinct email addresses, and the same contact
    // could exist in every account. Rather than make SQLite do a SELECT DISTINCT
    // (which is very slow), we just ask for more items.
    const query = DatabaseStore.findAll(Contact)
      // .search(search)
      .where(
        new Matcher.Or([
          Contact.attributes.name.like(search),
          Contact.attributes.email.like(search),
        ])
      )
      .limit(limit * accountCount)
      .order([
        Contact.attributes.sentToFrequency.descending(),
        Contact.attributes.sendToCount.descending(),
      ]);

    return query.then(async _results => {
      // remove query results that were already found in ranked contacts
      let results = this._distinctByEmail(_results);
      for (const ext of extensions) {
        results = await ext.findAdditionalContacts(search, results);
      }
      if (results.length > displayLimit) {
        results.length = displayLimit;
      }
      if (options.filterRobotContact) {
        return results.filter(c => !this.isRobotContact(c));
      }
      return results;
    });
  }

  topContacts({ limit = 10, filterRobotContact = false } = {}) {
    const accountCount = AccountStore.accounts().length;
    return DatabaseStore.findAll(Contact)
      .limit(limit * accountCount)
      .order([
        Contact.attributes.sentToFrequency.descending(),
        Contact.attributes.sendToCount.descending(),
      ])
      .then(async _results => {
        let results = this._distinctByEmail(_results);
        if (results.length > limit) {
          results.length = limit;
        }
        if (filterRobotContact) {
          return results.filter(c => !this.isRobotContact(c));
        }
        return results;
      });
  }

  isValidContact(contact) {
    return contact instanceof Contact ? contact.isValid() : false;
  }
  isRobotContact(contact) {
    return contact instanceof Contact ? contact.isRobot() : false;
  }

  parseContactsInString(contactString, { skipNameLookup } = {}) {
    const detected = [];
    const emailRegex = RegExpUtils.emailRegex();
    let lastMatchEnd = 0;
    let match = null;

    while ((match = emailRegex.exec(contactString))) {
      let email = match[0];
      let name = null;

      const startsWithQuote = ["'", '"'].includes(email[0]);
      const hasTrailingQuote = ["'", '"'].includes(contactString[match.index + email.length]);
      if (startsWithQuote && hasTrailingQuote) {
        email = email.slice(1, email.length - 1);
      }

      const hasLeadingParen = ['(', '<'].includes(contactString[match.index - 1]);
      const hasTrailingParen = [')', '>'].includes(contactString[match.index + email.length]);

      if (hasLeadingParen && hasTrailingParen) {
        let nameStart = lastMatchEnd;
        for (const char of [',', ';', '\n', '\r']) {
          const i = contactString.lastIndexOf(char, match.index);
          if (i + 1 > nameStart) {
            nameStart = i + 1;
          }
        }
        name = contactString.substr(nameStart, match.index - 1 - nameStart).trim();
      }

      // The "nameStart" for the next match must begin after lastMatchEnd
      lastMatchEnd = match.index + email.length;
      if (hasTrailingParen) {
        lastMatchEnd += 1;
      }

      if (!name || name.length === 0) {
        name = email;
      }

      // If the first and last character of the name are quotation marks, remove them
      if (['"', "'"].includes(name[0]) && ['"', "'"].includes(name[name.length - 1])) {
        name = name.slice(1, name.length - 1);
      }

      detected.push(new Contact({ email, name }));
    }

    if (skipNameLookup) {
      return Promise.resolve(detected);
    }

    return Promise.all(
      detected.map(contact => {
        if (contact.name !== contact.email) {
          return contact;
        }
        return this.searchContacts(contact.email, { limit: 1 }).then(([smatch]) =>
          smatch && smatch.email === contact.email ? smatch : contact
        );
      })
    );
  }

  _distinctByEmail(contacts) {
    // remove query results that are duplicates, prefering ones that have names
    const uniq = {};
    for (const contact of contacts) {
      if (!contact.email) {
        continue;
      }
      const key = contact.email.toLowerCase();
      const existing = uniq[key];
      if (!existing || !existing.name || existing.name === existing.email) {
        uniq[key] = contact;
      }
    }
    return Object.values(uniq);
  }
  updateContactToDB({ newContact, accountId, draft } = {}) {
    const task = TaskFactory.taskForUpdatingContact({ newContact, accountId, draft });
    if (task) {
      Actions.queueTask(task);
      try {
        let localContactStr = localStorage.getItem(contactKey);
        if (!localContactStr) {
          localContactStr = JSON.stringify(defaultData);
        }
        const localContacts = JSON.parse(localContactStr);
        if (!Object.prototype.hasOwnProperty.call(localContacts, 'version')) {
          localContacts.version = 1;
        }
        if (!localContacts[task.accountId]) {
          localContacts[task.accountId] = {};
        }
        localContacts[task.accountId][newContact.email] = newContact.name;
        localStorage.setItem(contactKey, JSON.stringify(localContacts));
      } catch (e) {
        AppEnv.logError(`Saving contact update to localstorage failed ${e}`);
      }
    }
  }
}

export default new ContactStore();
