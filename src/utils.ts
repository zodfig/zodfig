import * as path from 'path';

export const TOOL_NAME: string = require('../package.json').name.split('/')[0].substring(1);
export const FILE_NAME: string = `${TOOL_NAME}.ts`;
export const INITIAL_WORKING_DIR: string = process.cwd();

export class KnownError extends Error {}

export function getProjectConfigFilePath(dir: string) {
  return path.resolve(dir, FILE_NAME);
}