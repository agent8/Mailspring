var AWS = require('aws-sdk');
const { version } = require('../app/package.json');
const BUCKET = 'edison-static2';

function decrypt(ciphertext) {
  const CryptoJS = require('crypto-js');
  const E_KEY = 'EDISON_MAIL';
  var bytes = CryptoJS.AES.decrypt(ciphertext, E_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

let s3options = {
  region: process.env.S3_REGION || 'ENV_S3_REGION',
  accessKeyId: decrypt(process.env.S3_ACCESSKEY_ID || 'ENV_S3_ACCESSKEY_ID'),
  secretAccessKey: decrypt(process.env.S3_SECRET_ACCESSKEY || 'ENV_S3_SECRET_ACCESSKEY'),
  Endpoint: 'http://s3.us-east-2.amazonaws.com',
};
// Set the region
AWS.config.update(s3options);

// Create S3 service object
const s3 = new AWS.S3({ apiVersion: '2006-03-01' });

uploadPkg(copyObject);

function uploadPkg(callback) {
  // call S3 to retrieve upload file to specified bucket
  var uploadParams = { Bucket: BUCKET, Key: '', Body: '' };
  var file = './app/dist/Edison Mail-mas-x64/Edison Mail.pkg';

  // Configure the file stream and obtain the upload parameters
  var fs = require('fs');
  var fileStream = fs.createReadStream(file);
  fileStream.on('error', function(err) {
    console.log('File Error', err);
  });
  uploadParams.Body = fileStream;
  uploadParams.Key = 'desktop/EdisonMail.pkg';

  // call S3 to retrieve upload file to specified bucket
  const request = s3.putObject(uploadParams, function(err, data) {
    if (err) {
      console.log('Upload Error', err);
    }
    if (data) {
      console.log('Upload Success');
      console.log(data);
      const { protocol, host } = request.httpRequest.endpoint;
      const downloadUrl = `${protocol}//${host}/${uploadParams.Key}`;
      console.log(downloadUrl);
      if (callback) {
        callback();
      }
    }
  });

  let progress;
  request.on('httpUploadProgress', function(data) {
    let p = Math.round((data.loaded / data.total) * 100);
    if (p !== progress) {
      console.log('progress:' + p);
      progress = p;
    }
  });
}

function copyObject() {
  const params = {
    Bucket: BUCKET,
    CopySource: `${BUCKET}/desktop/EdisonMail.pkg`,
    Key: `desktop/EdisonMail_${version}.pkg`,
  };
  const request = s3.copyObject(params, function(err, data) {
    if (err) {
      console.log('Copy Error', err);
    }
    if (data) {
      console.log('Copy Success');
      console.log(data);
      const { protocol, host } = request.httpRequest.endpoint;
      const downloadUrl = `${protocol}//${host}/${params.Key}`;
      console.log(downloadUrl);
    }
  });
}