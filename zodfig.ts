// replace './src' with '@zodfig/core' in your repo
import { leverepo, z } from './src';
import { TOOL_NAME } from './src/utils';

const PackageJson = z.object({
  name: z.string(),
  dependencies: z.record(z.string()),
  devDependencies: z.record(z.string()),
  bin: z.record(z.string()),
  scripts: z.record(z.string()),
  main: z.string()
}).strict();

const TSConfig = z.object({
  compilerOptions: z.object({
    "target": z.string(),
    "module": z.string(),
    "esModuleInterop": z.boolean(),
    "moduleResolution": z.string(),
    "strict": z.boolean(),
    "forceConsistentCasingInFileNames": z.boolean(),
    "skipLibCheck": z.boolean(),
    "resolveJsonModule": z.boolean(),
    "sourceMap": z.boolean(),
    "declaration": z.boolean(),
    "experimentalDecorators": z.boolean(),
    "emitDecoratorMetadata": z.boolean(),
    "lib": z.array(z.string()),
    "types": z.array(z.string())
  }).strict()
}).strict();

const VSCodeSettings = z.object({
  "workbench.colorTheme": z.string(),
  "editor.insertSpaces": z.boolean(),
  "editor.tabSize": z.number(),
  "editor.detectIndentation": z.boolean()
});

const Repo = z.object({
  'package.json': PackageJson,
  'tsconfig.json': TSConfig,
  '.vscode/settings.json': VSCodeSettings
}).strict();

const PackageJsonVal: z.infer<typeof PackageJson> =
{
  "name": `@${TOOL_NAME}/core`,
  "dependencies": {
    "@swc/core": "^1.3.61",
    "@swc/helpers": "^0.5.1",
    "merge-deep": "^3.0.3",
    "ts-node": "^10.9.1",
    "type-fest": "^3.11.1",
    "typescript": "^5.0.4",
    "yaml": "^2.3.1",
    "zod": "^3.21.4",
    "commander": "^11.0.0",
    "chokidar": "^3.5.3"
  },
  "scripts": {
    [TOOL_NAME]: "node bin.js"
  },
  "bin": {
    [TOOL_NAME]: "./bin.js"
  },
  "main": "src",
  "devDependencies": {
    "@types/merge-deep": "^3.0.0",
    "@types/node": "^20.2.5"
  }
};

const TSConfigVal: z.infer<typeof TSConfig> =
{
  "compilerOptions": {
    "target": "ES5",
    "module": "CommonJS",
    "esModuleInterop": true,
    "moduleResolution": "node",
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "declaration": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "lib": ["ESNext"],
    "types": ["node"]
  }
}

export default async function() {
  const {schema, config} =  leverepo({
    schema: Repo, 
    config: {
      'package.json': PackageJsonVal,
      'tsconfig.json': TSConfigVal,
      '.vscode/settings.json': {
        "workbench.colorTheme": "Default Dark Modern",
        "editor.insertSpaces": true,
        "editor.tabSize": 2,
        "editor.detectIndentation": false
      } 
    }
  });
  return {schema, config};
}
