var jsdom = require("jsdom"),
  kue = require('kue'),
  co = require('co'),
  cheerio = require('cheerio'),
  each = require('co-each'),
  q = kue.createQueue(),
  ctr = 2,
  zip = 109; //number of zip codes on the blsearch -- 107

co(function *() {
  while (ctr < zip) {
    yield process(ctr);
    ctr++;
  }
});

function process(ctr) {
  return new Promise(function (resolve, reject) {
    jsdom.env(
      "https://blepay.clarkcountynv.gov/bleligibility/blinmult.asp",
      ["http://code.jquery.com/jquery.js"],
      function (err, window) {
        if (err) return reject(err);
        var $ = window.$;
        $(function () {
          $("select[name='zipcode']").addClass("zip");
          $(".zip option:eq("+ ctr +")").prop("selected", true);
          $("form").removeAttr("onsubmit");
          console.log("sending ajax %d", ctr);
          var request = $.ajax({
            url: $("form").attr("action"),
            method: "POST",
            data: $("form").serialize(),
          });

          request.done(function( data ) {
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
                  return reject(textStatus);
                })
              });
            }

            co(function *() {
              try {
                var data = yield each(valid, followHref);
                q.create('bl-jobs', data).save(function (err) {
                  if (err) return reject(err);
                  console.log('done adding job %d', ctr);
                  return resolve();
                });
              } catch (err) {
                console.log(err);
              }
            });        
          });

          request.fail(function( jqXHR, textStatus ) {
            return reject(textStatus);
          });

        });
      }
    );
  });
}