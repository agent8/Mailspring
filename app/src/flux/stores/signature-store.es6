import { Actions, Constant } from 'mailspring-exports';
import MailspringStore from 'mailspring-store';
import _ from 'underscore';
import path from 'path';
import fs from 'fs';
import uuid from 'uuid';
import { autoGenerateNameByNameList } from '../../fs-utils';

const { PreferencesSubListStateEnum } = Constant;

const sigDefaultTemplate = {
  id: '4ad7f986-de23-44a6-b579-3e2f9703b943',
  title: 'Untitled',
  tsClientUpdate: 0,
  state: PreferencesSubListStateEnum.synchronized,
  attachments: [],
  body: `<div>Sent from <a href="https://www.edison.tech/">EdisonMail</a>, the best free email app for work</div>`,
};

class SignatureStore extends MailspringStore {
  constructor() {
    super();
    this.activate();
  }

  activate() {
    this._signaturesDir = path.join(AppEnv.getConfigDirPath(), 'signatures');
    this.signatures = AppEnv.config.get(`signatures`);
    this.signaturesBody = new Map();
    this.defaultSignatures = AppEnv.config.get(`defaultSignatures`) || {};
    this.selectedSignatureId = '';
    this._triggerDebounced = _.debounce(() => {
      this.trigger();
    }, 20);

    if (!fs.existsSync(this._signaturesDir)) {
      fs.mkdirSync(this._signaturesDir);
    }

    if (!this.signatures || !this.signatures.length) {
      AppEnv.config.set(`signatures`, [{ ...sigDefaultTemplate }]);
      this.signaturesBody.set(sigDefaultTemplate.id, sigDefaultTemplate.body);
      fs.writeFileSync(
        path.join(this._signaturesDir, `${sigDefaultTemplate.id}.html`),
        sigDefaultTemplate.body
      );
    }

    this._autoselectSignatureId();

    this.listenTo(Actions.addSignature, this._onAddSignature);
    this.listenTo(Actions.updateSignature, this._onUpdateSignature);
    this.listenTo(Actions.removeSignature, this._onRemoveSignature);
    this.listenTo(Actions.selectSignature, this._onSelectSignature);
    this.listenTo(Actions.toggleAliasesSignature, this._onToggleAliasesSignature);

    AppEnv.config.onDidChange(`signatures`, () => {
      this.signatures = AppEnv.config.get(`signatures`);
      if (!AppEnv.isMainWindow()) {
        // compose should update the body when signature change
        this.signaturesBody = new Map();
      }
      this._triggerDebounced();
    });
    AppEnv.config.onDidChange(`defaultSignatures`, () => {
      this.defaultSignatures = AppEnv.config.get(`defaultSignatures`);
      this._triggerDebounced();
    });
  }

  deactivate() {
    throw new Error("Unimplemented - core stores shouldn't be deactivated.");
  }

  getSignatures() {
    return this.signatures.filter(sig => sig.state !== PreferencesSubListStateEnum.deleted);
  }

  _getSignatureById(id) {
    return this.signatures.find(
      sig => sig.id === id && sig.state !== PreferencesSubListStateEnum.deleted
    );
  }

  selectedSignature() {
    return this._getSignatureById(this.selectedSignatureId);
  }

  getDefaults() {
    return this.defaultSignatures;
  }

  setDefaultSignature(accountSigId, sigId) {
    const theSig = this._getSignatureById(sigId);
    if (!theSig) {
      return;
    }
    this.defaultSignatures[accountSigId] = sigId;
    this._triggerDebounced();
    this._saveDefaultSignatures();
  }

  removeDefaultSignature(accountSigId) {
    if (this.defaultSignatures[accountSigId]) {
      delete this.defaultSignatures[accountSigId];
      this._triggerDebounced();
      this._saveDefaultSignatures();
    }
  }

  getBodyById(id) {
    if (!id) {
      return '';
    }
    const theSig = this._getSignatureById(id);
    if (!theSig) {
      return '';
    }
    const bodyInTmp = this.signaturesBody.get(id);
    if (bodyInTmp) {
      return bodyInTmp;
    }

    const bodyFilePath = path.join(this._signaturesDir, `${id}.html`);
    // Backward compatibility
    let bodyInFile = theSig.body ? theSig.body : sigDefaultTemplate.body;
    if (fs.existsSync(bodyFilePath)) {
      bodyInFile = fs.readFileSync(bodyFilePath).toString();
    } else {
      fs.writeFileSync(bodyFilePath, bodyInFile);
    }

    // add to cache
    this.signaturesBody.set(id, bodyInFile);
    return bodyInFile;
  }

  signatureForDefaultSignatureId = emailOrAliase => {
    const sigId = this.defaultSignatures[emailOrAliase];
    return this._getSignatureById(sigId);
  };

  _saveSignatures() {
    _.debounce(AppEnv.config.set(`signatures`, this.signatures), 500);
  }

  _saveDefaultSignatures() {
    _.debounce(AppEnv.config.set(`defaultSignatures`, this.defaultSignatures), 500);
  }

  _onSelectSignature = id => {
    this.selectedSignatureId = id;
    this._triggerDebounced();
  };

  _autoselectSignatureId() {
    const sigIds = [];
    this.signatures.forEach(sig => {
      if (sig.state !== PreferencesSubListStateEnum.deleted) {
        sigIds.push(sig.id);
      }
    });
    this.selectedSignatureId = sigIds.length ? sigIds[0] : null;
  }

  _onAddSignature = () => {
    const newSigId = uuid().toLowerCase();
    const oldSigTitles = this.getSignatures().map(s => s.title);
    const newSigTitle = autoGenerateNameByNameList(oldSigTitles, sigDefaultTemplate.title);
    this.signatures.push({
      id: newSigId,
      state: PreferencesSubListStateEnum.updated,
      title: newSigTitle,
      tsClientUpdate: new Date().getTime(),
      attachments: [],
    });
    this._onUpsertSignatureBody(newSigId, sigDefaultTemplate.body);
    // auto select
    this.selectedSignatureId = newSigId;
    this._triggerDebounced();
    this._saveSignatures();
  };

  _onUpdateSignature = signature => {
    this.signatures = this.signatures.map(sig => {
      if (sig.id === signature.id) {
        return {
          id: sig.id,
          state: PreferencesSubListStateEnum.updated,
          title: signature.title,
          tsClientUpdate: new Date().getTime(),
          attachments: signature.attachments || [],
        };
      }
      return sig;
    });
    this._onUpsertSignatureBody(signature.id, signature.body);
    this._triggerDebounced();
    this._saveSignatures();
  };

  _onRemoveSignature = signatureToDelete => {
    this.signatures = this.signatures.map(sig => {
      if (sig.id === signatureToDelete.id) {
        return {
          ...sig,
          state: PreferencesSubListStateEnum.deleted,
        };
      }
      return sig;
    });
    this._onRemoveSignatureBody(signatureToDelete.id);
    this._autoselectSignatureId();
    this._triggerDebounced();
    this._saveSignatures();
  };

  _onRemoveSignatureBody = id => {
    const bodyFilePath = path.join(this._signaturesDir, `${id}.html`);
    if (fs.existsSync(bodyFilePath)) {
      fs.unlinkSync(bodyFilePath);
    }
    // updata cache
    this.signaturesBody.delete(id);
  };

  _onUpsertSignatureBody = (id, body) => {
    const oldBody = this.signaturesBody.get(id);
    if (typeof body === 'undefined' || body === oldBody) {
      return;
    }
    const bodyFilePath = path.join(this._signaturesDir, `${id}.html`);
    fs.writeFileSync(bodyFilePath, body);
    // updata cache
    this.signaturesBody.set(id, body);
  };

  _onToggleAliasesSignature = alias => {
    const signatureId =
      typeof alias.signatureId === 'function'
        ? alias.signatureId()
        : `local-${alias.accountId}-${alias.email}-${alias.name}`;
    if (this.defaultSignatures[signatureId] === this.selectedSignatureId) {
      this.defaultSignatures[signatureId] = null;
    } else {
      this.defaultSignatures[signatureId] = this.selectedSignatureId;
    }

    this._triggerDebounced();
    this._saveDefaultSignatures();
  };
}

export default new SignatureStore();
