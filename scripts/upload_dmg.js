var AWS = require('aws-sdk');
let s3options = {
    region: 'us-east-2',
    accessKeyId: 'AKIAJPPBMFBNHSNZ5ELA',
    secretAccessKey: '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',
    Endpoint: 'http://s3.us-east-2.amazonaws.com',
};
// Set the region 
AWS.config.update(s3options);

// Create S3 service object
s3 = new AWS.S3({ apiVersion: '2006-03-01' });

// call S3 to retrieve upload file to specified bucket
var uploadParams = { Bucket: 'edison-static2', Key: '', Body: '' };
var file = './app/dist/EdisonMail.dmg';


// Configure the file stream and obtain the upload parameters
var fs = require('fs');
var fileStream = fs.createReadStream(file);
fileStream.on('error', function (err) {
    console.log('File Error', err);
});
uploadParams.Body = fileStream;
uploadParams.Key = 'desktop/EdisonMail.dmg';

// call S3 to retrieve upload file to specified bucket
const request = s3.upload(uploadParams, function (err, data) {
    if (err) {
        console.log("Upload Error", err);
    } if (data) {
        console.log("Upload Success - 1:" + data.Location);
        console.log(data);
    }
});

request.on('httpUploadProgress', function (progress) {
    if (progressCallback) {
        console.log('progress:', progress.loaded);
    }
});

