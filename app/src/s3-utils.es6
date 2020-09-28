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

export const downloadFile = async (key, downloadFilePath) => {
  const params = {
    Bucket: BUCKET,
    Key: key,
  };
  try {
    const data = await s3.getObject(params).promise();
    fs.writeFileSync(downloadFilePath, data.Body);
    return downloadFilePath;
  } catch (err) {
    throw new Error(`Could not download file from S3: ${err.message}`);
  }
};

export const uploadFile = async (key, uploadFilePath) => {
  const readS = fs.createReadStream(uploadFilePath);
  readS.on('error', function(err) {
    throw new Error(`Could not upload file to S3: ${err.message}`);
  });
  const uploadParams = { Bucket: BUCKET, Key: key, Body: readS };
  try {
    await s3.putObject(uploadParams).promise();
  } catch (err) {
    throw new Error(`Could not upload file to S3: ${err.message}`);
  }
};
