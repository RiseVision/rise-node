'use strict';

var strftime = require('strftime').utc();
var fs = require('fs');
var util = require('util');
var circularJSON = require('circular-json');
require('colors');

module.exports = function (config) {
	config = config || {};
	var exports = {};

	config.levels = config.levels || {
		none: 99,
		trace: 0,
		debug: 1,
		log: 2,
		info: 3,
		warn: 4,
		error: 5,
		fatal: 6
	};

	config.level_abbr = config.level_abbr || {
		trace: 'trc',
		debug: 'dbg',
		log: 'log',
		info: 'inf',
		warn: 'WRN',
		error: 'ERR',
		fatal: 'FTL'
	};

	config.filename = config.filename || __dirname + '/logs.log';

	config.errorLevel = config.errorLevel || 'log';

	if (!config.append && fs.existsSync(config.filename))	{
		fs.renameSync(config.filename, config.filename+'.bak');
	}
	var log_file = fs.createWriteStream(config.filename, config.append ? {flags: 'a'} : {});

	exports.setLevel = function (errorLevel) {
		config.errorLevel = errorLevel;
	};

	// remove secret in the message, e.g. url parameter (string) or data object properties
	function snipsecret (data) {
		var rv = data;
		if (typeof data === 'string') {			// remove secret in the string messages, e.g. url parameter
			var pos = rv.search('secret=');
			if (pos<0)
				{return rv;}
			pos += 7;
			var posE = rv.indexOf('&', pos);
			if (posE<0)
				{posE=rv.length();}
			var toReplace = rv.substr(pos, posE-pos);
			rv = rv.replace(toReplace, 'XXXXXXXXXX');
		} 
		
		else if (typeof data === 'object') {			// remove secret in object properties
			rv = JSON.parse(circularJSON.stringify(data));	// create a real object copy, filter circular references
			for (var key in rv) {
				if (key.search(/secret/i) > -1) {
					rv[key] = 'XXXXXXXXXX';
				}
			}
		}
		return rv;	
	}

	Object.keys(config.levels).forEach(function (name) {
		function log (message, data) {
			var log = {
				level: name,
				timestamp: strftime('%F %T', new Date())
			};

			if (message instanceof Error) {
				log.message = message.stack;
			} else {
				log.message = message;
			}

			log.message = snipsecret(log.message);				// remove secret in the message, e.g. url parameter

			if (data && util.isObject(data)) {
				log.data = circularJSON.stringify(snipsecret(data));	// remove secret in the data, filter circular references
			} else {
				log.data = data;
			}

			log.symbol = config.level_abbr[log.level] ? config.level_abbr[log.level] : '???';

			if (config.levels[config.errorLevel] <= config.levels[log.level]) {
				if (log.data) {
					log_file.write(util.format('[%s] %s | %s - %s\n', log.symbol, log.timestamp, log.message, log.data));
				} else {
					log_file.write(util.format('[%s] %s | %s\n', log.symbol, log.timestamp, log.message));
				}
			}

			if (config.echo && config.levels[config.echo] <= config.levels[log.level]) {
				if (log.data) {
					console.log('['+log.symbol.bgYellow.black+']', log.timestamp.grey, '|', log.message, '-', log.data);
				} else {
					console.log('['+log.symbol.bgYellow.black+']', log.timestamp.grey, '|', log.message);
				}
			}
		}

		exports[name] = log;
	});

	return exports;
};
