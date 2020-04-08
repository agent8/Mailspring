import { ComposerExtension, SignatureStore } from 'mailspring-exports';
import { applySignature } from './signature-utils';

export default class SignatureComposerExtension extends ComposerExtension {
  static prepareNewDraft = ({ draft }) => {
    // only change signature when creat a new draft
    if (!draft.pristine || draft.hasRefOldDraftOnRemote) {
      return
    }
    const contact = draft.from && draft.from[0]
    if (!contact) {
      return
    }
    const contactEmail = contact.isAlias ? contact.aliasName : contact.email
    const signatureObj =SignatureStore.signatureForEmailOrAliase(contactEmail)

    if (!signatureObj) {
      return;
    }
    draft.body = applySignature(draft.body, signatureObj);
  };
}
