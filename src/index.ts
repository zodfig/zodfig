import { ZodError, ZodType, z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { PartialDeep } from 'type-fest';
import mergeDeep from 'merge-deep';
import { Writer, Writers, write } from './write';

export function leverepo<T, ZT extends ZodType<T>>(setup: {shape: ZT, config: z.infer<ZT>}) {
  return setup;
}

export { z } from 'zod';

export function merge<T extends object>(base: T, ...overrides: PartialDeep<T>[]): T {
  return overrides.reduce(mergeDeep, base);
}

export type * as UtilTypes from 'type-fest';

export function setWriter(fileExt: string, writer: Writer) {
  // TODO: have some way to inform users when a library overrode a writer
  Writers[fileExt] = writer;
}

export function run() {
  const cwd = process.cwd();
  const leverepoFilePath = path.resolve(cwd, 'leverepo.ts');
  if (!fs.existsSync(leverepoFilePath)) {
    console.log(`Could not locate ${leverepoFilePath}`);
    process.exit();
  }
  const {default: fn} = require(leverepoFilePath);
  if (typeof fn !== 'function') {
    console.log(`Expected ${leverepoFilePath} to export default function.`);
    process.exit();
  }
  fn()
    .then(<T extends ZodType> ({shape, config}: ReturnType<typeof leverepo<T, ZodType<T>>>) => {
      if (typeof config === 'undefined' || typeof shape === 'undefined') {
        console.log(`Export of ${leverepoFilePath} must be async default function returning Zod type def and config tuple`);
        process.exit();
      }
      const parsed = shape.parse(config);
      return write(parsed);
    })
    .catch((e: Error) => {
      if (e instanceof ZodError) {
        console.log(`Zod validation error${e.errors.length > 1 ? 's' : ''}`);
        console.log(e.errors);
        process.exit();
      }
      console.log(e);
      process.exit();
    })
    .then(() => {
      console.log('Files written. Thats a wrap!');
      process.exit();
    });
}
