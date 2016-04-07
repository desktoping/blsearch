var co = require('co'),
  dotenv = require('dotenv'),
  kue = require("kue"),
  fs = require('fs'),
  req = require('superagent'),

q = kue.createQueue();
dotenv.load({path: __dirname + '/.env'});

q.process('bl-jobs', function (job, done) {
  console.log('working on job %d', job.id);
  
  var arrXml = [],
      xml = '',
      ctr = 0,
      data = job.data;

  function cleanString(string) {
    return string.replace("\'", " ").replace("\"", " ").replace(">", " ").replace("<", " ").replace("&", "and")
  }

  console.log(data.length, 'accounts to add');
  for (var i = 0; i < data.length; i++) {
    var xml = '<Accounts><row no="1"><FL val="Account Name">'+ cleanString(data[i]['Business Name']) +'</FL>';

    delete data[i]['Business Name']
    for (prop in data[i]) {
      xml += '<FL val="' + cleanString(prop) + '">' + cleanString(data[i][prop]) + '</FL>';
    }
    xml += '</row></Accounts>';

    arrXml.push(xml);
  }

  co(function *() {
    while (ctr < arrXml.length) {
      yield processing(arrXml[ctr]);
      console.log(ctr, 'of ', arrXml.length, ' accounts processed.' );
      ctr++;
    }
    done();
  });

  function processing(data) {
    return new Promise(function (resolve, reject) {
      req
        .post('https://crm.zoho.com/crm/private/xml/Accounts/insertRecords')
        .query({newFormat: 1})
        .query({authtoken: process.env.ZOHO_AUTH})
        .query({scope: 'crmapi'})
        .query({duplicateCheck: 2})
        .query({version: 4})
        .query({xmlData: data})
        .end(function (err, res) {
          //console.log(res.text);
          if (err) return reject(err);
          return resolve();
        });
    });
  }
});



