import { exec } from 'child_process';
import fs from 'fs';
import { remote, shell } from 'electron';
const { app } = remote;
const bundleIdentifier = 'com.edisonmail.edisonmail';

export default class DefaultClientHelper {
  constructor() {
    this.secure = false;
  }

  available() {
    if (process.platform === 'linux') {
      return !process.env.SNAP;
    }
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
    if (process.platform === 'linux') {
      exec(`xdg-mime default thunderbird.desktop x-scheme-handler/${scheme}`, err =>
        err ? callback(err) : callback(null, null)
      );
      return;
    }
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
