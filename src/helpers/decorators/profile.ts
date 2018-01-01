import * as fs from 'fs';
export function profilePromise(snap: number  = 100) {
  return (target: any,
          method: string,
          descriptor: TypedPropertyDescriptor<(...args: any[]) => any>) => {
    const oldValue     = descriptor.value;
    let totalElapsed = 0;
    let count = 0;
    descriptor.value   = async function profileWrapper(...args: any[]) {
      const pre = Date.now();
      await oldValue.apply(this, args);
      const after = Date.now();
      totalElapsed += after - pre;
      count ++;
      if (count % 100 === 0) {
        fs.appendFileSync(`${__dirname}/../../../prof_${target.constructor.name}_${method}.txt`, `${count} - ${totalElapsed / count}\n`);
      }
    };
  };
}
