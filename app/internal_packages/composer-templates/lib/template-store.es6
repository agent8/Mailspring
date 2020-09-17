/* eslint global-require: 0*/

import {
  DraftStore,
  ContactStore,
  AttachmentStore,
  Actions,
  QuotedHTMLTransformer,
  RegExpUtils,
  Constant,
  FsUtils,
} from 'mailspring-exports';
import { remote } from 'electron';
import MailspringStore from 'mailspring-store';
import path from 'path';
import fs from 'fs';
import _ from 'underscore';
import TemplateActions from './template-actions';
import uuid from 'uuid';

const { autoGenerateNameByNameList } = FsUtils;
const { PreferencesSubListStateEnum } = Constant;
// Support accented characters in template names
// https://regex101.com/r/nD3eY8/1
function mergeContacts(oldContacts = [], contacts = []) {
  const result = [...oldContacts];
  contacts.forEach(contact => {
    const exist = oldContacts.find(tmp => {
      return tmp.email === contact.email;
    });
    if (!exist) {
      result.push(contact);
    }
  });
  return result;
}
const WelcomeTemplate = {
  id: '4ad7f986-de23-44a6-b579-3e2f9703b943',
  title: 'Welcome to Templates',
  tsClientUpdate: 0,
  state: PreferencesSubListStateEnum.synchronized,
  attachments: [],
};

const DefaultTemplate = { title: 'Untitled', body: 'Insert content here!' };

class TemplateStore extends MailspringStore {
  constructor() {
    super();

    this._templatesDir = path.join(AppEnv.getConfigDirPath(), 'templates');
    this._welcomeName = 'Welcome to Templates.html';
    this._welcomePath = path.join(__dirname, '..', 'assets', this._welcomeName);
    this.templates = AppEnv.config.get(`templates`);
    this.templatesBody = new Map();
    this._selectedTemplateId = '';

    if (!fs.existsSync(this._templatesDir)) {
      fs.mkdirSync(this._templatesDir);
    }

    if (!this.templates || !this.templates.length) {
      const WelcomeTemplateBody = fs.readFileSync(this._welcomePath).toString();
      this.templates = [{ ...WelcomeTemplate }];
      AppEnv.config.set(`templates`, this.templates);
      this.templatesBody.set(WelcomeTemplate.id, WelcomeTemplateBody);
      fs.writeFileSync(
        path.join(this._templatesDir, `${WelcomeTemplate.id}.html`),
        WelcomeTemplateBody
      );
    }

    this._autoselectTemplateId();

    this.listenTo(TemplateActions.addTemplate, this._onAddTemplate);
    this.listenTo(TemplateActions.updateTemplate, this._onUpdateTemplate);
    this.listenTo(TemplateActions.removeTemplate, this._onRemoveTemplate);
    this.listenTo(Actions.selectTemplate, this._onSelectTemplate);
    this.listenTo(TemplateActions.showTemplates, this._onShowTemplates);

    this.listenTo(TemplateActions.insertTemplateToMessage, this._onInsertTemplateToMessage);
    this.listenTo(TemplateActions.createTemplateByMessage, this._onCreateTemplateByMessage);

    AppEnv.config.onDidChange(`templates`, () => {
      this.templates = AppEnv.config.get(`templates`);
      if (!AppEnv.isMainWindow()) {
        // compose should update the body when templates change
        this.templatesBody = new Map();
      }
      this._triggerDebounced();
    });

    this._triggerDebounced = _.debounce(() => {
      this.trigger();
    }, 20);
  }

  directory() {
    return this._templatesDir;
  }

  getTemplates() {
    return this.templates.filter(t => t.state !== PreferencesSubListStateEnum.deleted);
  }

  _getTemplateById(id) {
    return this.templates.find(t => t.id === id && t.state !== PreferencesSubListStateEnum.deleted);
  }

  selectedTemplate() {
    return this._getTemplateById(this._selectedTemplateId);
  }

  getBodyById(id) {
    if (!id) {
      return '';
    }
    const theTem = this._getTemplateById(id);
    if (!theTem) {
      return '';
    }
    const bodyInTmp = this.templatesBody.get(id);
    if (bodyInTmp) {
      return bodyInTmp;
    }

    const bodyFilePath = path.join(this._templatesDir, `${id}.html`);
    // Backward compatibility
    let bodyInFile = theTem.body ? theTem.body : DefaultTemplate.body;
    if (fs.existsSync(bodyFilePath)) {
      bodyInFile = fs.readFileSync(bodyFilePath).toString();
    } else {
      fs.writeFileSync(bodyFilePath, bodyInFile);
    }

    // add to cache
    this.templatesBody.set(id, bodyInFile);
    return bodyInFile;
  }

  _saveTemplates() {
    _.debounce(AppEnv.config.set(`templates`, this.templates), 500);
  }

  _onSelectTemplate = id => {
    this._selectedTemplateId = id;
    this._triggerDebounced();
  };

  _autoselectTemplateId() {
    const temIds = [];
    this.templates.forEach(t => {
      if (t.state !== PreferencesSubListStateEnum.deleted) {
        temIds.push(t.id);
      }
    });
    this._selectedTemplateId = temIds.length ? temIds[0] : null;
  }

  _onAddTemplate = () => {
    const newTemplateId = uuid().toLowerCase();
    const oldTempTitles = this.getTemplates().map(t => t.title);
    const newTempTitle = autoGenerateNameByNameList(oldTempTitles, DefaultTemplate.title);
    this.templates.push({
      id: newTemplateId,
      state: PreferencesSubListStateEnum.updated,
      title: newTempTitle,
      tsClientUpdate: new Date().getTime(),
      attachments: [],
    });
    this._onUpsertTemplateBody(newTemplateId, DefaultTemplate.body);
    // auto select
    this._selectedTemplateId = newTemplateId;
    this._triggerDebounced();
    this._saveTemplates();
  };

  _onUpdateTemplate = template => {
    this.templates = this.templates.map(t => {
      if (t.id === template.id) {
        return {
          id: t.id,
          state: PreferencesSubListStateEnum.updated,
          title: template.title,
          CC: template.CC,
          BCC: template.BCC,
          tsClientUpdate: new Date().getTime(),
          attachments: template.attachments || [],
        };
      }
      return t;
    });
    this._onUpsertTemplateBody(template.id, template.body);
    this._triggerDebounced();
    this._saveTemplates();
  };

  _onRemoveTemplate = templateToDelete => {
    this.templates = this.templates.map(t => {
      if (t.id === templateToDelete.id) {
        return {
          ...t,
          state: PreferencesSubListStateEnum.deleted,
        };
      }
      return t;
    });
    this._onRemoveTemplateBody(templateToDelete.id);
    this._autoselectTemplateId();
    this._triggerDebounced();
    this._saveTemplates();
  };

  _onRemoveTemplateBody = id => {
    const bodyFilePath = path.join(this._templatesDir, `${id}.html`);
    if (fs.existsSync(bodyFilePath)) {
      fs.unlinkSync(bodyFilePath);
    }
    // updata cache
    this.templatesBody.delete(id);
  };

  _onUpsertTemplateBody = (id, body) => {
    const oldBody = this.templatesBody.get(id);
    if (typeof body === 'undefined' || body === oldBody) {
      return;
    }
    const bodyFilePath = path.join(this._templatesDir, `${id}.html`);
    fs.writeFileSync(bodyFilePath, body);
    // updata cache
    this.templatesBody.set(id, body);
  };

  _onShowTemplates() {
    Actions.switchPreferencesTab('Templates');
    Actions.openPreferences();
  }

  _onInsertTemplateToMessage = ({ templateId, messageId }) => {
    const template = this._getTemplateById(templateId);
    if (!template) {
      return;
    }
    const templateBody = this.getBodyById(templateId);
    if (!templateBody) {
      return;
    }
    DraftStore.sessionForClientId(messageId).then(async session => {
      if (!session) {
        this._displayError(`Draft Session for ${messageId} not available`);
        return;
      }
      const draft = session.draft();
      if (!draft) {
        this._displayError(`Draft for ${messageId} not available`);
        return;
      }
      let proceed = true;
      const pureBody = this._getPureBodyForDraft(session.draft().body);
      if (
        (!session.draft().pristine && !this._isBodyEmpty(pureBody)) ||
        (draft.files && draft.files.length)
      ) {
        proceed = await this._displayDialog(
          'Replace draft contents?',
          'It looks like your draft already has some content. Loading this template will ' +
            'overwrite all draft contents.',
          ['Replace contents', 'Cancel']
        );
      }

      if (proceed) {
        const current = session.draft().body;
        let insertion = current.length;
        for (const s of [
          '<edo-signature',
          '<div class="gmail_quote_attribution"',
          '<blockquote class="gmail_quote"',
          '<div class="gmail_quote"',
        ]) {
          const i = current.indexOf(s);
          if (i !== -1) {
            insertion = Math.min(insertion, i);
          }
        }
        const changeObj = {
          body: `${templateBody}${current.substr(insertion)}`,
        };

        const { BCC, CC, attachments } = template;
        // Add CC, Bcc to the draft, do not delete the original CC, BCC
        if (CC) {
          const ccContacts = await ContactStore.parseContactsInString(CC);
          if (ccContacts.length) {
            changeObj['cc'] = mergeContacts(draft.cc, ccContacts);
          }
        }
        if (BCC) {
          const bccContacts = await ContactStore.parseContactsInString(BCC);
          if (bccContacts.length) {
            changeObj['bcc'] = mergeContacts(draft.bcc, bccContacts);
          }
        }
        // Replace attachments, delete the original attachments
        changeObj.files = [];
        session.changes.add(changeObj);
        const files = [];
        attachments.forEach(atta => {
          if (!atta.inline) {
            files.add(atta.path);
          }
        });
        if (files && files.length) {
          if (files.length > 1) {
            Actions.addAttachments({
              messageId: draft.id,
              accountId: draft.accountId,
              filePaths: files,
              inline: false,
            });
          } else {
            Actions.addAttachment({
              messageId: draft.id,
              accountId: draft.accountId,
              filePath: files[0],
              inline: false,
            });
          }
        }
      }
    });
  };

  _onCreateTemplateByMessage = ({ messageId }) => {
    DraftStore.sessionForClientId(messageId).then(session => {
      if (!session) {
        this._displayError(`Draft Session for ${messageId} not available`);
        return;
      }
      const draft = session.draft();
      if (!draft) {
        this._displayError(`Draft for ${messageId} not available`);
        return;
      }
      const draftName = draft.subject;

      let draftContents = QuotedHTMLTransformer.removeQuotedHTML(draft.body);
      const sigIndex = draftContents.search(RegExpUtils.mailspringSignatureRegex());
      draftContents = sigIndex > -1 ? draftContents.substr(0, sigIndex) : draftContents;

      if (!draftName || draftName.length === 0) {
        this._displayError('Give your draft a subject to name your template.');
        return;
      }

      if (!draftContents || draftContents.length === 0) {
        this._displayError('To create a template you need to fill the body of the current draft.');
        return;
      }

      const inlineAttachment = (draft.files || []).filter(attachment => attachment.isInline);
      if (inlineAttachment.length) {
        this._displayError('Sorry，template does not support inline attachments.');
        return;
      }

      const newTemplateId = uuid().toLowerCase();
      const oldTempTitles = this.getTemplates().map(t => t.title);
      const newTempTitle = autoGenerateNameByNameList(oldTempTitles, draftName);
      const newTemplate = {
        id: newTemplateId,
        state: PreferencesSubListStateEnum.updated,
        title: newTempTitle,
        tsClientUpdate: new Date().getTime(),
        attachments: [],
      };
      if (draft.files && draft.files.length) {
        const filesAddToAttachment = [];
        draft.files.forEach(f => {
          const filePath = AttachmentStore.pathForFile(f);
          const newPath = AppEnv.copyFileToPreferences(filePath);
          if (newPath) {
            filesAddToAttachment.push({
              inline: false,
              path: newPath,
            });
          }
        });
        if (filesAddToAttachment.length) {
          newTemplate['attachments'] = filesAddToAttachment;
        }
      }

      if (draft.cc && draft.cc.length) {
        const ccStr = draft.cc
          .map(contact => {
            return contact.email;
          })
          .join(',');
        newTemplate['CC'] = ccStr;
      }
      if (draft.bcc && draft.bcc.length) {
        const bccStr = draft.bcc
          .map(contact => {
            return contact.email;
          })
          .join(',');
        newTemplate['BCC'] = bccStr;
      }

      this.templates.push(newTemplate);
      this._onUpsertTemplateBody(newTemplateId, draftContents);
      // auto select
      this._selectedTemplateId = newTemplateId;
      this._triggerDebounced();
      this._saveTemplates();
      this._onShowTemplates();
    });
  };

  _displayDialog(title, message, buttons) {
    return remote.dialog
      .showMessageBox({
        title: title,
        message: title,
        detail: message,
        buttons: buttons,
        type: 'info',
      })
      .then(({ response }) => {
        return Promise.resolve(response === 0);
      });
  }

  _displayError(message) {
    AppEnv.reportError(new Error('Template Creation Error'), {
      errorData: message,
    });
    remote.dialog.showErrorBox('Template Creation Error', message);
  }

  _getPureBodyForDraft(body) {
    if (!body) {
      return '';
    }

    const bodyDom = document.createRange().createContextualFragment(body);
    // remove signature
    const signatures = bodyDom.querySelectorAll('edo-signature');
    signatures.forEach(dom => {
      dom.parentNode.removeChild(dom);
    });
    // remove gmail_quote_attribution that is replay
    const gmail_quotes = bodyDom.querySelectorAll('.gmail_quote_attribution');
    gmail_quotes.forEach(dom => {
      dom.parentNode.removeChild(dom);
    });
    // remove blockquote that is replay
    const block_quotes = bodyDom.querySelectorAll('blockquote.gmail_quote');
    block_quotes.forEach(dom => {
      dom.parentNode.removeChild(dom);
    });
    // remove gmail_quote that is forward
    const gmail_quote = bodyDom.querySelectorAll('.gmail_quote');
    gmail_quote.forEach(dom => {
      dom.parentNode.removeChild(dom);
    });

    const tmpNode = document.createElement('div');
    tmpNode.appendChild(bodyDom);
    const str = tmpNode.innerHTML;

    return str || '';
  }

  _isBodyEmpty(body) {
    if (!body) {
      return true;
    }
    const re = /(?:<.+?>)|\s|\u200b/gim;
    return body.replace(re, '').length === 0;
  }
}

export default new TemplateStore();
