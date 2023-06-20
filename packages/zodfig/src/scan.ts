import * as fs from 'fs';
import * as path from 'path';
import { FILE_NAME } from './utils';

enum FileSystemType {
  File = 'File',
  Directory = 'Directory',
  Other = 'Other'
}

const DIRNAMES_TO_IGNORE = new Set(['node_modules', '.git']);

export function scan(dir: string): string[] {
  // TODO: is bfs or dfs better here?
  const children = fs.readdirSync(dir, {withFileTypes: true});
  const result: string[] = [];
  for (const child of children) {
    const name = child.name;
    const childPath = path.resolve(dir, name);
    
    let fsType: FileSystemType = FileSystemType.Other;
    if (child.isSymbolicLink()) {
      const real = fs.realpathSync(childPath);
      const stats = fs.statSync(real);
      if (stats.isDirectory()) fsType = FileSystemType.Directory;
      else if (stats.isFile()) fsType = FileSystemType.File;
    } else if (child.isFile()) fsType = FileSystemType.File;
    else if (child.isDirectory()) fsType = FileSystemType.Directory;

    switch(fsType) {
      case FileSystemType.File:
        if (name === FILE_NAME) {
          result.push(childPath);
        }
        break;
      case FileSystemType.Directory:
        if (!DIRNAMES_TO_IGNORE.has(name)) {
          result.push(...scan(childPath));
        }
        break;
    }
  }
  return result;
}