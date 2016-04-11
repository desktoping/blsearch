var co = require('co'),
    each = require('co-each'),
    dotenv = require('dotenv'),
    kue = require("kue"),
    fs = require('fs'),
    req = require('superagent'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema;



dotenv.load({path: __dirname + '/.env'});

mongoose.connect(process.env.MONGO_DB);
var q = kue.createQueue({
  redis: {
    host: process.env.REDIS_HOST,
    port: 6379
  }
});

// ** mongoose schema
var Business = new Schema({
  "License Number": String,
  "MJBL Number": String,
  "Business": String,
  "Business Telephone": String,
  "License Category": String,
  "Status": String,
  "Date of License": String,
  "Out of Business Date": String,
  "Business Name": String,
  "Primary Jurisdiction": String,
  "Non Primary Jurisdiction": String,
  "Business Address": String
});

var AddBusiness = mongoose.model('business', Business);

q.process('bl-jobs', function (job, done) {
  console.log('working on job: %d', job.id);
  co(function *() {
    function saveToDb(data) {
      return new Promise(function (resolve, reject) {
        var newBusiness = new AddBusiness(data);
        newBusiness.save(function (err, data) {
          if (err) return reject(err);
          return resolve();
        })
      });
    };
    yield each(job.data, saveToDb);
    done();
  });
});



