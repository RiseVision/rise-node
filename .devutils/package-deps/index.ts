import * as yarnLockfile from '@yarnpkg/lockfile';
import * as childProcess from 'child_process';
import * as colors from 'colors/safe';
import * as convert from 'convert-source-map';
import * as detective from 'detective';
import * as fs from 'fs';
import * as glob from 'glob';
import * as empty from 'is-empty';
import * as lineColumn from 'line-column';
import * as _ from 'lodash/fp';
import * as path from 'path';
import * as semver from 'semver';
import { SourceMapConsumer } from 'source-map';

import { isBuiltIn } from './builtin';

const IGNORED_PACKAGES = ['packages/core-multisignature'];

interface IDepsMap {
  [key: string]: string;
}

interface IPackageJson {
  name: string;
  version: string;
  main?: string;
  bin?: {
    [key: string]: string;
  };
  dependencies: IDepsMap;
  devDependencies: IDepsMap;
}

interface ILockfile {
  [key: string]: {
    version: string;
    resolved: string;
    integrity: string;
    depdencies?: {
      [key: string]: string;
    };
  };
}

interface ITsConfig {
  compilerOptions: {
    outDir: string;
  };
}

enum WarningType {
  RequireExpression,
  NotTraversed,
  NoVersionFound,
}

interface IWarning {
  type: WarningType;
}

interface IFileScanWarning extends IWarning {
  line: number;
  name: string;
  source: string;
}

interface INotTraversedWarning extends IWarning {
  file: string;
  hasDeps: boolean;
}

interface INoVersionFoundWarning extends IWarning {
  packageName: string;
}

interface IFileScanResult {
  files: string[];
  packages: string[];
  warnings: IFileScanWarning[];
}

interface IWalkTreeResult {
  packages: string[];
  scanned: string[];
  warnings: IFileScanWarning[];
}

enum DepsDiffType {
  Extra,
  Missing,
  SameVer,
  CompatVer,
  DiffVer,
}

interface IDepsDiff {
  type: DepsDiffType;
  name: string;
  fromVer?: string;
  toVer?: string;
}

interface IDepsDiffResult {
  depsDiff: IDepsDiff[];
  warnings: IWarning[];
}

class Logger {
  public log(...args: any[]) {
    // tslint:disable-next-line no-console
    console.log(...args);
  }
}

const logger = new Logger();

const root = _.memoize((): string => path.join(__dirname, '../../'));

const allPackageNames = _.memoize(() =>
  fs
    .readdirSync('packages')
    .map((d) => path.join(root(), 'packages', d))
    .filter((d) => fs.lstatSync(d).isDirectory())
    .map((d) => path.join('packages', path.basename(d)))
    .filter((p) => !_.includes(p, IGNORED_PACKAGES))
);

const parseLockfile = _.memoize(
  (packagePath: string = '.'): ILockfile => {
    const file = fs.readFileSync(
      path.join(root(), packagePath, 'yarn.lock'),
      'utf8'
    );
    const lockfile = yarnLockfile.parse(file);

    if (lockfile.type !== 'success') {
      throw new Error(
        `Could not parse lockfile: ${path.join(packagePath, 'yarn.lock')}!`
      );
    }
    return lockfile.object;
  }
);

const parseJson = (packagePath: string, jsonName: string): object => {
  const file = fs.readFileSync(
    path.join(root(), packagePath, jsonName),
    'utf8'
  );
  return JSON.parse(file);
};

const parsePackageJson = _.memoize(
  (packagePath: string = '.'): IPackageJson => {
    return {
      dependencies: {},
      devDependencies: {},
      ...(parseJson(packagePath, 'package.json') as IPackageJson),
    };
  }
);

const parseTsConfig = _.memoize(
  (packagePath: string = '.'): ITsConfig => {
    return parseJson(packagePath, 'tsconfig.json') as ITsConfig;
  }
);

const localDepsMap = _.memoize(
  (): IDepsMap => {
    return allPackageNames()
      .map((p) => parsePackageJson(p))
      .map(({ name, version }) => ({ [name]: `^${version}` }))
      .reduce((deps, dep) => ({ ...deps, ...dep }));
  }
);

const getVersionInfo = _.memoize((packageName: string) => {
  const lockfile = parseLockfile();
  const rootPackageJson = parsePackageJson();
  let versionInfo = {
    installedVersion: undefined,
    localVersion: localDepsMap()[packageName],
    lockVersion: undefined,
    pkgDevVersion: rootPackageJson.devDependencies[packageName],
    pkgVersion: rootPackageJson.dependencies[packageName],
  };
  try {
    const [, , version, lockfileKey] = Object.keys(lockfile)
      .filter((p) => p.startsWith(`${packageName}@`))
      .map((p) => [...p.split(/(?<!^)@/), p])
      .map(([p, ver, key]) => [p, semver.coerce(ver), ver, key])
      .reduce((maxP, p) => (semver.gt(p[1], maxP[1]) ? p : maxP));
    versionInfo = {
      ...versionInfo,
      installedVersion: lockfile[lockfileKey as string].version,
      lockVersion: version as string,
    };
  } catch (e) {
    if (!(e instanceof TypeError)) {
      throw e;
    }
  }
  return versionInfo;
});

const depsMap = (packages: string[]): IDepsMap => {
  if (empty(packages)) {
    return {};
  }
  return packages
    .map((packageName) => {
      const {
        localVersion,
        lockVersion,
        pkgDevVersion,
        pkgVersion,
      } = getVersionInfo(packageName);
      return {
        [packageName]:
          pkgVersion || lockVersion || pkgDevVersion || localVersion,
      };
    })
    .reduce((deps, dep) => ({ ...deps, ...dep }));
};

const transpilePackage = (packagePath: string = '.'): Promise<void> => {
  return new Promise((resolve, reject) => {
    let exited = false;
    const process = childProcess.spawn('yarn', ['run', 'transpile'], {
      cwd: path.join(root(), packagePath),
      stdio: ['ignore', 'inherit', 'inherit'],
    });

    process.on('error', (err) => {
      if (exited) {
        return;
      }
      exited = true;
      reject(err);
    });

    process.on('exit', (code) => {
      if (exited) {
        return;
      }
      exited = true;
      code === 0 ? resolve() : reject('Exit code: ' + code);
    });
  });
};

const getEntryPoints = (packagePath: string = '.'): string[] => {
  const { main: mainEntry, bin } = parsePackageJson(packagePath);
  let entryPoints = [mainEntry];
  if (typeof bin === 'object') {
    entryPoints = entryPoints.concat(Object.keys(bin).map((k) => bin[k]));
  }
  return entryPoints
    .filter((s) => s && !empty(s))
    .map((s) => path.join(packagePath, s));
};

const parseRequireStrings = (strings, dir): [string[], string[]] => {
  return strings.reduce(
    ([allFiles, allPackages], name) => {
      if (empty(name)) {
        return [allFiles, allPackages];
      }
      if (name[0] === '.') {
        if (path.extname(name) === '.json') {
          return [allFiles, allPackages];
        }
        const fullPath = path.join(root(), dir, name);
        if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
          return [
            allFiles.concat(path.join(dir, name, 'index.js')),
            allPackages,
          ];
        }
        return [allFiles.concat(path.join(dir, `${name}.js`)), allPackages];
      }
      if (isBuiltIn(name)) {
        return [allFiles, allPackages];
      }
      const packageParts = name.split('/');
      let packageName = packageParts[0];
      if (name[0] === '@') {
        packageName = packageParts.slice(0, 2).join('/');
      }
      return [allFiles, allPackages.concat(packageName)];
    },
    [[], []]
  );
};

const parseRequireExpressions = async (
  nodes,
  src,
  dir
): Promise<IFileScanWarning[]> => {
  const srcString = src.toString();
  const lcCalc = lineColumn(srcString, { origin: 1 });
  const sourceMap = await new SourceMapConsumer(
    convert.fromSource(srcString).sourcemap
  );
  return nodes
    .filter((n) => {
      return n.arguments[0].type === 'Identifier';
    })
    .map((n) => {
      const { name, start } = n.arguments[0];
      const loc = lcCalc.fromIndex(start);
      const { line, column, source } = sourceMap.originalPositionFor({
        column: loc.col,
        line: loc.line,
      });
      return {
        line,
        name,
        source: path.join(dir, source),
        type: WarningType.RequireExpression,
      };
    });
};

const scanFile = async (filePath: string): Promise<IFileScanResult> => {
  const dir = path.dirname(filePath);
  const src = fs.readFileSync(path.join(root(), filePath), 'utf8');
  const { strings, expressions, nodes } = detective.find(src, { nodes: true });
  const [files, packages] = parseRequireStrings(strings, dir);
  const warnings = empty(expressions)
    ? []
    : await parseRequireExpressions(nodes, src, dir);
  return {
    files,
    packages,
    warnings,
  };
};

const fileHasDependencies = (filePath): boolean => {
  const src = fs.readFileSync(path.join(root(), filePath), 'utf8');
  const { nodes } = detective.find(src, { nodes: true });
  return nodes.length > 0;
};

const findNotTraversed = (packagePath: string, scanned: string[]): string[] => {
  const traversed = new Set(scanned);
  const dir = parseTsConfig(packagePath).compilerOptions.outDir;
  const files = glob.sync(path.join(root(), packagePath, dir, '**/*.js'));
  return files
    .map((f) => f.replace(root(), ''))
    .filter((f) => !traversed.has(f));
};

const walkTree = async (entryPoints: string[]): Promise<IWalkTreeResult> => {
  const remaining = new Set(entryPoints);
  const scanned = new Set();
  const packages = new Set();
  let warnings = [];
  while (remaining.size > 0) {
    const next = remaining.values().next().value;
    const result = await scanFile(next);
    remaining.delete(next);
    scanned.add(next);
    result.packages.forEach((p) => packages.add(p));
    result.files.forEach((f) => (scanned.has(f) ? null : remaining.add(f)));
    warnings = warnings.concat(result.warnings);
  }

  return {
    packages: Array.from(packages),
    scanned: Array.from(scanned),
    warnings,
  };
};

const scanPackage = async (packagePath: string) => {
  const { packages, scanned, warnings } = await walkTree(
    getEntryPoints(packagePath)
  );
  return {
    packages,
    warnings: (warnings as IWarning[]).concat(
      findNotTraversed(packagePath, scanned)
        .map((file) => [file, fileHasDependencies(file)])
        .map(([file, hasDeps]) => ({
          file,
          hasDeps,
          type: WarningType.NotTraversed,
        }))
    ),
  };
};

const findDependencies = async (packagePath: string) => {
  const { packages, warnings } = await scanPackage(packagePath);
  const dependencies = depsMap(packages);
  return {
    dependencies,
    warnings: warnings.concat(
      Object.keys(dependencies)
        .filter((k) => empty(dependencies[k]))
        .map((packageName) => ({
          packageName,
          type: WarningType.NoVersionFound,
        }))
    ),
  };
};

const depsDiffPackage = async (
  packagePath: string
): Promise<IDepsDiffResult> => {
  const { dependencies: fromDeps } = parsePackageJson(packagePath);
  const { dependencies: toDeps, warnings } = await findDependencies(
    packagePath
  );
  const sharedDeps = _.intersection(Object.keys(fromDeps), Object.keys(toDeps));
  const extraDeps = _.difference(Object.keys(fromDeps), sharedDeps);
  const missingDeps = _.difference(Object.keys(toDeps), sharedDeps);
  const versionDiffs = empty(sharedDeps)
    ? {}
    : sharedDeps
        .map((dep) => ({
          [dep]: [fromDeps[dep], toDeps[dep]],
        }))
        .reduce((deps, dep) => ({ ...deps, ...dep }));
  return {
    depsDiff: [
      ...Object.keys(versionDiffs).map((dep) => {
        const [fromVer, toVer] = versionDiffs[dep];
        let diffType =
          fromVer === toVer ? DepsDiffType.SameVer : DepsDiffType.DiffVer;
        if (
          diffType === DepsDiffType.DiffVer &&
          semver.intersects(fromVer, toVer)
        ) {
          diffType = DepsDiffType.CompatVer;
        }
        return {
          fromVer,
          name: dep,
          toVer,
          type: diffType,
        };
      }),
      ...extraDeps.map((dep) => ({
        fromVer: fromDeps[dep],
        name: dep,
        type: DepsDiffType.Extra,
      })),
      ...missingDeps.map((dep) => ({
        name: dep,
        toVer: toDeps[dep],
        type: DepsDiffType.Missing,
      })),
    ],
    warnings,
  };
};

const suggestedDeps = (
  packageName: string,
  depsDiff: IDepsDiff[]
): IDepsMap => {
  const { dependencies } = parsePackageJson(packageName);
  return depsDiff.reduce((newDeps, depDiff) => {
    switch (depDiff.type) {
      case DepsDiffType.CompatVer:
      case DepsDiffType.DiffVer:
      case DepsDiffType.Missing:
        dependencies[depDiff.name] = depDiff.toVer;
        break;
      case DepsDiffType.Extra:
        delete dependencies[depDiff.name];
    }
    return dependencies;
  }, dependencies);
};

const warningString = (warning: IWarning): string => {
  switch (warning.type) {
    case WarningType.NoVersionFound:
      const noVer = warning as INoVersionFoundWarning;
      return `No version found for package ${noVer.packageName}`;
    case WarningType.NotTraversed:
      const notTrav = warning as INotTraversedWarning;
      return `${notTrav.hasDeps ? '[deps] ' : ''}The file ${
        notTrav.file
      } was not traversed in scan from entry points`;
    case WarningType.RequireExpression:
      const badReq = warning as IFileScanWarning;
      return `Required expression '${badReq.name}' could not be parsed in ${
        badReq.source
      } on line ${badReq.line}`;
  }
};

const printDepsDiff = (
  packageName: string,
  depsDiff: IDepsDiff[],
  warnings: IWarning[]
) => {
  const missingDeps = depsDiff.filter(
    (diff) => diff.type === DepsDiffType.Missing
  );
  const extraDeps = depsDiff.filter((diff) => diff.type === DepsDiffType.Extra);
  const mismatchedDeps = depsDiff.filter(
    (diff) =>
      diff.type === DepsDiffType.DiffVer || diff.type === DepsDiffType.CompatVer
  );
  const hasChanges =
    missingDeps.length + extraDeps.length + mismatchedDeps.length > 0;

  const warn = colors.yellow('=>');
  const err = colors.red('=>');
  const succ = colors.green('=>');

  logger.log(`Audit for ${colors.bold(parsePackageJson(packageName).name)}:`);

  if (warnings.length > 0) {
    logger.log();
    warnings.forEach((w) => {
      logger.log(`  ${warn} ${warningString(w)}`);
    });
  }

  if (!hasChanges) {
    logger.log(`\n${succ} No discrepencies found!`);
  }

  if (missingDeps.length > 0) {
    logger.log(colors.bold('\n  Missing Packages:'));
    missingDeps.forEach((diff) =>
      logger.log(`  ${err} ${diff.name}: ${diff.toVer}`)
    );
  }
  if (extraDeps.length > 0) {
    logger.log(colors.bold('\n  Unnecessary Packages:'));
    extraDeps.forEach((diff) =>
      logger.log(`  ${warn} ${diff.name}: ${diff.fromVer}`)
    );
  }
  if (mismatchedDeps.length > 0) {
    logger.log(colors.bold('\n  Mismatched Packages:'));
    mismatchedDeps.forEach((diff) =>
      logger.log(
        `  ${diff.type === DepsDiffType.DiffVer ? err : warn} ${diff.name}: ${
          diff.fromVer
        } -> ${diff.toVer}`
      )
    );
  }

  if (hasChanges) {
    logger.log(colors.bold('\n  Suggested Dependencies:\n'));
    logger.log(JSON.stringify(suggestedDeps(packageName, depsDiff), null, 2));
  }
};

const audit = async (packageName: string) => {
  const { depsDiff, warnings } = await depsDiffPackage(packageName);
  printDepsDiff(packageName, depsDiff, warnings);
  return depsDiff;
};

const main = async () => {
  for (const packageName of allPackageNames()) {
    await audit(packageName);
    logger.log();
  }
};

main();
