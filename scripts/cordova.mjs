import {access, readdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {delimiter, dirname, join, resolve} from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argumentsToCordova = process.argv.slice(2);
const environment = {...process.env};
const isWindows = process.platform === 'win32';
const gradleExecutable = isWindows ? 'gradle.bat' : 'gradle';

function canRunGradle() {
  return spawnSync('gradle', ['--version'], {
    env: environment,
    shell: isWindows,
    stdio: 'ignore'
  }).status === 0;
}

async function findFiles(directory, name, depth) {
  if (depth < 0) {
    return [];
  }
  let entries;
  try {
    entries = await readdir(directory, {withFileTypes: true});
  } catch (_) {
    return [];
  }

  const matches = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) {
      matches.push(path);
    } else if (entry.isDirectory()) {
      matches.push(...await findFiles(path, name, depth - 1));
    }
  }
  return matches;
}

async function addCachedGradleToPath() {
  if (canRunGradle()) {
    return true;
  }

  const wrapperCache = join(homedir(), '.gradle', 'wrapper', 'dists');
  const candidates = await findFiles(wrapperCache, gradleExecutable, 5);
  candidates.sort(function (left, right) {
    const leftIsEight = /[\\/]gradle-8\./i.test(left) ? 1 : 0;
    const rightIsEight = /[\\/]gradle-8\./i.test(right) ? 1 : 0;
    return rightIsEight - leftIsEight || right.localeCompare(left);
  });

  if (candidates.length === 0) {
    return false;
  }

  const gradleDirectory = dirname(candidates[0]);
  environment.PATH = gradleDirectory + delimiter + (environment.PATH || '');
  console.log('Using cached Gradle from ' + gradleDirectory);
  return canRunGradle();
}

async function addAndroidSdkToolsToPath() {
  const sdkDirectory = environment.ANDROID_HOME || environment.ANDROID_SDK_ROOT;
  if (!sdkDirectory) {
    return;
  }

  const candidates = [
    join(sdkDirectory, 'cmdline-tools', 'latest', 'bin'),
    join(sdkDirectory, 'cmdline-tools', 'bin'),
    join(sdkDirectory, 'tools', 'bin'),
    join(sdkDirectory, 'platform-tools'),
    join(sdkDirectory, 'emulator')
  ];
  const existing = [];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      existing.push(candidate);
    } catch (_) {
      // Android SDK layouts differ between installations.
    }
  }
  if (existing.length > 0) {
    environment.PATH = existing.join(delimiter) + delimiter + (environment.PATH || '');
  }
}

const needsAndroidGradle = argumentsToCordova.some(function (argument) {
  return argument.toLowerCase() === 'android';
});

if (needsAndroidGradle && !await addCachedGradleToPath()) {
  console.error([
    'Cordova Android requires a standalone Gradle command to create its generated wrapper.',
    'Install Gradle and add its bin directory to PATH, then confirm that `gradle --version` works.'
  ].join('\n'));
  process.exit(1);
}
if (needsAndroidGradle) {
  await addAndroidSdkToolsToPath();
}

const cordovaPath = resolve(projectDirectory, 'node_modules', 'cordova', 'bin', 'cordova');
const child = spawn(process.execPath, [cordovaPath, ...argumentsToCordova], {
  cwd: projectDirectory,
  env: environment,
  stdio: 'inherit'
});

child.on('error', function (error) {
  console.error(error.message);
  process.exit(1);
});
child.on('exit', function (code, signal) {
  if (signal) {
    console.error('Cordova stopped with signal ' + signal + '.');
    process.exit(1);
  }
  process.exit(code ?? 1);
});

