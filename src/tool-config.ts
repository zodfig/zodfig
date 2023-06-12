import * as fs from 'fs';
import * as path from 'path';
import { TOOL_NAME, LeverepoConfigSchema, INITIAL_WORKING_DIR } from './utils';
import { z } from 'zod';
import { execForSubmodule } from './submodules';
import mergeDeep from 'merge-deep';
import { execSync } from 'child_process';

export async function execToolConfig(fileLocation: string) {
  const dirpath = path.dirname(fileLocation);
  const isRoot = dirpath === INITIAL_WORKING_DIR;
  const packageJson = path.resolve(dirpath, 'package.json');
  const exists = fs.existsSync(packageJson);
  const str = exists ? fs.readFileSync(packageJson).toString() : "{}";
  let contents: z.infer<typeof LeverepoConfigSchema>['package.json'];
  try {
    contents = JSON.parse(str);
  } catch(e) {
    console.log(`Unable to parse json of ${packageJson}`);
    throw e;
  }
  if (contents && contents.leverepo) {
    const toolConfig = contents.leverepo;
    if (toolConfig.submodules) {
      for (const submodPath in toolConfig.submodules) {
        await execForSubmodule(submodPath, toolConfig.submodules[submodPath]);
      }
    }
  }
}