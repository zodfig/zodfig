import { ZodError, ZodType, z } from 'zod';
import * as fs from 'fs';
import { PartialDeep } from 'type-fest';
import mergeDeep from 'merge-deep';
import * as cmd from 'commander';
import { Writer, Writers, write } from './write';
import { ChildProcess, spawn, execSync } from 'child_process';
import chokidar from 'chokidar';
import { INITIAL_WORKING_DIR, KnownError, TOOL_NAME, getProjectConfigFilePath } from './utils';

export function leverepo<T, ZT extends ZodType<T>>(setup: {schema: ZT, config: z.infer<ZT>}) {
  return setup;
}

export { z } from 'zod';

export function merge<T extends object>(base: T, ...overrides: PartialDeep<T>[]): T {
  return mergeDeep(base, ...overrides);
}

export type * as UtilTypes from 'type-fest';

export function setWriter(fileExt: string, writer: Writer) {
  // TODO: have some way to inform users when a library overrode a writer
  Writers[fileExt] = writer;
}

let isWatching = false;

export function cli() {
  const command = cmd.program
    .name(TOOL_NAME)
    .option('-w, --watch', `re-run ${TOOL_NAME} on change to ${TOOL_NAME}.ts file`)
    .argument('[command]', `command to run when ${TOOL_NAME} has finished generating config. Ex: \`pnpm ${TOOL_NAME} -w "pnpm start"\``)
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
        isWatching = !!watch;
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
        const filePath = getProjectConfigFilePath(INITIAL_WORKING_DIR);
        console.log(`Watching ${filePath}...`);
        let ready = false;
        chokidar.watch(filePath).on('all', (eventName) => {
          switch(eventName) {
            case 'add':
            case 'change':
              if (eventName === 'add' && !ready) {
                break;
              }
              console.log(`Detected ${eventName} for ${TOOL_NAME}.ts`);
              go();
              break;
            default:
              console.log(`Detected ${eventName} for ${TOOL_NAME}.ts (halting watch)`);
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

export async function run(dir?: string) {
  const runIn = dir ?? INITIAL_WORKING_DIR;
  try {
    const configDeclarationFile = getProjectConfigFilePath(runIn);
    console.log(`Writing config for ${configDeclarationFile}`);
    if (!fs.existsSync(configDeclarationFile)) {
      throw new KnownError(`Could not locate ${configDeclarationFile}`);
    }
    delete require.cache[configDeclarationFile];
    const {default: fn} = require(configDeclarationFile);
    if (typeof fn !== 'function') {
      throw new KnownError(`Expected ${configDeclarationFile} to export default function.`);
    }
    const {config, schema}: {config: unknown, schema: ZodType} = await fn();
    if (typeof config === 'undefined' || typeof schema === 'undefined') {
      throw new KnownError(`Export of ${configDeclarationFile} must be async default function returning Zod type def and config tuple`);
    }
    const parsed = schema.parse(config);
    await write(parsed);
    console.log(`Config files written for ${configDeclarationFile}`);
  } catch(e) {
    if (e instanceof ZodError) {
      console.log(`Zod validation error${e.errors.length > 1 ? 's' : ''}`);
      console.log(e.errors);
    } else if (e instanceof KnownError) {
      console.log(e.message);
    } else {
      console.log(e);
    }
  }
  if (isWatching && runIn === INITIAL_WORKING_DIR) {
    console.log('Waiting for changes...');
  }
}
