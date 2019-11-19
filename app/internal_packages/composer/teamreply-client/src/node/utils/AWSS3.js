var AWS = require('aws-sdk');
const { DecryptFileStream } = require('./AES');
var fs = require('fs');
let s3options = {
  region: 'us-east-2',
  accessKeyId: 'AKIAJPPBMFBNHSNZ5ELA',
  secretAccessKey: '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',
  Endpoint: 'http://s3.us-east-2.amazonaws.com',
};

AWS.config.update(s3options);
var s3 = new AWS.S3();

const BUCKET_DEV = 'edison-media-stag';
const BUCKET_PROD = 'edison-media';

function getMyBucket() {
  if (process.env.AppEnv == "k8s-prod") {
    return BUCKET_PROD;
  } else {
    return BUCKET_DEV;
  }
}

exports.downloadFile = (aes, key, name) => {
  return new Promise((resolve, reject) => {
    var params = {
      Bucket: getMyBucket(),
      Key: key,
    };

    const request = s3.getObject(params);
    // 创建可读流、可写流和解密流
    const readStream = request.createReadStream();
    const writeStream = fs.createWriteStream(name);
    const decryptStream = new DecryptFileStream(aes);

    const onError = error => {
      // 发生错误关闭所有通道和流，避免内存泄漏
      readStream.unpipe();
      readStream.destroy();
      decryptStream.destroy();
      writeStream.destroy();
      reject(error);
      // 发生错误删除文件
      if (fs.existsSync(name)) {
        fs.unlinkSync(name);
      }
    };

    // 监听错误事件
    readStream.on('error', onError);
    decryptStream.on('error', onError);
    writeStream.on('error', onError);

    // 获取对象信息，为了获取长度刷新进度组件
    s3.headObject(params, (err, data) => {
      if (err) {
        onError(err);
        return;
      }
      const fileLength = data.ContentLength;

      // 进度事件
      decryptStream.on('process', loaded => {
        if (fileLength === loaded) {
          console.log('finished downloadFile: ', aes, key, name);
          resolve(request);
        }
      });
      // 流传递
      if (decryptStream.writable && writeStream.writable) {
        readStream.pipe(decryptStream).pipe(writeStream);
      }
    });
    // resolve(request);
    // return request;

  });
}