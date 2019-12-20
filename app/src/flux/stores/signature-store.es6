import { Actions, AccountStore } from 'mailspring-exports';
import MailspringStore from 'mailspring-store';
import _ from 'underscore';
import path from 'path';
import fs from 'fs';

const sigDefaultTemplate = {
  id: 'initial',
  title: 'Default',
  body: `<div><div>Sent from <a href="https://www.edison.tech/">EdisonMail</a>, the best free email app for work</div></div>`,
};

class SignatureStore extends MailspringStore {
  constructor() {
    super();
    this.activate(); // for specs
  }

  activate() {
    this.signatures = AppEnv.config.get(`signatures`);
    this.signaturesBody = new Map();
    this.defaultSignatures = AppEnv.config.get(`defaultSignatures`) || {};

    // If the user has no signatures (after a clean install or upgrade from 1.0.9),
    // create a default one for them and apply it to all their accounts.
    if (!this.signatures) {
      this.signatures = {
        initial: { id: sigDefaultTemplate.id, title: sigDefaultTemplate.title },
      };
      AccountStore.accounts().forEach(a => {
        // this.defaultSignatures[a.emailAddress] = 'initial';
        this.defaultSignatures[a.emailAddress] = null;
      });
    }

    this._autoselectSignatureId();

    this._signaturesDir = path.join(AppEnv.getConfigDirPath(), 'signatures');

    fs.exists(this._signaturesDir, exists => {
      if (!exists) {
        fs.mkdir(this._signaturesDir, () => {
          fs.writeFile(
            path.join(this._signaturesDir, `${sigDefaultTemplate.id}.html`),
            sigDefaultTemplate.body,
            () => {}
          );
        });
      }
    });

    if (!this.unsubscribers) {
      this.unsubscribers = [
        Actions.removeSignature.listen(this._onRemoveSignature),
        Actions.upsertSignature.listen(this._onUpsertSignature),
        Actions.selectSignature.listen(this._onSelectSignature),
        Actions.toggleAccount.listen(this._onToggleAccount),
      ];

      AppEnv.config.onDidChange(`signatures`, () => {
        this.signatures = AppEnv.config.get(`signatures`);
        this.trigger();
      });
      AppEnv.config.onDidChange(`defaultSignatures`, () => {
        this.defaultSignatures = AppEnv.config.get(`defaultSignatures`);
        this.trigger();
      });
    }
  }

  deactivate() {
    throw new Error("Unimplemented - core stores shouldn't be deactivated.");
  }

  getSignatures() {
    return this.signatures;
  }

  selectedSignature() {
    return this.signatures[this.selectedSignatureId];
  }

  getDefaults() {
    return this.defaultSignatures;
  }

  getDefaultTemplate() {
    return sigDefaultTemplate;
  }

  getBodyById(id) {
    if (!id) {
      return '';
    }
    const bodyInTmp = this.signaturesBody.get(id);
    if (bodyInTmp) {
      return bodyInTmp;
    }

    const bodyFilePath = path.join(this._signaturesDir, `${id}.html`);
    let bodyInFile = sigDefaultTemplate.body;
    if (fs.existsSync(bodyFilePath)) {
      bodyInFile = fs.readFileSync(bodyFilePath).toString();
    } else {
      fs.writeFileSync(bodyFilePath, sigDefaultTemplate.body);
    }

    // add to cache
    this.signaturesBody.set(id, bodyInFile);
    return bodyInFile;
  }

  signatureForEmail = email => {
    return this.signatures[this.defaultSignatures[email]];
  };

  _saveSignatures() {
    _.debounce(AppEnv.config.set(`signatures`, this.signatures), 500);
  }

  _saveDefaultSignatures() {
    _.debounce(AppEnv.config.set(`defaultSignatures`, this.defaultSignatures), 500);
  }

  _onSelectSignature = id => {
    this.selectedSignatureId = id;
    this.trigger();
  };

  _autoselectSignatureId() {
    const sigIds = Object.keys(this.signatures);
    this.selectedSignatureId = sigIds.length ? sigIds[0] : null;
  }

  _onRemoveSignature = signatureToDelete => {
    this.signatures = Object.assign({}, this.signatures);
    delete this.signatures[signatureToDelete.id];
    this._onRemoveSignatureBody(signatureToDelete.id);
    this._autoselectSignatureId();
    this.trigger();
    this._saveSignatures();
  };

  _onRemoveSignatureBody = id => {
    const bodyFilePath = path.join(this._signaturesDir, `${id}.html`);
    if (fs.existsSync(bodyFilePath)) {
      fs.unlink(bodyFilePath, e => {});
    }

    // updata cache
    this.signaturesBody.delete(id);
  };

  _onUpsertSignature = (signature, id) => {
    this.signatures[id] = { id: signature.id, title: signature.title };
    this._onUpsertSignatureBody(signature.id, signature.body);
    this.trigger();
    this._saveSignatures();
  };

  _onUpsertSignatureBody = (id, body) => {
    const bodyFilePath = path.join(this._signaturesDir, `${id}.html`);
    fs.writeFileSync(bodyFilePath, body);
    // updata cache
    this.signaturesBody.set(id, body);
  };

  _onToggleAccount = email => {
    if (this.defaultSignatures[email] === this.selectedSignatureId) {
      this.defaultSignatures[email] = null;
    } else {
      this.defaultSignatures[email] = this.selectedSignatureId;
    }

    this.trigger();
    this._saveDefaultSignatures();
  };
}

export default new SignatureStore();
