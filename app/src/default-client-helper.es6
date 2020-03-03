import { exec } from 'child_process';
import fs from 'fs';
import { remote, shell } from 'electron';
const { app } = remote;
const bundleIdentifier = 'com.edisonmail.edisonmail';

class Windows {
  available() {
    return true;
  }

  isRegisteredForURLScheme(scheme, callback) {
    if (!callback) {
      throw new Error('isRegisteredForURLScheme is async, provide a callback');
    }
    let output = '';
    exec(
      `reg.exe query HKCU\\SOFTWARE\\Microsoft\\Windows\\Roaming\\OpenWith\\UrlAssociations\\${scheme}\\UserChoice`,
      (err1, stdout1) => {
        output += stdout1.toString();
        exec(
          `reg.exe query HKCU\\SOFTWARE\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\${scheme}\\UserChoice`,
          (err2, stdout2) => {
            output += stdout2.toString();
            if (err1 || err2) {
              callback(err1 || err2);
              return;
            }
            callback(output.includes('Nylas'));
          }
        );
      }
    );
  }

  resetURLScheme() {
    remote.dialog
      .showMessageBox(null, {
        type: 'info',
        buttons: ['Learn More'],
        message: 'Visit Windows Settings to change your default mail client',
        detail: "You'll find Edison Mail, along with other options, listed in Default Apps > Mail.",
      })
      .then(() => {
        shell.openExternal(
          'http://support.getmailspring.com/hc/en-us/articles/115001881412-Choose-Mailspring-as-the-default-mail-client-on-Windows'
        );
      });
  }

  registerForURLScheme(scheme, callback = () => {}) {
    // Ensure that our registry entires are present
    const WindowsUpdater = remote.require('./windows-updater');
    WindowsUpdater.createRegistryEntries(
      {
        allowEscalation: true,
        registerDefaultIfPossible: true,
      },
      (err, didMakeDefault) => {
        if (err) {
          remote.dialog.showMessageBoxSync(null, {
            type: 'error',
            buttons: ['OK'],
            message: 'Sorry, an error occurred.',
            detail: err.message,
          });
        }
        // if (!didMakeDefault) {
        //   remote.dialog.showMessageBoxSync(
        //     null,
        //     {
        //       type: 'info',
        //       buttons: ['Learn More'],
        //       defaultId: 1,
        //       message: 'Visit Windows Settings to finish making Mailspring your mail client',
        //       detail: "Click 'Learn More' to view instructions in our knowledge base.",
        //     },
        //     () => {
        //       shell.openExternal(
        //         'http://support.getmailspring.com/hc/en-us/articles/115001881412-Choose-Mailspring-as-the-default-mail-client-on-Windows'
        //       );
        //     }
        //   );
        // }
        callback(null, null);
      }
    );
  }
}

class Linux {
  available() {
    return !process.env.SNAP;
  }

  isRegisteredForURLScheme(scheme, callback) {
    if (!callback) {
      throw new Error('isRegisteredForURLScheme is async, provide a callback');
    }
    exec(`xdg-mime query default x-scheme-handler/${scheme}`, (err, stdout) =>
      err ? callback(err) : callback(stdout.trim() === 'edisonmail.desktop')
    );
  }

  resetURLScheme(scheme, callback = () => {}) {
    exec(`xdg-mime default thunderbird.desktop x-scheme-handler/${scheme}`, err =>
      err ? callback(err) : callback(null, null)
    );
  }
  registerForURLScheme(scheme, callback = () => {}) {
    exec(`xdg-mime default edisonmail.desktop x-scheme-handler/${scheme}`, err =>
      err ? callback(err) : callback(null, null)
    );
  }
}

class Mac {
  constructor() {
    this.secure = false;
  }

  available() {
    return true;
  }

  isRegisteredForURLScheme(scheme, callback) {
    if (!callback) {
      throw new Error(
        'LSSetDefaultHandlerForURLScheme is async in linux and windows, provide a callback'
      );
    }
    const isRegisteredForURL = app.isDefaultProtocolClient(scheme);
    callback(isRegisteredForURL);
  }

  resetURLScheme(scheme, callback = () => {}) {
    const removeSuccess = app.removeAsDefaultProtocolClient(scheme);
    if (removeSuccess) {
      callback();
    } else {
      callback(new Error('LSSetDefaultHandlerForURLScheme Remove Error!'));
    }
  }

  registerForURLScheme(scheme, callback = () => {}) {
    const registerSuccess = app.setAsDefaultProtocolClient(scheme);
    if (registerSuccess) {
      callback();
    } else {
      callback(new Error('LSSetDefaultHandlerForURLScheme Register Error!'));
    }
  }
}

if (process.platform === 'darwin') {
  module.exports = Mac;
} else if (process.platform === 'linux') {
  module.exports = Linux;
} else if (process.platform === 'win32') {
  module.exports = Windows;
} else {
  module.exports = {};
}
module.exports.Mac = Mac;
module.exports.Linux = Linux;
module.exports.Windows = Windows;
