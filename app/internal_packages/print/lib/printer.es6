import { AccountStore, Actions } from 'mailspring-exports';
import PrintWindow from './print-window';

class Printer {
  constructor() {
    this.unsubs = [
      Actions.printThread.listen(this._printThread),
      Actions.printMessage.listen(this._printMessage),
    ];
  }

  _printThread(thread, htmlContent) {
    if (!thread) throw new Error('Printing: No thread active!');
    const account = AccountStore.accountForId(thread.accountId);

    // Get the <nylas-styles> tag present in the document
    const styleTag = document.getElementsByTagName('managed-styles')[0];
    // These iframes should correspond to the message iframes when a thread is
    // focused
    const iframes = document.getElementsByTagName('iframe');
    // Grab the html inside the iframes
    const messagesHtml = [].slice.call(iframes).map(iframe => {
      return iframe.contentDocument ? iframe.contentDocument.body.innerHTML : '';
    });

    const win = new PrintWindow({
      subject: thread.subject,
      account: {
        name: account.name,
        email: account.emailAddress,
      },
      participants: thread.participants,
      styleTags: styleTag.innerHTML,
      htmlContent,
      printMessages: JSON.stringify(messagesHtml),
    });
    win.load();
  }

  _printMessage(thread, htmlContent, body) {
    if (!thread) throw new Error('Printing: No thread active!');
    const account = AccountStore.accountForId(thread.accountId);

    // Get the <nylas-styles> tag present in the document
    const styleTag = document.getElementsByTagName('managed-styles')[0];
    const fullHtmlContent = `
    <div class="message-list" id="message-list">
      <div class="messages-wrap ready scroll-region" tabindex="-1">
        <div class="scroll-region-content">
          <div class="scroll-region-content-inner">
            ${htmlContent}
          </div>
        </div>
      </div>
      <div
        class="spinner hidden paused"
        style="
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 1001;
          transform: translate(-50%, -50%);
        "
      >
        <div class="bounce1"></div>
        <div class="bounce2"></div>
        <div class="bounce3"></div>
        <div class="bounce4"></div>
      </div>
      <div
        class="message-plugin"
        style="
          flex-direction: row;
          position: relative;
          display: flex;
          height: 100%;
        "
      ></div>
    </div>`;
    const win = new PrintWindow({
      subject: thread.subject,
      account: {
        name: account.name,
        email: account.emailAddress,
      },
      participants: thread.participants,
      styleTags: styleTag.innerHTML,
      htmlContent: fullHtmlContent,
      printMessages: JSON.stringify([body]),
    });
    win.load();
  }

  deactivate() {
    this.unsubs.forEach(unsub => unsub());
  }
}

export default Printer;
