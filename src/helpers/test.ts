let events = {};
let times = {};
let curEventDepth = 0;
export  function startEvent(name: string) {
  events[name] = Date.now();
  curEventDepth++;
}

export function endEvent(name: string) {
  curEventDepth--;
  times[name] = (times[name] || 0) + Date.now() - events[name];
  if (curEventDepth === 0) {
    console.log(times);
    times = {};
    events = {};
  }
}