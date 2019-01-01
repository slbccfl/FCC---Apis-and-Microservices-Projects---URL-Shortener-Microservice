'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
mongoose.connect(process.env.MONGO_URI);

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
app.use(bodyParser.urlencoded({'extended': false}));

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

  
// your first API endpoint... 
app.get("/api/hello", function (req, res) {
  res.json({greeting: 'hello API'});
});

// Schema's for short url counter and url catalog

var Schema = mongoose.Schema;

// Models - Counter and UrlCatalog

var Counter = new Schema ({
  count : {type: Number, default: 1}
});

var Counter = mongoose.model('Counter', Counter);

var UrlCatalog = new Schema ({
  url : {type: String, required: true},
  index : {type: Number, required: true}
});

var UrlCatalog = mongoose.model('UrlCatalog', UrlCatalog);

// Controller

var dns = require('dns');

function extractHostname(url) {
    var hostname;
    //find & remove protocol (http, ftp, etc.) and get hostname

    if (url.indexOf("//") > -1) {
        hostname = url.split('/')[2];
    }
    else {
        hostname = url.split('/')[0];
    }

    //find & remove port number
    hostname = hostname.split(':')[0];
    //find & remove "?"
    hostname = hostname.split('?')[0];

    return hostname;
}

function getNextCount(req, res, callback) {
  Counter.findOneAndUpdate({}, {$inc:{'count': 1}}, function(err, data) {
    if (err) return err;
    if (data) {
      callback(data.count);
    } else {
      var newCount = new Counter();
      newCount.save(function(err) {
        if (err) return err;
        Counter.findOneAndUpdate({}, {$inc:{'count': 1}},function(err, data) {
          if (err) return err;
          callback(data.count);
        });
      })
    }
  });
}

function findUrl(req, res, url) {
  UrlCatalog.findOne({'url': url}, function(err, storedUrl) {
    if (err) return err;
    if (storedUrl) {
      // URL was found in DB, respond with the match
      res.json({'original_url': url, 'short_url':storedUrl.index});
    } else {
      // Url not found: Get a the next count and store the new Url
      getNextCount(req, res, function(count) {
        var newUrlEntry = new UrlCatalog({'url': url, 'index': count});
        newUrlEntry.save(function(err) {
          if (err) return err;
          res.json({'original_url': url, 'short_url': count});
        });
      });
    }
  })
}


app.post('/api/shorturl/new', function(req, res) {
  var newUrl = req.body.url;
  
  dns.lookup(extractHostname(newUrl), function(err) {
    if (err) {
      res.json({'error': 'invalid Hostname'});
    } else {
      findUrl(req, res, newUrl);
    }
    
  });
});

app.get('/api/shorturl/:urlNumber', function (req, res) {
  var urlNumber = req.params.urlNumber;
  if (isNaN(urlNumber)) {
    res.jjson({"error":"Wrong Format"});
    return
  }
  UrlCatalog.findOne({"index": urlNumber}, function (err, data) {
    if (err) return err;
    if (data) {
      res.redirect(data.url);
    } else {
      res.json({"error":"No short url found for given input"});
    }
  });
  
});

app.listen(port, function () {
  console.log('Node.js listening ...');
});


