import MailspringStore from 'mailspring-store';

const EdisonMailStorageKey = 'EdisonMail-Storage';

class LocalStorage extends MailspringStore {
  constructor() {
    super();
    window.chatLocalStorage = null;
    this.loadFromLocalStorage();
  }

  loadFromLocalStorage = () => {
    if (window.chatLocalStorage) {
      return;
    }
    const storageString = window.localStorage.getItem(EdisonMailStorageKey) || '{"nicknames":{}}';
    window.chatLocalStorage = JSON.parse(storageString);
  };

  saveToLocalStorage = () => {
    window.localStorage.setItem(EdisonMailStorageKey, JSON.stringify(window.chatLocalStorage));
  };
}

module.exports = new LocalStorage();
