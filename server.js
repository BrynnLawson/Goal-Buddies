var express = require('express');
var http = require('http');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var expressSession = require('express-session');
var app = express();

// all environments
app.set('port', process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || 8080);
//  0.0.0.0 for use in VirtualBox
app.set('address', process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0" || "127.0.0.1");
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
//app.set('view engine', 'jade');
//app.use(express.methodOverride());
var stylus = require('stylus');
app.use(stylus.middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(expressSession({
    secret: 'WhyDoesntGregHelpWithThis',
    resave: false,
    saveUninitialized: true
}));

// development only
if ('development' == app.get('env')) {
    //app.use(express.errorHandler());
}

// primary routing
var routes = require('./routes/index');
app.use('/', routes);

var user = require('./routes/user');
app.use('/user', user);

var goal = require('./routes/goal');
app.use('/goal', goal);

http.createServer(app).listen(parseInt(app.get('port')), app.get('address'), null, function () {
    console.log('Express server listening on port ' + app.get('port'));
});
//# sourceMappingURL=app.js.map