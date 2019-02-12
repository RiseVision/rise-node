import * as fs from 'fs';
import * as _ from 'lodash/fp';
import * as path from 'path';

const MD_AUTHORS = 'Authors';
const MD_LICENSE = 'License';

const packageKeys = [
  'homepage',
  'bugs',
  'license',
  'author',
  'contributors',
  'repository',
];

const root = _.memoize((): string => path.join(__dirname, '../'));
const absPath = (...relativePath: string[]): string =>
  path.join(root(), ...relativePath);
const allPackageNames = _.memoize(() =>
  fs
    .readdirSync('packages')
    .map((d) => path.join(root(), 'packages', d))
    .filter((d) => fs.lstatSync(d).isDirectory())
    .map((d) => path.join('packages', path.basename(d)))
);

const read = (...relativePath: string[]): string =>
  fs.readFileSync(absPath(...relativePath), 'utf8').toString();
const write = (data: string, ...relativePath: string[]) =>
  fs.writeFileSync(absPath(...relativePath), data, { flag: 'w+' });

const testHeader = (name: string = '') => {
  return (value: string) => {
    return new RegExp('^#+ ' + name + '.*').test(value);
  };
};

const findSection = (name: string, mdLines: string[]): number[] => {
  const startIndex = _.findIndex(testHeader(name), mdLines);
  if (startIndex < 0) {
    return [-1, -1];
  }
  const endIndex = _.findIndexFrom(testHeader(), startIndex + 1, mdLines);
  if (endIndex < 0) {
    return [startIndex, mdLines.length];
  }
  return [startIndex, endIndex];
};

const getSection = (name: string, mdLines: string[]): string[] => {
  const [start, end] = findSection(name, mdLines);
  if (start < 0) {
    return [];
  }
  return mdLines.slice(start, end);
};

const replaceSection = (
  name: string,
  mdLines: string[],
  replacement: string[]
) => {
  const [start, end] = findSection(name, mdLines);
  if (start < 0) {
    mdLines.push('', ...replacement);
  } else {
    mdLines.splice(start, end - start - 1, ...replacement);
  }
  return mdLines;
};

const getReadmeInfo = (filepath: string) => {
  const mdLines = read(filepath).split('\n');
  return [getSection(MD_AUTHORS, mdLines), getSection(MD_LICENSE, mdLines)];
};

const getPackageInfo = (filepath: string) => {
  const packageJson = JSON.parse(read(filepath));
  return _.pick(packageKeys, packageJson);
};

const replaceReadmeInfo = (
  filepath: string,
  [authors, license]: string[][]
) => {
  let mdLines = read(filepath).split('\n');
  mdLines = replaceSection(MD_AUTHORS, mdLines, authors);
  mdLines = replaceSection(MD_LICENSE, mdLines, license);
  write(mdLines.join('\n'), filepath);
};

const replacePackageInfo = (filepath: string, packageInfo: object) => {
  const packageString = read(filepath);
  const packageJson = _.merge(JSON.parse(packageString), packageInfo);
  const space = packageString.split('\n')[1].match(/^\s+/)[0];
  write(JSON.stringify(packageJson, null, space), filepath);
};

const updateReadmeInfos = () => {
  const readmeInfo = getReadmeInfo('README.md');
  const license = read('LICENSE');
  const packageInfo = getPackageInfo('package.json');
  for (const packageName of allPackageNames()) {
    console.log(`Updating ${path.basename(packageName)}`);
    // replaceReadmeInfo(path.join(packageName, 'README.md'), readmeInfo);
    replacePackageInfo(path.join(packageName, 'package.json'), packageInfo);
    // write(license, path.join(packageName, 'LICENSE'));
  }
};

const main = () => {
  updateReadmeInfos();
};

main();
