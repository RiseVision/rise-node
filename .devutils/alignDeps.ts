import * as fs from 'fs';

const projDir = `${__dirname}/..`;

const packageJSON = require(`../package.json`);

const allDeps = {};
const depKeys = ['devDependencies', 'dependencies'];

depKeys.forEach((dk) => {
  Object.keys(packageJSON[dk])
    .forEach((dep) => {
      allDeps[dep] = packageJSON[dk][dep];
    });
})

const packages = fs.readdirSync(`${projDir}/packages`);
for (const pack of packages) {
  const packageJSONpath = `${projDir}/packages/${pack}/package.json`;
  const subPackageJSON = require(packageJSONpath);
  depKeys.forEach((dk) => {
    Object.keys(subPackageJSON[dk])
      .forEach((dep) => {
        if (allDeps[dep] && subPackageJSON[dk][dep] !== allDeps[dep]) {
          console.log(`Aligning ${pack}[${dk}][${dep}] from ${subPackageJSON[dk][dep]} to ${allDeps[dep]}`);
          subPackageJSON[dk][dep] = allDeps[dep];
        }
      });
  });

  fs.writeFileSync(packageJSONpath, JSON.stringify(subPackageJSON, null, 2));
}
