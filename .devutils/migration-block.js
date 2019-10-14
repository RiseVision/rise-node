// config
const hours = 4.2 * 24;
const currentHeight = 2420555;

// consts
const secPerBlock = 30;

// blocks
const blockAhead = (hours * 60 * 60) / secPerBlock;
let migrationBlock = currentHeight + blockAhead;

let adjustTime = 0;

// adjust
while ((migrationBlock - 1) % 101) {
  migrationBlock++;
  adjustTime += secPerBlock;
}

// time
const migrationTime = new Date();
migrationTime.setTime(
  migrationTime.getTime() + (hours * 60 * 60 + adjustTime) * 1000
);

console.log('Migration height:', migrationBlock);
console.log('Migration time:', migrationTime);
