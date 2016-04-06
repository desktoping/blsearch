var jsdom = require("jsdom"),
  kue = require('kue'),
  co = require('co'),
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

          request.done(function( msg ) {
            //save html to queue
            q.create('bl-jobs', {
              data: msg
            }).save(function (err) {
              if (err) return reject(err);
              console.log('done adding job %d', ctr);
              return resolve();
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