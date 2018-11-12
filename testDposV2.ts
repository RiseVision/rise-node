import { rise } from 'risejs';
import BigNumber from 'bignumber.js';

const n = 101;
const m = 202;

const approximationPoints = 100;

async function getDelegates() {
  const firstBatch  = await rise.delegates.getList({ orderBy: 'vote:desc', limit: 101 });
  const secondBatch = await rise.delegates.getList({ orderBy: 'vote:desc', limit: 101, offset: 101 });
  return [
    ...firstBatch.delegates,
    ...secondBatch.delegates,
  ]
    .map((d) => ({ vote: d.vote, username: d.username, rank: d.rank }))
    .slice(0, m);
}

async function calcPercentage(delegates: Array<{ vote: string, username: string, rank: string }>) {
  const runPercentages                = [];
  const totalWeight                   = delegates
    .map((d) => new BigNumber(d.vote))
    .reduce((a, b) => a.plus(b));
  const weightByDelegate: BigNumber[] = [];
  for (let i = 0; i < delegates.length; i++) {
    const d = delegates[i];
    weightByDelegate.push(new BigNumber(d.vote).dividedBy(totalWeight));
  }

  const step = 1 / approximationPoints;
  for (let i = 0; i < approximationPoints; i++) {
    let v = step * (i + 1);
    const myWeight =
  }

}

getDelegates()
  .then(calcPercentage)
  .then(console.log);
