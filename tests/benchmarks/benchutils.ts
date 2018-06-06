export const results = {};

export function reportedIT(name: string, flavors: any[], testRunner: (flavor?: any) => Promise<number>) {
  flavors = flavors || [];
  flavors.forEach((flavor) => {
    const flavorName = flavor ? JSON.stringify(flavor): '__default';
    it(`${name} ${flavorName}`, async function () {
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