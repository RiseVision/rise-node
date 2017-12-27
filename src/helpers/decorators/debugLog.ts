import * as CircularJSON from 'circular-json';
// tslint:disable no-console max-line-length

export function DebugLog(target: any, method: string, descriptor: TypedPropertyDescriptor<(...args: any[]) => any>) {
  // Do nothing for now.
  const old        = descriptor.value;
  // tslint: disable-next-line
  descriptor.value = async function debugLogWrap(...args) {
    const now = Date.now();
    console.log(`-> ${this.constructor.name}.${method} with ${args.length} args -> ${CircularJSON.stringify(args)}`);
    const toRet = old.apply(this, args);
    if (toRet instanceof Promise) {
      return toRet
        .then((res) => {
          console.log(`<- ${this.constructor.name}.${method} in ${Date.now() - now} with Promise(${CircularJSON.stringify(res)})`);
          return res;
        })
        .catch((err) => {
          let theErrMessage: string = err;
          if (err instanceof Error) {
            theErrMessage = err.message;
          }
          console.log(`<- ${this.constructor.name}.${method} in ${Date.now() - now} with Promise.reject('${theErrMessage}')`);
          return Promise.reject(err);
        });
    } else {
      console.log(`<- ${this.constructor.name}.${method} in ${Date.now() - now} with ${CircularJSON.stringify(toRet)}`);
      return toRet;
    }
  };
}
