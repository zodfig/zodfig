import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml'

export type Writer = {
  match: RegExp;
  write: (config: any) => Promise<string>;
}

export const writers: Record<string, Writer> = {
  json: {match: /.json$/, write: async config => JSON.stringify(config, null, 2) + '\n'},
  yaml: {match: /.ya?ml$/, write: async config => yaml.stringify(config) + '\n'}
};

export async function write(config: any) {
  const proms: Promise<void>[] = [];
  for (const [relFilePath, fileconfig] of Object.entries(config)) {
    const absPath = path.resolve(process.cwd(), relFilePath);
    let writer: Writer | undefined;
    for (const [name, curWriter] of Object.entries(writers)) {
      if (curWriter.match.test(absPath)) {
        console.log(`Using writer '${name}' for ${absPath}`);
        writer = curWriter;
        break;
      }
    }
    if (writer === undefined) {
      console.log(`No writers configured for ${absPath}`);
      console.log(`Available writers:`);
      for (const [name, curWriter] of Object.entries(writers)) {
        console.log(`  ${name}: ${curWriter.match.toString()}`)
      }
      process.exit();
    }
    
    proms.push(writeSingle(writer, absPath, fileconfig));
  }
  await Promise.all(proms);
}

async function writeSingle(writer: Writer, filepath: string, fileconfig: any) {
  const output = await writer.write(fileconfig);
  await fs.promises.mkdir(path.dirname(filepath), {recursive: true});
  await fs.promises.writeFile(filepath, output);
}