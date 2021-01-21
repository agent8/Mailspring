/* eslint global-require: 0 */
const { getDeviceHash } = require('../system-utils');
const _ = require('underscore');
const request = require('request');
const fs = require('fs');
let processEmitter = null;
if (process.type === 'renderer') {
  processEmitter = require('electron').ipcRenderer;
} else {
  processEmitter = require('electron').ipcMain;
}
module.exports = class EdisonErrorReporter {
  constructor({ inSpecMode, inDevMode, resourcePath }) {
    this.inSpecMode = inSpecMode;
    this.inDevMode = inDevMode;
    this.resourcePath = resourcePath;
    this.deviceHash = 'Unknown Device Hash';
    this.errorStack = [];
    this._lazySend = _.throttle(this._send, 2000);

    if (!this.inSpecMode) {
      try {
        this.deviceHash = '';
        getDeviceHash().then(value => {
          this.deviceHash = value;
        });
      } catch (err) {
        console.error(err);
      }
    }
  }

  getVersion() {
    return process.type === 'renderer' ? AppEnv.getVersion() : require('electron').app.getVersion();
  }

  reportError(err, extra) {
    if (this.inSpecMode || this.inDevMode) {
      return;
    }
    this._report(err, extra, 'ERROR');
  }

  reportWarning(err, extra) {
    if (this.inSpecMode || this.inDevMode) {
      return;
    }
    this._report(err, extra, 'WARNING');
  }
  reportLog(err, extra) {
    if (this.inSpecMode || this.inDevMode) {
      return;
    }
    this._report(err, extra, 'LOG');
  }
  _report(err, extra = {}, type = 'LOG') {
    // if (!extra.osInfo) {
    //   if (typeof extra === 'string') {
    //     console.warn('extra is not an object:' + extra);
    //     extra = {
    //       errorData: extra,
    //     };
    //   }
    //   extra.osInfo = getOSInfo();
    // }
    const now = Date.now();
    if (this.deviceHash === '') {
      getDeviceHash()
        .then(
          value => {
            this.deviceHash = value;
            return Promise.resolve();
          },
          () => {
            this.deviceHash = 'Unknown Device Hash';
          }
        )
        .then(() => {
          this._sendErrorToServer({
            app: 'DESKTOP',
            platform: process.platform,
            device_id: this.deviceHash,
            level: type,
            time: now,
            version: this.getVersion(),
            logID: extra.logID || '',
            data: {
              time: now,
              version: this.getVersion(),
              error: err,
              extra: extra,
            },
          });
        });
    } else {
      this._sendErrorToServer({
        app: 'DESKTOP',
        platform: process.platform,
        device_id: this.deviceHash,
        level: type,
        time: now,
        version: this.getVersion(),
        logID: extra.logID || '',
        data: {
          time: now,
          version: this.getVersion(),
          error: err,
          extra: extra,
        },
      });
    }
  }

  _sendErrorToServer(post_data) {
    this.errorStack.push(post_data);
    this._lazySend();
  }

  _send() {
    // var content = JSON.stringify(this.errorStack);
    // var options = {
    //   host: 'cp.stag.easilydo.cc',
    //   port: 443,
    //   path: '/log/',
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Content-Length': content.length,
    //   },
    // };
    const formify = obj => {
      const ret = {};
      for (let key in obj) {
        if (key !== 'data') {
          ret[key] = obj[key];
        }
      }
      const data = obj.data;
      if (data && data.extra) {
        if (data.extra.osInfo) {
          for (let key in data.extra.osInfo) {
            ret['osInfo_' + key] = data.extra.osInfo[key];
          }
          delete data.extra.osInfo;
        }
        for (let key in data.extra) {
          if (key !== 'files') {
            if (typeof data.extra[key] !== 'string' && typeof data.extra[key] !== 'number') {
              ret[key] = JSON.stringify(data.extra[key]);
            } else {
              ret[key] = data.extra[key];
            }
          }
        }
      }
      if (data && data.error) {
        try {
          if (typeof data.error === 'string') {
            ret.error = data.error;
          } else {
            ret.error = JSON.stringify(data.error);
          }
        } catch (e) {
          console.log(e);
        }
      }
      if (data && data.extra && Array.isArray(data.extra.files)) {
        data.extra.files.forEach((filePath, index) => {
          ret[`files${index}`] = fs.createReadStream(filePath);
        });
      }
      return ret;
    };
    this.errorStack.forEach(stack => {
      const tmp = formify(stack);
      const options = { url: 'https://cs.edison.tech/api/log2/', formData: tmp, timeout: 15000 };
      if (process.env.HTTP_PROXY) {
        options.proxy = process.env.HTTP_PROXY;
      }
      if (process.env.HTTPS_PROXY) {
        options.proxy = process.env.HTTPS_PROXY;
      }
      request.post(options, (err, httpResponse, body) => {
        if (err) {
          console.log(`\n---> \nupload failed: ${err}`);
          this.onSendToServerFailed(err, tmp);
          return;
        }
        console.log(`\n---> \nupload success ${body}, ${stack.logID}`);
        this.onSendToServerSuccess(tmp);
      });
    });
    this.errorStack = [];
  }
  onSendToServerSuccess = (payload = {}) => {
    processEmitter.emit('upload-to-report-server', { status: 'complete', error: null, payload });
  };
  onSendToServerFailed = (err, payload = {}) => {
    processEmitter.emit('upload-to-report-server', { status: 'failed', error: err, payload });
  };
};