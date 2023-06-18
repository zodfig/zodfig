import { ZodError, ZodType, z } from 'zod';
import { partialUtil } from 'zod/lib/helpers/partialUtil';
import * as fs from 'fs';
import mergeDeep from 'merge-deep';
import * as cmd from 'commander';
import { Writer, Writers, write } from './write';
import { ChildProcess, spawn, execSync } from 'child_process';
import chokidar from 'chokidar';
import { INITIAL_WORKING_DIR, KnownError, TOOL_NAME, getProjectConfigFilePath } from './utils';
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
    return this.override(await overrider(this._config));
  }
}

export function setWriter(fileExt: string, writer: Writer) {
  // TODO: have some way to inform users when a library overrode a writer
  Writers[fileExt] = writer;
}

let isWatching = false;

export function cli() {
  const command = cmd.program
    .name(TOOL_NAME)
    .option('-v, --verbose', `print resulting ${TOOL_NAME} before writing`)
    .option('-w, --watch', `re-run ${TOOL_NAME} on change to ${TOOL_NAME}.ts file`)
    .argument('[command]', `command to run when ${TOOL_NAME} has finished generating config. Ex: \`pnpm ${TOOL_NAME} -w "pnpm start"\``)
    .action(async (command, { watch, verbose }) => {
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
        await run(!!verbose);
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

export async function run(print = false, runIn = INITIAL_WORKING_DIR) {
  console.log()
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
    const zodfig: ZodFig<any> = await fn();
    const parsed = zodfig._schema.parse(zodfig._config);
    if (print) {
      console.log(JSON.stringify(parsed, null, 2));
    }
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
