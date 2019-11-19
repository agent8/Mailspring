const { Transform } = require('stream');
// import crypto from 'crypto';
var crypto = require('crypto');
// 文件流解密
class DecryptFileStream extends Transform {
  constructor(aes) {
    super();
    this._loaded = 0;
    if (aes) {
      const key = Buffer.from(aes, 'base64');
      const decipher = crypto.createDecipheriv('aes-128-ecb', key, '');
      decipher.setAutoPadding(true);
      this._decipher = decipher;
    } else {
      this._decipher = null;
    }
  }
}

DecryptFileStream.prototype._transform = function(data, encoding, callback) {
  if (this._decipher) {
    this.push(this._decipher.update(data));
  } else {
    this.push(data);
  }
  this._loaded += data.length;
  // 触发进度事件
  this.emit('process', this._loaded);
  callback();
};

DecryptFileStream.prototype._flush = function(callback) {
  if (this._decipher) {
    this.push(this._decipher.final());
  }
  callback();
};

exports.DecryptFileStream=DecryptFileStream;