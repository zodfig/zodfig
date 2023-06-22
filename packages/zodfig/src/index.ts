import { ZodError, ZodType, z } from 'zod';
import { partialUtil } from 'zod/lib/helpers/partialUtil';
import * as fs from 'fs';
import mergeDeep from 'merge-deep';
import * as cmd from 'commander';
import { write } from './write';
import { ChildProcess, spawn, execSync } from 'child_process';
import chokidar from 'chokidar';
import { INITIAL_WORKING_DIR, KnownError, TOOL_NAME, FILE_NAME } from './utils';
import { scan } from './scan';
import 'zod-merge-deep';

export { z } from 'zod';

/**
 * 
 */
export class ZodFig<T extends z.AnyZodObject> {
  public constructor(readonly _schema: T, readonly _config: z.infer<T>) {
    if (this._config) Object.freeze(this._config);
  }

  /**
   * Merge current schema + config with another zodfig's schema + config.
   * @param merging zodfig to merge with
   * 
   * Implementation taken from https://github.com/colinhacks/zod/blob/5e23b4fae4715c7391f9ceb4369421a034851b4c/src/types.ts#L2470-L2476
   * TODO: it seems like we're blocked with this tool because there isn't a merge deep ability in Zod.
   *       currently someone can add config for new files but cannot use the merge method to merge configs which touch the same file
   *       There's an implementation of merge deep, so we should bring it in and make it more generic
   *       - https://github.com/colinhacks/zod/pull/1739
   *       - https://github.com/colinhacks/zod/issues/1508
   */
  public merge<Incoming extends z.AnyZodObject, Augmentation extends Incoming['shape']>(
    merging: ZodFig<Incoming>
  ): ZodFig<z.ZodObject<
    z.objectUtil.extendShape<T['shape'], Augmentation>,
    Incoming["_def"]["unknownKeys"],
    Incoming["_def"]["catchall"]
  >> {
    this._schema.mergeDeep();
    return new ZodFig(this._schema.merge(merging._schema), mergeDeep({}, this._config ?? {}, merging._config ?? {}) as any) as any;
  }

  /**
   * Overrides the current config
   * 
   * @param config 
   * @returns new Zodfig instance which has overriden config
   */
  public override(config: z.infer<partialUtil.DeepPartial<T>>): ZodFig<T> {
    return new ZodFig(this._schema, mergeDeep({}, this._config, config));
  }

  /**
   * Overrides the current config
   * 
   * @param overrider async function giving a promise to new config
   * @returns promise to new Zodfig instance which has overriden config
   */
  public async overrideAync(overrider: (curConfig: z.infer<T>) => Promise<z.infer<partialUtil.DeepPartial<T>>>): Promise<ZodFig<T>> {
    // TODO: maybe deep copy before passing to input fn
    return this.override(await overrider(this._config));
  }
}

export function cli() {
  const command = cmd.program
    .name(TOOL_NAME)
    .option('-v, --verbose', `print resulting ${TOOL_NAME} before writing`)
    .option('-w, --watch', `re-run ${TOOL_NAME} on change to ${TOOL_NAME}.ts file`)
    // TODO update to accept multiple commands
    .argument('[command]', `command to run when ${TOOL_NAME} has finished generating config. Ex: \`pnpm ${TOOL_NAME} -w "pnpm start"\``)
    .action(async (command: string | undefined, { watch, verbose }) => {
      let going = false;
      let shouldRego = false;
      let activeCmds: Record<string, Record<string, ChildProcess>> = {};
      async function go(filepath: string) {
        if (!activeCmds[filepath]) {
          activeCmds[filepath] = {};
        }
        if (going) {
          shouldRego = true;
          return;
        }
        if (shouldRego) {
          shouldRego = false;
        }
        for (const [name, activeCmd] of Object.entries(activeCmds[filepath])) {
          console.log(`Stopping ${filepath}'s "${name}" via SIGTERM`);
          activeCmd.kill('SIGTERM');
        }
        going = true;
        await run(filepath, !!verbose);
        for (const [name] of Object.entries(activeCmds[filepath])) {
          // TODO: bring in code for multiple parallel commands.
          const presentCommand = (command as string);
          const [cmdName, ...args] = presentCommand.split(' ');
          activeCmds[filepath][name] = spawn(cmdName, args, {shell: true, stdio: 'inherit'});
          activeCmds[filepath][name].on('exit', (code) => {
            delete activeCmds[filepath][name];
            if (!watch) {
              if(Object.keys(activeCmds[filepath]).length === 0) {
                delete activeCmds[filepath];
                if (Object.keys(activeCmds).length === 0) {
                  process.exit(code ?? undefined);
                }
              }
            }
          })
        }
        if (shouldRego) {
          setTimeout(go, 0);
        } else {
          console.log('Waiting for changes...');
        }
        going = false;
      }
      const configFiles = scan(INITIAL_WORKING_DIR);
      if (configFiles.length === 0) {
        console.log(`Found no ${FILE_NAME} files in ${INITIAL_WORKING_DIR}`);
      }
      for (const file of configFiles) {
        await go(file);
        if (watch) {
          console.log(`Watching ${file} for changes...`);
          let ready = false;
          chokidar.watch(file).on('all', (eventName) => {
            switch(eventName) {
              case 'add':
              case 'change':
                if (eventName === 'add' && !ready) {
                  break;
                }
                console.log(`Detected ${eventName} for ${TOOL_NAME}.ts`);
                go(file);
                break;
              default:
                console.log(`Detected ${eventName} for ${TOOL_NAME}.ts (halting watch)`);
                for (const [name, activeCmd] of Object.entries(activeCmds[file])) {
                  console.log(`Stopping ${file}'s "${name}" via SIGTERM`);
                  activeCmd.kill('SIGTERM');
                }
                process.exit();
            }
          }).on('ready', () => {
            ready = true;
          });
        }
      }
      if (!watch) {
        process.exit();
      }
    });
  command.parse();
}

export async function run(filepath: string, print = false) {
  try {
    if (!fs.existsSync(filepath)) {
      return;
    }
    console.log(`Writing config for ${filepath}`);
    delete require.cache[filepath];
    const {default: fn} = require(filepath);
    if (typeof fn !== 'function') {
      throw new KnownError(`Expected ${filepath} to export default function.`);
    }
    const zodfig: ZodFig<any> = await fn();
    const parsed = zodfig._schema.parse(zodfig._config);
    if (print) {
      console.log(JSON.stringify(parsed, null, 2));
    }
    await write(parsed);
    console.log(`Config files written for ${filepath}`);
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
}
