import MailspringStore from 'mailspring-store';
// import { Actions } from 'mailspring-exports';
import _ from 'underscore';

const STORE_KEY = 'notes';

class NoteStore extends MailspringStore {
  constructor() {
    super();
    this.notes = {};
    const notesInStorage = localStorage.getItem(STORE_KEY);
    if (notesInStorage) {
      try {
        this.notes = JSON.parse(notesInStorage);
      } catch (err) {
        console.error('NoteStore Error:', err);
      }
    }
  }

  getNoteById = threadId => {
    if (!threadId) {
      return '';
    }
    return this.notes[threadId] ? this.notes[threadId] : { content: '', labels: {} };
  };

  saveNote(threadId, content) {
    const note = this.getNoteById(threadId);
    note.content = content;
    note.lastUpdate = new Date().getTime();
    this.notes[threadId] = note;
    this._save();
  }

  setLabel(threadId, label, checked) {
    const note = this.getNoteById(threadId);
    if (!note.labels) {
      note.labels = {};
    }
    note.labels[label] = checked;
    this.notes[threadId] = note;
    this._save();
  }

  deleteNote(threadId) {
    delete this.notes[threadId];
    this._save();
  }

  _save = _.throttle(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(this.notes));
  }, 2000);
}

export default new NoteStore();
