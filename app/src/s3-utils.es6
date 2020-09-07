const AWS = require('aws-sdk');
const { remote } = require('electron');
const fs = require('fs');
const path = require('path');
const {
  AwsBucketStag,
  AwsBucketProd,
  AwsRegionType,
  AwsEndpointUrl,
  AWSAccessKey,
  AWSSecretKey,
} = require('./constant');

let app;
if (process.type === 'renderer') {
  app = remote.getGlobal('application');
} else {
  app = global.application;
}
const isStag = app.isStag;

const BUCKET = isStag ? AwsBucketStag : AwsBucketProd;
const s3options = {
  region: AwsRegionType,
  accessKeyId: AWSAccessKey,
  secretAccessKey: AWSSecretKey,
  Endpoint: AwsEndpointUrl,
};
// Set the region
AWS.config.update(s3options);

// Create S3 service object
const s3 = new AWS.S3();

export const downloadFile = (key, downloadFilePath) => {
  return new Promise((resolve, reject) => {
    var params = {
      Bucket: BUCKET,
      Key: key,
    };

    s3.getObject(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        const fileBuffer = data.Body;
        fs.writeFileSync(downloadFilePath, fileBuffer);
        resolve(downloadFilePath);
      }
    });
  });
};

export const uploadFile = (key, uploadFilePath) => {
  return new Promise((resolve, reject) => {
    const readS = fs.createReadStream(uploadFilePath);
    readS.on('error', function(err) {
      reject(err);
    });
    var uploadParams = { Bucket: BUCKET, Key: key, Body: readS };
    s3.putObject(uploadParams, (err, data) => {
      if (err) {
        reject(err);
      } else if (data) {
        console.log('finished Upload: ', key, uploadFilePath);
        resolve();
      }
    });
  });
};
