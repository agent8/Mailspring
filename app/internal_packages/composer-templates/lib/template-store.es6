/* eslint global-require: 0*/

import {
  DraftStore,
  ContactStore,
  Actions,
  QuotedHTMLTransformer,
  RegExpUtils,
} from 'mailspring-exports';
import { remote } from 'electron';
import MailspringStore from 'mailspring-store';
import path from 'path';
import fs from 'fs';
import _ from 'underscore';
import TemplateActions from './template-actions';

// Support accented characters in template names
// https://regex101.com/r/nD3eY8/1
const INVALID_TEMPLATE_NAME_REGEX = /[^\w\-\u00C0-\u017F\u4e00-\u9fa5 ]+/g;

class TemplateStore extends MailspringStore {
  constructor() {
    super();

    this.listenTo(TemplateActions.insertTemplateId, this._onInsertTemplateId);
    this.listenTo(TemplateActions.createTemplate, this._onCreateTemplate);
    this.listenTo(TemplateActions.showTemplates, this._onShowTemplates);
    this.listenTo(TemplateActions.deleteTemplate, this._onDeleteTemplate);
    this.listenTo(TemplateActions.renameTemplate, this._onRenameTemplate);
    this.listenTo(TemplateActions.changeTemplateField, this._onChangeTemplateField);
    this.listenTo(TemplateActions.addAttachmentsToTemplate, this._onAddAttachmentsToTemplate);
    this.listenTo(
      TemplateActions.removeAttachmentsFromTemplate,
      this._onRemoveAttachmentsFromTemplate
    );

    if (AppEnv.isMainWindow()) {
      Actions.resetSettings.listen(this.onAppSettingsReset, this);
    }

    this.templatesConfig = AppEnv.config.get(`templates`);
    AppEnv.config.onDidChange(`templates`, () => {
      this.templatesConfig = AppEnv.config.get(`templates`);
      this._triggerDebounced();
    });
    if (!this.templatesConfig) {
      this.templatesConfig = {};
    }

    this._items = [];
    this._templatesDir = path.join(AppEnv.getConfigDirPath(), 'templates');
    this._welcomeName = 'Welcome to Templates.html';
    this._welcomePath = path.join(__dirname, '..', 'assets', this._welcomeName);
    this._watcher = null;

    // I know this is a bit of pain but don't do anything that
    // could possibly slow down app launch
    fs.exists(this._templatesDir, exists => {
      if (exists) {
        this._populate();
        this.watch();
      } else {
        fs.mkdir(this._templatesDir, () => {
          fs.readFile(this._welcomePath, (err, welcome) => {
            fs.writeFile(path.join(this._templatesDir, this._welcomeName), welcome, () => {
              this.watch();
            });
          });
        });
      }
    });

    this._triggerDebounced = _.debounce(() => this.trigger(), 20);
  }

  directory() {
    return this._templatesDir;
  }

  watch() {
    if (!this._watcher) {
      AppEnv.logDebug('watching templates');
      try {
        this._watcher = fs.watch(this._templatesDir, () => this._populate());
      } catch (err) {
        // usually an ENOSPC error
        console.warn(err);
      }
    }
  }
  onAppSettingsReset = () => {
    this.unwatch();
    Actions.resetSettingsCb();
  };

  unwatch = () => {
    if (this._watcher) {
      AppEnv.logDebug('unwatching templates');
      this._watcher.close();
    }
    this._watcher = null;
  };

  items() {
    return this._items;
  }

  templateConfig(templateId) {
    return this.templatesConfig[templateId] || {};
  }

  _onTemplateConfigChange = () => {
    AppEnv.config.set(`templates`, this.templatesConfig);
    this._triggerDebounced();
  };

  _onDeleteTemplateConfig(templateId) {
    delete this.templatesConfig[templateId];
    this._onTemplateConfigChange();
  }

  _onChangeTemplateConfig(templateId, field, value) {
    const itemConfig = this.templateConfig(templateId);
    itemConfig[field] = value;
    this.templatesConfig[templateId] = itemConfig;
    this._onTemplateConfigChange();
  }
  _onRenameTemplateConfig(oldTId, newTId) {
    const itemConfig = this.templateConfig(oldTId);
    delete this.templatesConfig[oldTId];
    this.templatesConfig[newTId] = itemConfig;
    this._onTemplateConfigChange();
  }

  _populate() {
    fs.readdir(this._templatesDir, (err, filenames) => {
      if (err) {
        AppEnv.showErrorDialog({
          title: 'Cannot scan templates directory',
          message: `EdisonMail was unable to read the contents of your templates directory (${this._templatesDir}). You may want to delete this folder or ensure filesystem permissions are set correctly.`,
        });
        return;
      }
      this._items = [];
      for (let i = 0, filename; i < filenames.length; i++) {
        filename = filenames[i];
        if (filename[0] === '.') {
          continue;
        }
        const displayname = path.basename(filename, path.extname(filename));
        this._items.push({
          id: filename,
          name: displayname,
          path: path.join(this._templatesDir, filename),
        });
      }
      this._triggerDebounced();
    });
  }

  _onCreateTemplate({ messageId, name, contents } = {}, callback) {
    if (messageId) {
      this._onCreateTemplateFromDraft(messageId);
      return;
    }
    if (!name || name.length === 0) {
      this._displayError('You must provide a name for your template.');
      return;
    }
    if (!contents || contents.length === 0) {
      this._displayError('You must provide contents for your template.');
      return;
    }
    this.saveNewTemplate(name, contents, template => {
      this._onShowTemplates();
      if (callback && typeof callback === 'function') {
        callback(template);
      }
    });
  }

  _onCreateTemplateFromDraft(messageId) {
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
      const draftName = draft.subject.replace(INVALID_TEMPLATE_NAME_REGEX, '');

      let draftContents = QuotedHTMLTransformer.removeQuotedHTML(draft.body);
      const sigIndex = draftContents.search(RegExpUtils.mailspringSignatureRegex());
      draftContents = sigIndex > -1 ? draftContents.substr(0, sigIndex) : draftContents;

      if (!draftName || draftName.length === 0) {
        if (draft.subject && draft.subject.length > 0) {
          this._displayError('Template name is not valid.');
        } else {
          this._displayError('Give your draft a subject to name your template.');
        }
        return;
      }

      if (draft.files && draft.files.length) {
        this._displayError('Sorry，template does not support attachments.');
        return;
      }

      if (!draftContents || draftContents.length === 0) {
        this._displayError('To create a template you need to fill the body of the current draft.');
      }
      this.saveNewTemplate(draftName, draftContents, this._onShowTemplates);
    });
  }

  _onShowTemplates() {
    Actions.switchPreferencesTab('Templates');
    Actions.openPreferences();
  }

  _displayError(message) {
    AppEnv.reportError(new Error('Template Creation Error'), { errorData: message });
    remote.dialog.showErrorBox('Template Creation Error', message);
  }

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

  saveNewTemplate(name, contents, callback) {
    if (!name || name.length === 0) {
      this._displayError('You must provide a template name.');
      return;
    }

    if (name.match(INVALID_TEMPLATE_NAME_REGEX)) {
      this._displayError(
        'Invalid template name! Names can only contain letters, numbers, spaces, dashes, and underscores.'
      );
      return;
    }

    let number = 1;
    let resolvedName = name;
    const sameName = t => t.name === resolvedName;
    while (this._items.find(sameName)) {
      resolvedName = `${name} ${number}`;
      number += 1;
    }
    this.saveTemplate(resolvedName, contents, callback);
    this._triggerDebounced();
  }

  saveTemplate(name, contents, callback) {
    const filename = `${name}.html`;
    const templatePath = path.join(this._templatesDir, filename);
    let template = this._items.find(t => t.name === name);

    this.unwatch();
    fs.writeFile(templatePath, contents, err => {
      this.watch();
      if (err) {
        this._displayError(err);
      }
      if (!template) {
        template = {
          id: filename,
          name: name,
          path: templatePath,
        };
        this._items.unshift(template);
      }
      if (callback) {
        callback(template);
      }
    });
  }

  async _onDeleteTemplate(name) {
    const template = this._items.find(t => t.name === name);
    if (!template) {
      return;
    }
    fs.unlink(template.path, () => {
      this._populate();
    });
    this._onDeleteTemplateConfig(template.id);
  }

  _onChangeTemplateField(name, field, value) {
    const template = this._items.find(t => t.name === name);
    if (!template) {
      return;
    }
    this._onChangeTemplateConfig(template.id, field, value);
  }

  _onAddAttachmentsToTemplate(name, paths) {
    if (!paths || !paths.length) {
      return;
    }
    const template = this._items.find(t => t.name === name);
    if (!template) {
      return;
    }
    const itemConfig = this.templateConfig(template.id);
    const files = itemConfig.files || [];
    itemConfig.files = [...files, ...paths];
    this.templatesConfig[template.id] = itemConfig;
    this._onTemplateConfigChange();
  }

  _onRemoveAttachmentsFromTemplate(name, indexs) {
    if (!indexs || !indexs.length) {
      return;
    }
    const template = this._items.find(t => t.name === name);
    if (!template) {
      return;
    }
    const itemConfig = this.templateConfig(template.id);
    const files = itemConfig.files || [];
    itemConfig.files = files.filter((file, index) => !indexs.includes(index));
    this.templatesConfig[template.id] = itemConfig;
    this._onTemplateConfigChange();
  }

  _onRenameTemplate(name, newName) {
    const template = this._items.find(t => t.name === name);
    if (!template) {
      return;
    }
    const oldTId = template.id;

    if (newName.match(INVALID_TEMPLATE_NAME_REGEX)) {
      this._displayError(
        'Invalid template name! Names can only contain letters, numbers, spaces, dashes, and underscores.'
      );
      return;
    }
    if (newName.length === 0) {
      this._displayError('You must provide a template name.');
      return;
    }

    const newFilename = `${newName}.html`;
    const oldPath = path.join(this._templatesDir, `${name}.html`);
    const newPath = path.join(this._templatesDir, newFilename);
    fs.rename(oldPath, newPath, () => {
      template.name = newName;
      template.id = newFilename;
      template.path = newPath;
      this._onRenameTemplateConfig(oldTId, template.id);
      this._triggerDebounced();
    });
  }

  _onInsertTemplateId({ templateId, messageId } = {}) {
    const template = this._items.find(t => t.id === templateId);
    const templateBody = fs.readFileSync(template.path).toString();
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
      if (!session.draft().pristine && !this._isBodyEmpty(pureBody)) {
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
        const changeObj = { body: `${templateBody}${current.substr(insertion)}` };
        const { BCC, CC, files } = this.templateConfig(template.id);
        if (CC) {
          const ccContacts = await ContactStore.parseContactsInString(CC);
          if (ccContacts.length) {
            changeObj['cc'] = ccContacts;
          }
        }
        if (BCC) {
          const bccContacts = await ContactStore.parseContactsInString(BCC);
          if (bccContacts.length) {
            changeObj['bcc'] = bccContacts;
          }
        }

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

        session.changes.add(changeObj);
      }
    });
  }

  _isBodyEmpty(body) {
    if (!body) {
      return true;
    }

    const re = /(?:<.+?>)|\s/gim;
    return body.replace(re, '').length === 0;
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
}

export default new TemplateStore();
