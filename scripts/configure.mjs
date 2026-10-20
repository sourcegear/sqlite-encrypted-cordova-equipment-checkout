import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(projectDirectory, 'www', 'js', 'config.generated.js');
const activationKey = process.env.SQLITE_ENCRYPTED_ACTIVATION_KEY?.trim() ?? '';

await mkdir(dirname(outputPath), {recursive: true});
await writeFile(
  outputPath,
  `window.SQLiteEncryptedConfig = {activationKey: ${JSON.stringify(activationKey)}};\n`,
  'utf8'
);

console.log(
  activationKey.length === 0
    ? 'Configured without SQLITE_ENCRYPTED_ACTIVATION_KEY; the app will show a configuration error.'
    : 'Configured with the SQLite.Encrypted activation key.'
);

