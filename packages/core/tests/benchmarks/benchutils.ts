// tslint:disable no-console
export const results = {};

export function reportedIT(
  name: string,
  flavors: any[],
  testRunner: (flavor?: any) => Promise<number>
) {
  flavors = flavors || [];
  flavors.forEach((flavor) => {
    const flavorName = flavor ? JSON.stringify(flavor) : '__default';
    it(`${name} ${flavorName}`, async function() {
      const res = await testRunner(flavor);
      results[name] = results[name] || {};
      results[name][flavorName] = res;
      console.log(`${this.test.fullTitle()} Result ${res}`);
    });
  });
}

after(() => {
  console.log(results);
});

export class SimpleMicroSecondTimer {
  private startTime: [number, number];
  private intermediate: { [k: string]: [number, number] };
  public start() {
    this.startTime = process.hrtime();
    this.intermediate = {};
    this.intermediate.start = this.startTime;
  }

  public elapsed(label?: string): number {
    label = label || '_step_' + Object.keys(this.intermediate).length;
    const now = process.hrtime(this.startTime);
    this.intermediate[label] = now;
    return now[0] * 1000000 + now[1] / 1000;
  }

  public getAllSteps(): { [k: string]: number } {
    const toRet = {};
    Object.keys(this.intermediate).forEach((key, index) => {
      let microseconds = 0;
      if (key !== 'start') {
        microseconds =
          this.intermediate[key][0] * 1000000 +
          this.intermediate[key][1] / 1000;
      }
      toRet[key] = microseconds;
    });
    return toRet;
  }
}
