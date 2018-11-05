import * as fs from 'fs';
export function profilePromise(snap: number = 100) {
  return (
    target: any,
    method: string,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => any>
  ) => {
    const oldValue = descriptor.value;
    let totalElapsed = 0;
    let count = 0;
    let lastMark = 0;
    descriptor.value = async function profileWrapper(...args: any[]) {
      const pre = Date.now();
      const res = await oldValue.apply(this, args);
      const after = Date.now();
      totalElapsed += after - pre;
      count++;
      lastMark += after - pre;
      if (count % snap === 0) {
        const elapsedFromLast = lastMark / snap;
        lastMark = 0;
        fs.appendFileSync(
          `${__dirname}/../../../prof_${target.constructor.name}_${method}.txt`,
          `${count} - ${totalElapsed / count} - ${elapsedFromLast / snap} \n`
        );
      }
      return res;
    };
  };
}

export function profile(snap: number = 100) {
  return (
    target: any,
    method: string,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => any>
  ) => {
    const oldValue = descriptor.value;
    let totalElapsed = 0;
    let count = 0;
    let lastMark = 0;
    descriptor.value = function profileWrapper(...args: any[]) {
      const pre = Date.now();
      const res = oldValue.apply(this, args);
      const after = Date.now();
      totalElapsed += after - pre;
      count++;
      lastMark += after - pre;
      if (count % snap === 0) {
        const elapsedFromLast = lastMark / snap;
        lastMark = 0;
        fs.appendFileSync(
          `${__dirname}/../../../prof_${target.constructor.name}_${method}.txt`,
          `${count} - ${totalElapsed / count} - ${elapsedFromLast / snap} \n`
        );
      }
      return res;
    };
  };
}
