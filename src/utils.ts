import * as path from 'path';
import { z } from 'zod';
import { SubmoduleConfig } from './submodules';

export const TOOL_NAME: string = require('../package.json').name.split('/')[0].substring(1);
export const FILE_NAME: string = `${TOOL_NAME}.ts`;
export const INITIAL_WORKING_DIR: string = process.cwd();

export class KnownError extends Error {}

export function getLeverepoFilePath(dir: string) {
  return path.resolve(dir, FILE_NAME);
}

export const LeverepoConfigSchema = z.object({
  'package.json': z.optional(z.object({
    leverepo: z.optional(z.object({
      submodules: z.optional(z.record(SubmoduleConfig))
    }))
  }))
});
