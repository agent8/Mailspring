import { RegExpUtils } from 'mailspring-exports';
import { SignatureStore, Constant } from 'mailspring-exports';

export function currentSignatureId(body) {
  let replyEnd = body.search(RegExpUtils.nativeQuoteStartRegex());
  if (replyEnd === -1) {
    replyEnd = body.length;
  }

  const signatureRegex = RegExpUtils.mailspringSignatureRegex();
  const signatureMatch = signatureRegex.exec(body.substr(0, replyEnd));
  return signatureMatch && signatureMatch[1];
}

export function applySignature(body, signature) {
  const additionalWhitespace = '<div>';
  const additionalClosingWhitespace = '<br/></div>';

  // Remove any existing signature in the body
  let newBody = body;
  if (currentSignatureId(body)) {
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

  // http://www.regexpal.com/?fam=94390
  // prefer to put the signature one <br> before the beginning of the quote,
  // if possible.
  let insertionPoint = newBody.search(RegExpUtils.nativeQuoteStartRegex());
  if (insertionPoint === -1) {
    insertionPoint = newBody.length;
  }

  if (signature) {
    const contentBefore = newBody.slice(0, insertionPoint);
    const contentAfter = newBody.slice(insertionPoint);
    return `${contentBefore}${additionalWhitespace}<edo-signature id="${
      signature.id
    }"><font style="font-size: ${Constant.Composer.defaultFontSize}, font-family: ${
      Constant.Composer.defaultFontFamily
    }">${SignatureStore.getBodyById(
      signature.id
    )}</font></edo-signature>${additionalClosingWhitespace}${contentAfter}`;
  } else {
    return newBody;
  }
}
