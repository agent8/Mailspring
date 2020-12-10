var AWS = require('aws-sdk');
const { version } = require('../app/package.json');
const BUCKET = 'edison-static2';
let s3options = {
  region: process.env.S3_REGION || 'ENV_S3_REGION',
  accessKeyId: process.env.S3_ACCESSKEY_ID || 'ENV_S3_ACCESSKEY_ID',
  secretAccessKey: process.env.S3_SECRET_ACCESSKEY_FOR_STATIC || 'ENV_S3_SECRET_ACCESSKEY',
  Endpoint: 'http://s3.us-east-2.amazonaws.com',
};
// Set the region
AWS.config.update(s3options);

// Create S3 service object
let s3 = new AWS.S3({ apiVersion: '2006-03-01' });

uploadDmg(copyObject);

function uploadDmg(callback) {
  // call S3 to retrieve upload file to specified bucket
  var uploadParams = { Bucket: BUCKET, Key: '', Body: '' };
  var file = './app/dist/Edison Mail.dmg';

  // Configure the file stream and obtain the upload parameters
  var fs = require('fs');
  var fileStream = fs.createReadStream(file);
  fileStream.on('error', function(err) {
    console.log('File Error', err);
  });
  uploadParams.Body = fileStream;
  uploadParams.Key = 'desktop/EdisonMail.dmg';

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
    CopySource: `${BUCKET}/desktop/EdisonMail.dmg`,
    Key: `desktop/EdisonMail_${version}.dmg`,
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
