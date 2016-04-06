var kue = require('kue'),
  cheerio = require('cheerio'),
  fs = require("fs"),
  each = require('co-each'),
  co = require('co'),
  arr = [],
  obj = {},
  q = kue.createQueue();


q.process('bl-jobs', function (job, done) {

  var html = job.data.data.replace(/\r?\n|\r/g, '').replace(/\t/g, '');
  $ = cheerio.load(html);

  var data = $("table:nth-child(2) td");

  data.map(function (key, data) {
    var text = $(data).text();
    switch (key % 7) {
      case 0:
        if (text === 'License Num')
          break;
        obj = {};
        obj = Object.assign(obj, {LicenseNum: text});
        break;
      case 1:
        if (text === 'Multi-J Num')
          break;
        obj = Object.assign(obj, {MultiJNum: text});
        break;
      case 2:
        if (text === 'Business name')
          break;
        obj = Object.assign(obj, {BusinessName: text});
        break;
      case 3:
        if (text === 'Primary Jurisdiction')
          break;
        obj = Object.assign(obj, {PrimaryJurisdiction: text});
        break;
      case 4:
        if (text === 'Non Primary Jurisdiction')
          break;
        obj = Object.assign(obj, {NonPrimaryJurisdiction: text});
        break;
      case 5:
        if (text === 'License Status')
          break;
        obj = Object.assign(obj, {LicenseStatus: text});
        break;
      case 6:
        if (text === 'Business Address')
          break;
        obj = Object.assign(obj, {BusinessAddress: text});
        arr.push(obj);
        break;
      default:
    }
  });
  var stringArr = JSON.stringify(arr, null, 2);
  fs.writeFileSync('job' + job.id + '.json', stringArr, 'utf-8');
  arr = [];
  obj = {};
  done();

});