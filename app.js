var express = require('express');
var path = require('path');
var cors = require('cors');
var logger = require('morgan');
var index = require('./routes/index');
var config = require('./config.js');
var bodyParser = require('body-parser');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(cors());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
// media
// app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));
// Logs
app.use(express.static(config.remoteLogs));
app.use(express.static(config.remotePath));

app.use('/', index);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  // res.locals.message = err.message;

  res.locals.message = "Сорямба! ;)";
  res.locals.info = "Такой страницы не существует!";
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;