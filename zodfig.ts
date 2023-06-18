// replace './src' with '@zodfig/core' in your repo
import { z, ZodFig } from './src';
import { TOOL_NAME } from './src/utils';

const PackageJson =
  new ZodFig(
    z.object({
      'package.json': z.object({
        name: z.string(),
        dependencies: z.record(z.string()),
        devDependencies: z.record(z.string()),
        bin: z.record(z.string()),
        scripts: z.record(z.string()),
        main: z.string()
      }).strict()
    }),
    {
      'package.json': {
        "name": `@${TOOL_NAME}/core`,
        "dependencies": {
          "@swc/core": "^1.3.61",
          "@swc/helpers": "^0.5.1",
          "merge-deep": "^3.0.3",
          "ts-node": "^10.9.1",
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
      }
    }
  );

const TSConfig = 
  new ZodFig(
    z.object({
      'tsconfig.json': z.object({
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
      }).strict()
    }),
    {
      'tsconfig.json': {
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
    }
  );

const VSCodeSettings = 
  new ZodFig(
    z.object({
      '.vscode/settings.json': z.object({
        "workbench.colorTheme": z.string(),
        "editor.insertSpaces": z.boolean(),
        /**
         * Tab size docs
         */
        "editor.tabSize": z.number(),
        /**
         * Test docs for detect indentation
         */
        "editor.detectIndentation": z.boolean()
      }),
    }),
    {
      '.vscode/settings.json': {
        "workbench.colorTheme": "Default Dark Modern",
        "editor.insertSpaces": true,
        "editor.tabSize": 3,
        "editor.detectIndentation": false,
      }
    });

export default async function() {
  return PackageJson.merge(TSConfig).merge(VSCodeSettings).override({
    '.vscode/settings.json': {
      'editor.tabSize': 2,
    }
  });
}
