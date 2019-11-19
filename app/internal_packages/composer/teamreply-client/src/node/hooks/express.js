var hooks = require("ep_etherpad-lite/static/js/pluginfw/hooks");
var express = require('express');
var settings = require('../utils/Settings');
var fs = require('fs');
var path = require('path');
var npm = require("npm/lib/npm.js");
var  _ = require("underscore");

// const ConsulConfig = require('../utils/consul');
// const consul = new ConsulConfig();
var server;
var serverName;

exports.createServer = function () {
  console.log("Report bugs at https://github.com/ether/etherpad-lite/issues")

  serverName = `Etherpad ${settings.getGitCommit()} (https://etherpad.org)`;

  console.log(`Your Etherpad version is ${settings.getEpVersion()} (${settings.getGitCommit()})`);

  exports.restartServer();

  console.log(`You can access your Etherpad instance at http://${settings.ip}:${settings.port}/`);
  if (!_.isEmpty(settings.users)) {
    console.log(`The plugin admin page is at http://${settings.ip}:${settings.port}/admin/plugins`);
  } else {
    console.warn("Admin username and password not set in settings.json.  To access admin please uncomment and edit 'users' in settings.json");
  }

  var env = process.env.AppEnv || 'development';
  console.log('process.env.AppEnv',env);
  if (env !== 'k8s-stag' && env !== 'k8s-prod') {
    console.warn("Etherpad is running in Development mode. export NODE_ENV=production");
  }
}

exports.restartServer = function () {
  if (server) {
    console.log("Restarting express server");
    server.close();
  }

  var app = express(); // New syntax for express v3

  if (settings.ssl) {
    console.log("SSL -- enabled");
    console.log(`SSL -- server key file: ${settings.ssl.key}`);
    console.log(`SSL -- Certificate Authority's certificate file: ${settings.ssl.cert}`);

    var options = {
      key: fs.readFileSync( settings.ssl.key ),
      cert: fs.readFileSync( settings.ssl.cert )
    };

    if (settings.ssl.ca) {
      options.ca = [];
      for (var i = 0; i < settings.ssl.ca.length; i++) {
        var caFileName = settings.ssl.ca[i];
        options.ca.push(fs.readFileSync(caFileName));
      }
    }

    var https = require('https');
    server = https.createServer(options, app);
  } else {
    var http = require('http');
    server = http.createServer(app);
  }

  app.use(function(req, res, next) {
    // res.header("X-Frame-Options", "deny"); // breaks embedded pads
    //yazz
    res.header("Access-Control-Allow-Origin", "*");
    res.header("access-control-expose-headers", "Authorization, *")
    if (settings.ssl) {
      // we use SSL
      res.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    // Stop IE going into compatability mode
    // https://github.com/ether/etherpad-lite/issues/2547
    res.header("X-UA-Compatible", "IE=Edge,chrome=1");

    // send git version in the Server response header if exposeVersion is true.
    if (settings.exposeVersion) {
      res.header("Server", serverName);
    }
    next();
  });
 

  if (settings.trustProxy) {
    app.enable('trust proxy');
  }

  hooks.callAll("expressConfigure", {"app": app});
  hooks.callAll("expressCreateServer", {"app": app, "server": server});

  server.listen(settings.port, settings.ip);
}
