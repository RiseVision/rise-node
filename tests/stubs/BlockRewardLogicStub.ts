import * as sinon from 'sinon';

export default class BlockRewardLogicStub {
  public stubConfig: {
    initRewards: {
      return: any
    },
    calcMilestone: {
      return: any
    },
    calcReward: {
      return: any
    },
    calcSupply: {
      return: any
    },
  };

  public stubs;

  constructor() {
    this.stubReset();
  }

  public stubReset() {
    this.stubs = {
      initRewards: sinon.stub(),
      calcMilestone: sinon.stub(),
      calcReward: sinon.stub(),
      calcSupply: sinon.stub(),
    };
    this.stubConfig = {
      initRewards:   {return: null },
      calcMilestone: {return: 0 },
      calcReward:    {return: 1 },
      calcSupply:    {return: 1 },
    };
  }

  /**
   * Stubbed methods begin here
   */
  public initRewards(...args) {
    this.stubs.initRewards.apply(this, args);
    return this.stubConfig.initRewards.return;
  }

  public calcMilestone(...args) {
    this.stubs.calcMilestone.apply(this, args);
    return this.stubConfig.calcMilestone.return;
  }

  public calcReward(...args) {
    this.stubs.calcReward.apply(this, args);
    return this.stubConfig.calcReward.return;
  }

  public calcSupply(...args) {
    this.stubs.calcSupply.apply(this, args);
    return this.stubConfig.calcSupply.return;
  }
}
