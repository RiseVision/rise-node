'use strict';
/**
* Helper module for parsing git commit information
*
* @class git.js
*/

var childProcess = require('child_process');

/**
 * Return hash of last git commit if available
 *
 * @method getLastCommit
 * @public
 * @return {String} Hash of last git commit
 * @throws {Error} Throws error if cannot get last git commit
 */
function getLastCommit () {
	var spawn = childProcess.spawnSync('git', ['rev-parse', 'HEAD']);
	var err = spawn.stderr.toString().trim();

	if (err) {
		throw new Error(err);
	} else {
		return spawn.stdout.toString().trim();
	}
}

/**
 * Return date of a given commit if available
 *
 * @method getCommitDate
 * @public
 * @param {String} commit (optional, last commit, if not given)
 * @return {String} Date of last git commit
 * @throws {Error} Throws error if cannot get the date of git commit
 */
function getCommitDate ( commit ) {
	var spawn = childProcess.spawnSync('git', ['show', '-s', '--format=%ci', commit || 'HEAD']);
	var err = spawn.stderr.toString().trim();
	if (err) {
		throw new Error(err);
	} else {
		return spawn.stdout.toString().trim();
	}
}

module.exports = {
	getLastCommit: getLastCommit,
	getCommitDate: getCommitDate
};
