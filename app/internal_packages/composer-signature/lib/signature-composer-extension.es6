import { ComposerExtension, SignatureStore } from 'mailspring-exports';
import { applySignature } from './signature-utils';

export default class SignatureComposerExtension extends ComposerExtension {
  static prepareNewDraft = ({ draft }) => {
    const contact = draft.from && draft.from[0];
    if (!contact) {
      return
    }
    const signatureId = typeof contact.signatureId === 'function' ? contact.signatureId() : `local-${contact.accountId}-${contact.email}-${contact.name}`;
    const signatureObj =SignatureStore.signatureForDefaultSignatureId(signatureId);

    if (!signatureObj) {
      return;
    }
    draft.body = applySignature(draft.body, signatureObj);
  };
}
