/* eslint global-require: 0 */
import AccountStore from '../stores/account-store';
import Task from './task';
import Actions from '../actions';
import Attributes from '../attributes';
import Message from '../models/message';
import SoundRegistry from '../../registries/sound-registry';
import { Composer as ComposerExtensionRegistry } from '../../registries/extension-registry';
import { LocalizedErrorStrings } from '../../mailsync-process';
import { Composer } from '../../constant';

export const SendTaskDisplayErrors = {
  ErrorSendMessage: 'ErrorSendMessage',
  ErrorSendMessageSpamSuspected: 'ErrorSendMessageSpamSuspected',
  ErrorSendMessageIllegalAttachment: 'ErrorSendMessageIllegalAttachment',
  ErrorSendMessageNotAllowed: 'ErrorSendMessageNotAllowed',
  ErrorSendMessageDailyLimitExceeded: 'ErrorSendMessageDailyLimitExceeded',
};
function applyExtensionTransforms(draft, recipient) {
  const extensions = ComposerExtensionRegistry.extensions();
  const fragment = document.createDocumentFragment();
  const draftBodyRootNode = document.createElement('root');
  fragment.appendChild(draftBodyRootNode);
  draftBodyRootNode.innerHTML = draft.body;

  for (const ext of extensions) {
    const extApply = ext.applyTransformsForSending;
    if (extApply) {
      extApply({ draft, draftBodyRootNode, recipient });
    }
  }
  return draftBodyRootNode.innerHTML;
}

export default class SendDraftTask extends Task {
  static forSending(d, { silent } = {}) {
    const task = new SendDraftTask();
    task.draft = d.clone();
    task.silent = silent;

    const separateBodies = ComposerExtensionRegistry.extensions().some(
      ext => ext.needsPerRecipientBodies && ext.needsPerRecipientBodies(task.draft)
    );

    if (separateBodies) {
      task.perRecipientBodies = {
        self: task.draft.body,
      };
      task.draft.participants({ includeFrom: false, includeBcc: true }).forEach(recipient => {
        task.perRecipientBodies[recipient.email] = applyExtensionTransforms(task.draft, recipient);
      });
    } else {
      task.draft.body = applyExtensionTransforms(task.draft, null);
    }

    return task;
  }

  static attributes = Object.assign({}, Task.attributes, {
    draft: Attributes.Object({
      modelKey: 'draft',
      itemClass: Message,
    }),
    messageId: Attributes.String({
      modelKey: 'messageId',
    }),
    perRecipientBodies: Attributes.Object({
      modelKey: 'perRecipientBodies',
    }),
    silent: Attributes.Boolean({
      modelKey: 'silent',
    }),
  });
  constructor(data) {
    super(data);
  }

  get accountId() {
    return this.draft.accountId;
  }

  set accountId(a) {
    // no-op
  }

  get messageId() {
    return this.draft.id;
  }

  set messageId(h) {
    // no-op
  }

  label() {
    return this.silent ? null : 'Sending message';
  }
  toJSON() {
    const ret = super.toJSON();
    try {
      const defaultValues = JSON.parse(ret.draft.defaultValues || '{}');
      const defaultSize = defaultValues.fontSize || Composer.defaultFontSize;
      const defaultFont = defaultValues.fontFace || Composer.defaultFontFamily;
      ret.draft.body = `<font style="font-size:${defaultSize};font-family:${defaultFont}">
        ${ret.draft.body}
      </font>`;
    } catch (e) {}
    return ret;
  }

  willBeQueued() {
    if (!this.draft.from[0]) {
      throw new Error('SendDraftTask - you must populate `from` before sending.');
    }
    const account = AccountStore.accountForEmail({
      email: this.draft.from[0].email,
      accountId: this.draft.accountId,
    });
    if (!account) {
      throw new Error('SendDraftTask - you can only send drafts from a configured account.');
    }
    if (this.draft.accountId !== account.id) {
      throw new Error(
        "The from address has changed since you started sending this draft. Double-check the draft and click 'Send' again."
      );
    }
  }

  onSuccess() {
    Actions.draftDeliverySucceeded({
      messageId: this.draft.id,
      accountId: this.draft.accountId,
    });

    // Play the sending sound
    if (AppEnv.config.get('core.sending.sounds') && !this.silent) {
      SoundRegistry.playSound('send');
    }

    // Fire off events to record the usage of open and link tracking
    const extensions = ComposerExtensionRegistry.extensions();
    for (const ext of extensions) {
      if (ext.onSendSuccess) {
        ext.onSendSuccess(this.draft);
      }
    }
  }

  onError({ key, debuginfo, retryable }) {
    if (retryable) {
      console.warn(`retrying task because ${debuginfo}`);
      return;
    }
    let errorMessage = null;
    let errorDetail = null;

    if (key === 'no-sent-folder') {
      errorMessage =
        'Your `Sent Mail` folder could not be automatically detected. Visit Preferences > Folders to choose a Sent folder and then try again.';
      errorDetail =
        'In order to send mail through Mailspring, your email account must have a Sent Mail folder. You can specify a Sent folder manually by visiting Preferences > Folders and choosing a folder name from the dropdown menu.';
    } else if (key === 'no-trash-folder') {
      errorMessage =
        'Your `Trash` folder could not be automatically detected. Visit Preferences > Folders to choose a Trash folder and then try again.';
      errorDetail =
        'In order to send mail through Mailspring, your email account must have a Trash folder. You can specify a Trash folder manually by visiting Preferences > Folders and choosing a folder name from the dropdown menu.';
    } else if (key === 'send-partially-failed') {
      const [smtpError, emails] = debuginfo.split(':::');
      errorMessage =
        "We were unable to deliver this message to some recipients. Click 'See Details' for more information.";
      errorDetail = `We encountered an SMTP Gateway error that prevented this message from being delivered to all recipients. The message was only sent successfully to these recipients:\n${emails}\n\nError: ${LocalizedErrorStrings[smtpError]}`;
    } else if (key === 'send-failed') {
      errorMessage = `We were unable to deliver this message. ${LocalizedErrorStrings[debuginfo]}`;
      errorDetail = `We encountered an SMTP error that prevented this message from being delivered:\n\n${LocalizedErrorStrings[debuginfo]}`;
    } else if (key === 'ErrorAuthentication') {
      errorMessage = `We encountered a problem with account authentication. Please make sure account is set up correctly.`;
      errorDetail = LocalizedErrorStrings[debuginfo];
    } else if (
      Object.keys(SendTaskDisplayErrors).includes(key) &&
      key !== SendTaskDisplayErrors.ErrorSendMessage
    ) {
      errorMessage = 'Email blocked by service provider';
      errorDetail = debuginfo;
    } else {
      errorMessage = 'We were unable to deliver this message.';
      errorDetail = `An unknown error occurred: ${JSON.stringify({ key, debuginfo })}`;
    }

    Actions.draftDeliveryFailed({
      threadId: this.draft.threadId,
      messageId: this.draft.id,
      draft: this.draft,
      errorKey: key,
      errorMessage,
      errorDetail,
    });
  }
}
