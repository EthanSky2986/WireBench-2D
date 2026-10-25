import { cpSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const launcherDist = join(root, 'launcher', 'dist');
const artifactDir = join(root, 'artifacts');
const dotnet = process.platform === 'win32' ? 'dotnet.exe' : 'dotnet';

rmSync(launcherDist, { recursive: true, force: true });
mkdirSync(join(root, 'launcher'), { recursive: true });
cpSync(join(root, 'dist'), launcherDist, { recursive: true });
rmSync(artifactDir, { recursive: true, force: true });
mkdirSync(artifactDir, { recursive: true });

execFileSync(
  dotnet,
  [
    'publish',
    join(root, 'launcher', 'WireBenchLauncher.csproj'),
    '--configuration',
    'Release',
    '--runtime',
    'win-x64',
    '--self-contained',
    'true',
    '-p:PublishSingleFile=true',
    '-p:IncludeNativeLibrariesForSelfExtract=true',
    `-p:Version=${packageJson.version}`,
    '--output',
    artifactDir,
  ],
  { cwd: root, stdio: 'inherit' },
);

const built = join(artifactDir, 'WireBench.exe');
const named = join(artifactDir, `WireBench-${packageJson.version}-win-x64.exe`);
renameSync(built, named);
console.log(`Created ${named}`);
