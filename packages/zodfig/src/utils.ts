export const TOOL_NAME: string = require('../package.json').name;
export const FILE_NAME: string = `${TOOL_NAME}.ts`;
export const INITIAL_WORKING_DIR: string = process.cwd();

export class KnownError extends Error {}