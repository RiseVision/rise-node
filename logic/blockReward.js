'use strict';

var constants = require('../helpers/constants.js');

// Private fields
var __private = {};

/**
 * Initializes variables:
 * - milestones
 * - distance
 * - rewardOffset
 * @memberof module:blocks
 * @class
 * @classdesc Main BlockReward logic.
 */
// Constructor
function BlockReward () {
	this.rewards = constants.rewards;
}

// Private methods
/**
 * Returns absolute value from number.
 * @private
 * @param {number} height
 * @return {number}
 * @throws Invalid block height
 */
__private.parseHeight = function (height) {
	if (isNaN(height)) {
		throw 'Invalid block height';
	} else {
		return Math.abs(height);
	}
};

// Public methods
/**
 * @implements {__private.parseHeight}
 * @param {number} height
 * @return {number}
 */
BlockReward.prototype.calcMilestone = function (height) {
	height = __private.parseHeight(height);

	for (var i=this.rewards.length-1; i>=0; i--)	{
		if (height>=this.rewards[i].height) {
			return i;
		}
	}
	return 0;
};

/**
 * @implements {__private.parseHeight}
 * @implements {BlockReward.calcMilestone}
 * @param {number} height
 * @return {number}
 */
BlockReward.prototype.calcReward = function (height) {
	return this.rewards[this.calcMilestone(height)].reward;
};

/**
 * @implements {__private.parseHeight}
 * @implements {BlockReward.calcMilestone}
 * @param {number} height
 * @return {number}
 */
BlockReward.prototype.calcSupply = function (height) {
	height = __private.parseHeight(height);

	var milestone = this.calcMilestone(height);
	var supply    = constants.totalAmount;
	var rewards   = [];

	var amount = 0;

	// sum up all completed milestonen
	for (var i = 0; i < milestone; i++) {
		amount = this.rewards[i+1].height-this.rewards[i].height;
		height -= amount;

		rewards.push([amount, this.rewards[i].reward]);
	}

	// add current milestone
	rewards.push([height, this.rewards[milestone].reward]);

	for (i = 0; i < rewards.length; i++) {
		var reward = rewards[i];
		supply += reward[0] * reward[1];
	}

	return supply;
};

// Export
module.exports = BlockReward;
