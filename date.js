/* VARIABLES */
var jsdom = require('jsdom'),
    CronJob = require('cron').CronJob,
    co = require('co'),
    req = require('superagent'),
    moment = require('moment');
    cheerio = require('cheerio'),
    dotenv = require('dotenv'),
    each = require('co-each'),
    dateTo = '',
    dateFrom = '';

dotenv.load({path: __dirname + '/.env'});

var job = new CronJob({
  cronTime: '00 00 00 * * 6',
  onTick: function() {
    /* runs every sunday 00:00:00 
     * this is a script that will scrape data weekly 
     */
    dateTo = moment().format('MM/DD/YYYY');
    dateFrom = moment().subtract(7,'d').format('MM/DD/YYYY');

    co(function *() {
      try {
        /* @returns - array */
        var data = yield scraping();
        yield importing(data);
      } catch (err) {
        console.log(err);
      }
    });
  },
  start: false,
  timeZone: 'America/Los_Angeles'
});

job.start();


/* FUNCTIONS */

function cleanDate(date) {
  return date.replace(/\//g, "");
}

function cleanString(string) {
  return string.replace(/\'|\"|\>|\</g, " ").replace("&", "and");
}

function importing(dataArr) {
  return new Promise(function (resolve, reject) {

    var importCounter = 0,
      row = '',
      arrXml = [],
      xml = '';

    console.log('transforming into valid xml ...');

    for (var i = 0; i < dataArr.length; i++) {
      xml = '<Leads>';
      row = '<row no="1"><FL val="Company">' + cleanString(dataArr[i]['Business Name']) + '</FL><FL val="Last Name">' + cleanString(dataArr[i]['Business Name']) + '</FL>';
      delete dataArr[i]['Business Name']
      for (prop in dataArr[i]) {
        row += '<FL val="' + cleanString(prop) + '">' + cleanString(dataArr[i][prop]) + '</FL>';
      }
      row += '</row>';
      xml += row + '</Leads>';
      arrXml.push(xml);
    }

    console.log('%d item(s) created, importing ...', arrXml.length);

    co(function *() {
      while (importCounter < arrXml.length) {
        yield processing(arrXml[importCounter]);
        importCounter++;
        console.log(importCounter, 'of', arrXml.length, ' accounts imported ...' );
      }
      console.log('Importing done.');
    });

    function processing(data) { 
      return new Promise(function (resolve, reject) {
        req
          .post('https://crm.zoho.com/crm/private/xml/Leads/insertRecords')
          .query({newFormat: 1})
          .query({authtoken: process.env.ZOHO_AUTH})
          .query({scope: 'crmapi'})
          .query({duplicateCheck: 2})
          .query({version: 4})
          .query({xmlData: data})
          .end(function (err, res) {
            console.log(res.text);
            if (err) return reject(err);
            return resolve();
          });
      });
    }
  });
}

function scraping() {
  return new Promise(function (resolve, reject) {
    jsdom.env(
      "https://blepay.clarkcountynv.gov/bleligibility/blinmult.asp",
      ["https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.3/jquery.min.js"],
      function (err, window) {
        if (err) return reject(err);
        var $ = window.$;
        $(function () {
          /* -- it seems value of input boxes cannot be changed :( */
          $("input[name='startBusDate']").parent().html("<select name='startBusDate'><option selected value='"+ dateFrom +"'></option></select><select name='endBusDate'><option selected value='"+ dateTo +"'></option></select>");
          
          $("form").removeAttr("onsubmit");
          console.log("submitting form ...");
          var request = $.ajax({
            url: $("form").attr("action"),
            method: "POST",
            data: $("form").serialize(),
          });

          request.done(function( data ) {
            console.log('recieved response, counting ...');

            var valid = [];
            var heads = [
              'License Num',
              'Multi-J Num',
              'Business Name',
              'Primary Jurisdiction',
              'Non Primary Jurisdiction',
              'License Status',
              'Business Address'
            ];

            $(data).find("a").map(function (k, data) {
              var objSample = {};
              var href = $(data).attr("href");
              if (href.includes("BusinessLicenseDetails.asp")) {
                $(data).closest("tr").children().each(function (k, data) {
                  objSample[heads[k]] = $(data).text();
                });
                objSample["href"] = href;
                valid.push(objSample);
              }
            });

            console.log('valid businesses found: %d', valid.length);

            var followHref = function (obje) {
              return new Promise(function (resolve, reject) {
                var req = $.ajax({
                  url: obje.href,
                  method: "GET"
                });

                req.done(function (html) {
                  var obj = {},
                    property = '';

                  html = html.replace(/\r?\n|\r/g, '').replace(/\t/g, '');

                  var jQr = cheerio.load(html);
                  jQr("table:nth-child(2) td").map(function (key, data) {
                    var text = jQr(data).text();
                    
                    switch (key % 2) {
                      case 0:
                        text = text.replace(':', '');
                        property = text;
                        break;
                      case 1:
                        var addObj = {};
                        addObj[property] = text;
                        obj = Object.assign(obj, addObj);
                        if (property === 'Out of Business Date') {
                          // remove duplicated properties
                          delete obje['License Num'];
                          delete obje['Multi-J Num'];
                          delete obje['License Status'];
                          delete obje['href'];
                          obje = Object.assign(obj, obje);
                          obj = {}
                        }
                        property = '';
                        break;
                      default:
                        break;
                    }
                  });
                  return resolve(obje);
                });

                req.fail(function (jqXHR, textStatus) {
                  console.log('received error, aborting ...\n Error info: %s', textStatus);
                  return reject(textStatus);
                })
              });
            }

            co(function *() {
              var data = yield each(valid, followHref);
              console.log('there are %d item(s) returned -- done.', data.length);
              return resolve(data);
            });     
          });

          request.fail(function( jqXHR, textStatus ) {
            console.log('received error, aborting ...\n Error info: %s', textStatus);
            return reject(textStatus);
          });

        });
      }
    );
  });
}