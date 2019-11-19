var log4js = require('log4js');
var apiLogger = log4js.getLogger("API");
var clientLogger = log4js.getLogger("client");
var formidable = require('formidable');
// var apiHandler = require('../../handler/APIHandler');
var isValidJSONPName = require('./isValidJSONPName');
var request = require('request');
var bodyParser = require('body-parser');
var post = async function(url, data) {
  console.log('postdata',url, data);
  let pre = "https://cs.stag.easilydo.cc/tr";
  return new Promise((resolve, reject) => {
    if (!pre) {
      resolve({ code: 0, message: this.serviceName + " Service unavailability" });
      return;
    }
    url = pre + url;
    console.log('xmpp url', url);
    request({
      url: url,
      method: "POST",
      json: true,
      headers: {
        "Accept": "application/json",
        "content-type": "application/json; charset=utf-8",
      },
      body: data
    },
      function (error, response, body) {
        console.log("response from xmpp", error, body);
        if (error || !response || response.statusCode != 200) {
          console.warn(error, response ? response.statusCode : "response is null")
          resolve(null);
        } else {
          resolve(body);
        }
      });
  }).catch((error) => {
    console.error(error);
  });

}
//This is for making an api call, collecting all post information and passing it to the apiHandler
var apiCaller = async function(req, res, fields) {
  // if(Object.keys(fields).length==0 &&  req.params.func!="health"){
  //   res.end();
  //   return;
  // }
  res.header("Content-Type", "application/json; charset=utf-8");

  // apiLogger.info("REQUEST, v"+ req.params.version + ":" + req.params.func + ", " + JSON.stringify(fields));

  //wrap the send function so we can log the response
  //note: res._send seems to be already in use, so better use a "unique" name
  res._____send = res.send;
  res.send = function (response) {
    response = JSON.stringify(response);
    // apiLogger.info("RESPONSE, " + req.params.func + ", " + response);

    //is this a jsonp call, if yes, add the function call
    if(req.query.jsonp && isValidJSONPName.check(req.query.jsonp))
      response = req.query.jsonp + "(" + response + ")";

    res._____send(response);
  }

  var body = await post(req.path,req.body);
  res.send(body);
  //call the api handler
  // apiHandler.handle(req.params.version, req.params.func, fields, req, res);
}

// exports.apiCaller = apiCaller;

exports.expressCreateServer = function (hook_name, args, cb) {
  args.app.use(bodyParser.urlencoded({extended: false}));
  args.app.use(bodyParser.json());
  //This is a api GET call, collect all post informations and pass it to the apiHandler
  args.app.get('/api/:version/:func', function (req, res) {
    apiCaller(req, res, req.query)
  });

  //This is a api POST call, collect all post informations and pass it to the apiHandler
  args.app.post('/api/:version/:func', function(req, res) {
    apiCaller(req, res);
    // new formidable.IncomingForm().parse(req, function (err, fields, files) {
    //   apiCaller(req, res, fields)
    // });
  });

  //The Etherpad client side sends information about how a disconnect happened
  args.app.post('/ep/pad/connection-diagnostic-info', function(req, res) {
    new formidable.IncomingForm().parse(req, function(err, fields, files) {
      clientLogger.info("DIAGNOSTIC-INFO: " + fields.diagnosticInfo);
      res.end("OK");
    });
  });

  //The Etherpad client side sends information about client side javscript errors
  args.app.post('/jserror', function(req, res) {
    new formidable.IncomingForm().parse(req, function(err, fields, files) {
      try {
        var data = JSON.parse(fields.errorInfo)
      }catch(e){
        return res.end()
      }
      clientLogger.warn(data.msg+' --', data);
      res.end("OK");
    });
  });

  //Provide a possibility to query the latest available API version
  args.app.get('/api', function (req, res) {
     res.json({"currentVersion" : apiHandler.latestApiVersion});
  });
}
