import * as fs from 'fs';
import * as glob from 'glob';
import * as isEmpty from 'is-empty';
import * as lineColumn from 'line-column';
import * as _ from 'lodash/fp';
import * as path from 'path';
import * as ts from 'typescript';
import { promisify } from 'util';

type ICodeSamples = object;

const JS_TAG_NAME = 'codesample';
const MD_START_TAG_NAME = 'codesample';
const MD_END_TAG_NAME = 'end-codesample';

const root = _.memoize((): string => path.join(__dirname, '../'));
const allPackageNames = _.memoize(() =>
  fs
    .readdirSync('packages')
    .map((d) => path.join(root(), 'packages', d))
    .filter((d) => fs.lstatSync(d).isDirectory())
    .map((d) => path.join('packages', path.basename(d)))
);
const read = async (filePath: string) => {
  return (await promisify(fs.readFile)(filePath, 'utf8')).toString();
};
const write = async (filePath: string, data: string) => {
  return promisify(fs.writeFile)(filePath, data);
};

const mergeCodeSamples = (...codeSamples: ICodeSamples[]): ICodeSamples => {
  return codeSamples.reduce(
    (result, samples) => ({ ...result, ...samples }),
    {}
  );
};

const parseJsDocTag = (
  tag: ts.JSDocTag,
  lcCalc: lineColumn.LineColumnFinder,
  srcLines: string[]
): ICodeSamples => {
  const id = tag.comment;
  const jsDocNode: any = tag.parent;
  const startLine = lcCalc.fromIndex(
    jsDocNode.comment ? jsDocNode.pos : jsDocNode.end + 1
  ).line;
  const endLine = lcCalc.fromIndex(jsDocNode.parent.body.end).line;
  const tagLine = lcCalc.fromIndex(tag.pos).line - startLine;
  const targetLines = srcLines.slice(startLine - 1, endLine);
  if (jsDocNode.comment) {
    targetLines.splice(tagLine, 1);
  }
  const indent = targetLines
    .map((line) => line.match(/^\s*/)[0].length)
    .reduce((minLen, len) => (len < minLen ? len : minLen));
  const targetSrc = targetLines.map((line) => line.slice(indent));
  return { [id]: targetSrc };
};

const parseTsFile = async (input: string): Promise<ICodeSamples> => {
  const src = await read(input);
  const nodes = ts.createSourceFile(input, src, ts.ScriptTarget.Latest, true);
  const srcLines = src.split('\n');
  const lcCalc = lineColumn(src, { origin: 1 });

  let result: ICodeSamples = {};
  const visit = (node: ts.Node) => {
    const tags = ts.getJSDocTags(node);
    if (!isEmpty(tags)) {
      for (const tag of tags) {
        if (
          tag.kind === ts.SyntaxKind.FirstJSDocTagNode &&
          tag.tagName.escapedText === JS_TAG_NAME
        ) {
          result = mergeCodeSamples(
            result,
            parseJsDocTag(tag, lcCalc, srcLines)
          );
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(nodes);
  return result;
};

const packageCodeSamples = async (
  packageName: string
): Promise<ICodeSamples> => {
  const srcFilePaths = glob.sync(path.join(root(), packageName, 'src/**/*.ts'));
  const parsedFiles = await Promise.all(srcFilePaths.map(parseTsFile));
  return mergeCodeSamples(...parsedFiles);
};

const gatherCodeSamples = async () => {
  const parsedPackages = await Promise.all(
    allPackageNames().map(packageCodeSamples)
  );
  return mergeCodeSamples(...parsedPackages);
};

const startInsertRe = (name: string) => {
  return new RegExp(`^\\s*<!--\\s+@${MD_START_TAG_NAME}\\s+${name}\\s+-->`);
};

const endInsertRe = () => {
  return new RegExp(`^\\s*<!--\\s+@${MD_END_TAG_NAME}\\s+-->`);
};

const findInsertPoints = (mdLines: string[], name: string) => {
  const start = _.findIndex((line) => startInsertRe(name).test(line), mdLines);
  if (start < 0) {
    return [-1, -1];
  }
  const end = _.findIndexFrom(
    (line) => endInsertRe().test(line),
    start,
    mdLines
  );
  if (end < 0) {
    return [-1, -1];
  }
  return [start, end];
};

const insertCodeSample = (
  mdLines: string[],
  name: string,
  sample: string[]
) => {
  const [start, end] = findInsertPoints(mdLines, name);
  if (start > -1) {
    mdLines.splice(start + 1, end - start - 1, ...sample);
  }
  return mdLines;
};

const insertCodeSamples = (mdString: string, samples: ICodeSamples) => {
  const mdLines = mdString.split('\n');
  const sampleInputs = _.entries(samples).map(([name, sample]) => [
    name,
    ['', '```TypeScript', ...sample, '```', ''],
  ]);
  return sampleInputs
    .reduce((resultLines: string[], [name, sample]) => {
      return insertCodeSample(resultLines, name as string, sample as string[]);
    }, mdLines)
    .join('\n');
};

const replaceReadmeSamples = async (
  packageName: string,
  samples: ICodeSamples
) => {
  const fullPath = path.join(root(), packageName, 'README.md');
  write(fullPath, insertCodeSamples(await read(fullPath), samples));
};

const main = async () => {
  console.log('Scanning for samples...');
  const samples = await gatherCodeSamples();

  console.log('Updating Readmes...');
  return Promise.all(
    allPackageNames().map(async (packageName) => {
      const fullPath = path.join(root(), packageName, 'README.md');
      write(fullPath, insertCodeSamples(await read(fullPath), samples));
      console.log(`Updated ${path.basename(packageName)}`);
    })
  );
};

main();
