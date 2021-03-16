import {
  RegExpUtils,
  DraftStore,
  SignatureStore,
  AttachmentStore,
  Actions,
  Constant,
} from 'mailspring-exports';
import path from 'path';

export function currentSignatureId(body) {
  let replyEnd = body.search(RegExpUtils.nativeQuoteStartRegex());
  if (replyEnd === -1) {
    replyEnd = body.length;
  }

  const signatureRegex = RegExpUtils.mailspringSignatureRegex();
  const signatureMatch = signatureRegex.exec(body.substr(0, replyEnd));
  return signatureMatch && signatureMatch[1];
}

const getSessionByMessageId = messageId => {
  return new Promise((resolve, reject) => {
    DraftStore.sessionForClientId(messageId)
      .then(session => {
        resolve(session);
      })
      .catch(err => {
        reject(err);
      });
  });
};

export async function applySignature({ signature, messageId, skipSaving = false }) {
  const session = await getSessionByMessageId(messageId);
  if (!session) {
    this._displayError(`Draft Session for ${messageId} not available`);
    return;
  }
  const draft = session.draft();
  if (!draft) {
    this._displayError(`Draft for ${messageId} not available`);
    return;
  }
  // remove old signature
  const additionalWhitespace = '<div>';
  const additionalClosingWhitespace = '<br/></div>';
  // // // Remove any existing signature in the body
  let newBody = draft.body;
  if (currentSignatureId(draft.body)) {
    const bodyTmpList = newBody.split(RegExpUtils.mailspringSignatureRegex());
    // should remove additionalWhitespace and additionalClosingWhitespace
    const additionalWhitespaceReg = new RegExp(`${additionalWhitespace}$`);
    const additionalClosingWhitespaceReg = new RegExp(`^${additionalClosingWhitespace}`);
    // remove additionalWhitespace
    const bodyTmpStart = (bodyTmpList[0] || '').replace(additionalWhitespaceReg, '');
    // remove additionalClosingWhitespace
    const bodyTmpEnd = (bodyTmpList[2] || '').replace(additionalClosingWhitespaceReg, '');
    newBody = bodyTmpStart + bodyTmpEnd;
  }
  // // // remove old signature attachment
  const removeFiles = draft.files.filter(f => {
    if (!f.isInline) {
      return false;
    }
    const fileInBody = newBody.indexOf(`src="cid:${f.contentId}"`) >= 0;
    return !fileInBody;
  });
  Actions.removeAttachments({
    accountId: draft.accountId,
    messageId: draft.id,
    filesToRemove: removeFiles,
  });

  // add new signature
  if (signature) {
    const { attachments, id } = signature;
    const sigBody = SignatureStore.getPureBodyById(id);
    const fileMap = await AttachmentStore.addSigOrTempAttachments(
      attachments,
      draft.id,
      draft.accountId,
      skipSaving
    );
    const replaceStr = (oldStr, searchStr, replaceStr) => {
      const oldStrSplit = oldStr.split(searchStr);
      return oldStrSplit.join(replaceStr);
    };
    let newSigBody = sigBody;
    fileMap.forEach((file, key) => {
      if (file.isInline) {
        const urlPath = path.join(path.dirname(key), encodeURIComponent(path.basename(key)));
        newSigBody = replaceStr(newSigBody, `src="${urlPath}"`, `src="cid:${file.contentId}"`);
      }
      draft.files.push(file);
    });

    // http://www.regexpal.com/?fam=94390
    // prefer to put the signature one <br> before the beginning of the quote,
    // if possible.
    let insertionPoint = newBody.search(RegExpUtils.nativeQuoteStartRegex());
    if (insertionPoint === -1) {
      insertionPoint = newBody.length;
    }
    const contentBefore = newBody.slice(0, insertionPoint);
    const contentAfter = newBody.slice(insertionPoint);
    newBody = `${contentBefore}${additionalWhitespace}<edo-signature id="${id}"><font style="font-size: ${Constant.Composer.defaultFontSize}, font-family: ${Constant.Composer.defaultFontFamily}">${newSigBody}</font></edo-signature>${additionalClosingWhitespace}${contentAfter}`;
  }
  session.changes.add({ body: newBody }, { skipSaving });
}
