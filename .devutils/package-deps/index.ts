import * as yarnLockfile from '@yarnpkg/lockfile';
import * as childProcess from 'child_process';
import * as convert from 'convert-source-map';
import * as detective from 'detective';
import * as fs from 'fs';
import * as glob from 'glob';
import * as empty from 'is-empty';
import * as lineColumn from 'line-column';
import * as _ from 'lodash';
import * as path from 'path';
import * as semver from 'semver';
import { SourceMapConsumer } from 'source-map';

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

const root = _.memoize((): string => path.join(__dirname, '../../'));

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
    return fs
      .readdirSync(path.join(root(), 'packages'))
      .filter((p) =>
        fs.lstatSync(path.join(root(), 'packages', p)).isDirectory()
      )
      .map((p) => parsePackageJson(path.join('packages', p)))
      .map(({ name, version }) => ({ [name]: version }))
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
      return [allFiles, allPackages.concat(name)];
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
  const allWarnings = (warnings as IWarning[]).concat(
    findNotTraversed(packagePath, scanned).map((file) => ({
      file,
      type: WarningType.NotTraversed,
    }))
  );
  const dependencies = depsMap(packages);
  return { dependencies, warnings: allWarnings };
};

const main = async () => {
  // await transpilePackage('core-accounts');
  console.log(await scanPackage('packages/core-accounts'));
};

main();
