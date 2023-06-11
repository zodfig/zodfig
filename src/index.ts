import { ZodError, ZodType, z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { PartialDeep } from 'type-fest';
import mergeDeep from 'merge-deep';
import * as cmd from 'commander';
import { Writer, Writers, write } from './write';
import { ChildProcess, spawn } from 'child_process';
import chokidar from 'chokidar';

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

const NAME = require('../package.json').name.split('/')[0].substring(1);

function getLeverepoFilePath() {
  const cwd = process.cwd();
  return path.resolve(cwd, `${NAME}.ts`);
}

export function cli() {
  const command = cmd.program
    .name(NAME)
    .option('-w, --watch', `re-run ${NAME} on change to ${NAME}.ts file`)
    .argument('[command]', `command to run when ${NAME} has finished generating config. Ex: \`pnpm ${NAME} -w "pnpm start"\``)
    .action(async (command, { watch }) => {
      let going = false;
      let shouldRego = false;
      let activeCmd: {name: string; childProc: ChildProcess} | undefined = undefined;
      async function go() {
        if (going) {
          shouldRego = true;
          return;
        }
        if (shouldRego) {
          shouldRego = false;
        }
        if (activeCmd) {
          console.log(`Stopping "${activeCmd.name}" via SIGTERM`);
          activeCmd.childProc.kill('SIGTERM');
        }
        going = true;
        await run();
        if (command) {
          console.log(`${activeCmd ? 're-' : ''}running "${command}"`);
          const [name, ...args] = command.split(' ');
          activeCmd = {
            name: command,
            childProc: spawn(name, args, { shell: true, stdio: 'inherit' })
          };
          activeCmd.childProc.on('exit', (code) => {
            if (!watch) {
              process.exit(code ?? undefined);
            }
          });
        } else if (!watch) {
          process.exit();
        }
        if (shouldRego) {
          setTimeout(go, 0);
        }
        going = false;
      }
      if (watch) {
        console.log(`Watching ${NAME}.ts...`);
        let ready = false;
        chokidar.watch(getLeverepoFilePath()).on('all', (eventName) => {
          switch(eventName) {
            case 'add':
            case 'change':
              if (eventName === 'add' && !ready) {
                break;
              }
              console.log(`Detected ${eventName} for ${NAME}.ts`);
              go();
              break;
            default:
              console.log(`Detected ${eventName} for ${NAME}.ts (halting watch)`);
              if (activeCmd) {
                console.log(`Stopping "${activeCmd.name}" via SIGTERM`);
                activeCmd.childProc.kill();
              }
              process.exit();
          }
        }).on('ready', () => {
          ready = true;
        });
      }
      await go();
    });
  command.parse();
}

class KnownError extends Error {}

export async function run() {
  const configDeclarationFile = getLeverepoFilePath();
  if (!fs.existsSync(configDeclarationFile)) {
    console.log(`Could not locate ${configDeclarationFile}`);
    return;
  }
  delete require.cache[configDeclarationFile];
  const {default: fn} = require(configDeclarationFile);
  if (typeof fn !== 'function') {
    console.log(`Expected ${configDeclarationFile} to export default function.`);
    return;
  }
  let failed = false;
  await fn()
    .then(<T extends ZodType> ({shape, config}: ReturnType<typeof leverepo<T, ZodType<T>>>) => {
      if (typeof config === 'undefined' || typeof shape === 'undefined') {
        throw new KnownError(`Export of ${configDeclarationFile} must be async default function returning Zod type def and config tuple`);
      }
      const parsed = shape.parse(config);
      return write(parsed);
    })
    .catch((e: Error) => {
      failed = true;
      if (e instanceof ZodError) {
        console.log(`Zod validation error${e.errors.length > 1 ? 's' : ''}`);
        console.log(e.errors);
        return;
      } else if (e instanceof KnownError) {
        console.log(e.message);
        return;
      }
      console.log(e);
    })
    .then(() => {
      if (!failed) {
        console.log('Config files written.');
      }
    });
}
