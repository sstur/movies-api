/* eslint-disable no-console */
import { readFile } from 'fs/promises';

import * as prettier from 'prettier';
import { Generator } from '@runtyping/runtypes';

const basePath = __dirname.split('/').slice(0, -2).join('/') + '/';
const prelude =
  '/**\n * This file was auto-generated. Do not make direct changes to the file.\n */\n/* eslint-disable */';

async function main() {
  const args = process.argv.slice(2);
  const firstArg = args[0] ?? '';
  const inputPath = firstArg.startsWith('.') ? firstArg : './' + firstArg;

  // This path is not actually used for output, just for computing import paths
  const outputPath = 'src/generated/some-file.ts';

  // Attempt to read the list of exports from the input file
  const inputFileContent = await readFile(inputPath, 'utf8');
  const exportList: Array<string> = [];
  inputFileContent.replace(/export type (\w+)/g, (_, name) => {
    exportList.push(String(name));
    return _;
  });

  const generator = new Generator({
    targetFile: outputPath,
  });

  // Monkey-patching console.warn here since `generator.generate()` will output some noise otherwise.
  const _warn = console.warn;
  console.warn = () => {};

  const file = await generator.generate({
    file: inputPath,
    type: exportList,
    exportStaticType: false,
  });

  // Reset console.warn back to normal
  console.warn = _warn;

  const generated = file.getFullText();

  const prettierOptions =
    (await prettier.resolveConfig(__filename)) ?? undefined;

  const formatted = prettier.format(generated, {
    ...prettierOptions,
    parser: 'babel',
    filepath: basePath + outputPath,
  });

  const output = prelude + '\n' + formatted;

  process.stdout.write(output);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
