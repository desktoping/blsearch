var jsdom = require("jsdom"),
  fs = require("fs"),
  kue = require('kue'),
  co = require('co'),
  q = kue.createQueue(),
  ctr = 0,
  zip = 109; //number of zip codes on the blsearch

co(function *() {
  while (ctr < zip) {
    console.log(ctr);
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
        $("select[name='zipcode'] option:eq("+ ctr +")").prop('selected', true);
        
        if ($("select[name='zipcode'] option:selected").text() === '')
          return resolve();

        var form = $("input[name='cb_submit']").closest("form");
        $.post($(form).attr('action'), $(form).serialize(), function (data) {
          q.create('bl-jobs', {
            data
          }).save(function (err) {
            if (err) return reject(err);
            return resolve();
          });
        }, function (err) {
          return reject(err);
        });
      }
    );
  });
}