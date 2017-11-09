export function DebugLog(target: any, method: string, descriptor: TypedPropertyDescriptor<() => void>) {
  // Do nothing for now.
  const old        = descriptor.value;
  // tslint: disable-next-line
  descriptor.value = async function (...args) {
    const now = Date.now();
    console.log(`-> ${this.constructor.name}.${method} with ${args.length} args -> ${JSON.stringify(args)}`);
    const toRet = old.apply(this, args);
    if (toRet instanceof Promise) {
      return toRet
        .then((res) => {
          console.log(`<- ${this.constructor.name}.${method} in ${Date.now() - now} with Promise(${JSON.stringify(res)})`);
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
      console.log(`<- ${this.constructor.name}.${method} in ${Date.now() - now} with ${JSON.stringify(toRet)}`);
      return toRet;
    }
  };
}
