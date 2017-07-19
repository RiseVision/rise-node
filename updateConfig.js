var program = require('commander');
var fs = require('fs');
var extend = require('extend');

program
	.version('1.0.0')
	.option('-o, --old <path>', 'Old config.json')
	.option('-n, --new <path>', 'New config.json')
	.parse(process.argv);

var oldConfig, newConfig;

if (program.old) {
	oldConfig = JSON.parse(fs.readFileSync(program.old, 'utf8'));
	// remove keys replaced by the new version
	delete oldConfig.version;				// obsolete
	delete oldConfig.minVersion;		// obsolete
	delete oldConfig.forging.force;
	delete oldConfig.peers.list;
} else {
	console.log('Old config.json not provided, please edit entries manually');
	process.exit(1);
}

if (program.new) {
	newConfig = JSON.parse(fs.readFileSync(program.new, 'utf8'));
	newConfig = extend(true, {}, newConfig, oldConfig);

	fs.writeFile(program.new, JSON.stringify(newConfig, null, 4), function (err) {
		if (err) {
			throw err;
		}
	});
}
