import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml'

export type Writer = (config: any) => Promise<string>;

export const Writers: Record<string, Writer> = {
  json: async config => JSON.stringify(config, null, 2) + '\n',
  yaml: async config => yaml.stringify(config) + '\n',
  yml: async config => yaml.stringify(config) + '\n'
}

export async function write(config: any) {
  const proms: Promise<void>[] = [];
  for (const [relFilePath, fileconfig] of Object.entries(config)) {
    const ext = path.extname(relFilePath).substring(1);
    if (!Writers[ext]) {
      console.log(`No writers configured for file extension '${ext}' for path '${relFilePath}'`);
      console.log(`Writers only configured for extensions ${Object.keys(Writers).join(', ')}`)
      process.exit();
    }
    const absPath = path.resolve(process.cwd(), relFilePath);
    proms.push(writeSingle(ext, absPath, fileconfig));
  }
  await Promise.all(proms);
}

async function writeSingle(ext: string, filepath: string, fileconfig: any) {
  const output = await Writers[ext](fileconfig);
  await fs.promises.mkdir(path.dirname(filepath), {recursive: true});
  await fs.promises.writeFile(filepath, output);
}