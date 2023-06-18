# ZodFig

Manage your project configuration with [Zod](https://github.com/colinhacks/zod).

----

ZodFig offers a better way to share cross-project config.

`npm i -g @zodfig/cli` (WIP, I haven't published the initial version yet)

✅ Keep config for projects generated from a template up to date  
✅ Typechecking, auto-complete, automated refactoring, and in-IDE documentation for all project configuration  
✅ Bits of config are shared as composable npm packages  

## What does it do?

ZodFig scans the current working directory and all child directories for any `zodfig.ts` file. For each file it finds, it runs the default async function exported from that file if present. The function is expected to return a `ZodFig<T>` instance where `T` is a ZodObject which maps from relative filepath string to config for that file, and the returned schema is used by your IDE and the `zodfig` CLI to validate that the config actually mateches the type `T`. 

```
Usage: zodfig [options] [command]

Arguments:
  command        command to run when zodfig has finished generating config. Ex: `pnpm zodfig -w "pnpm start"`

Options:
  -v, --verbose  print resulting zodfig before writing
  -w, --watch    re-run zodfig on change to zodfig.ts file
  -h, --help     display help for command
```

### Example:

```typescript
// zodfig.ts
import { z, ZodFig } from '@zodfig/core';

const PackageJson = z.object({
  name: z.optional(z.string()),
  engines: z.optional(z.record(z.string()))
  dependencies: z.optional(z.record(z.string())),
  devDependencies: z.optional(z.record(z.string()))
}).strict();

const TSConfig = z.object({
  compilerOptions: z.object({
    lib: z.optional(z.array(z.string())),
    types: z.optional(z.array(z.string()))
  }).strict()
}).strict();

const Repo = z.object({
  'tsconfig.json': z.optional(TSConfig),
  'package.json': z.optional(PackageJson)
});

const tsDefaults = new ZodFig(
  Repo,
  {
    'tsconfig.json': {
      compilerOptions: {
        lib: ['esnext']
      }
    },
    'package.json': {
      devDependencies: {
        typescript: "^5.0"
      }
    }
  }
);

const nodeProject = new ZodFig(
  Repo, 
  {
    'tsconfig.json': {
      compilerOptions: {
        types: ['node']
      }
    },
    'package.json': {
      engines: {
        node: '>= 20'
      },
      devDependencies: {
        '@types/node': '^20.0'
      }
    }
  }
);

export default async function(name = 'node-ts-template') {
  return tsDefaults.merge(nodeProject).override({
    'package.json': {
      name
    }
  });
}
```

Running `zodfig` would generate the following files:

```jsonc
// package.json
{
  "name": "node-ts-template",
  "engines": {
    "node": ">= 20"
  },
  "devDependencies": {
    "typescript": "^5.0",
    "@types/node": "^20.0"
  }
}
```

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "lib": ["esnext"],
    "types": ["node"]
  }
}
```

What we see above is the two files were created by merging together some JSONs which configured for different use-cases (first was a generic typescript project setup, second was a setup for a Node.js typescript project). Notice that a 'setup' can contain config for multiple files.

## Why do I need this?

Let's say you're starting a new web project so you `pnpm create next-app`. 

You see a `pacakge.json` like 

```
{
  "dependencies": {
    "@types/node": "20.3.1",
    "@types/react": "18.2.12",
    "@types/react-dom": "18.2.5",
    "autoprefixer": "10.4.14",
    "eslint": "8.43.0",
    "eslint-config-next": "13.4.6",
    "next": "13.4.6",
    "postcss": "8.4.24",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "tailwindcss": "3.3.2",
    "typescript": "5.1.3"
  }
}
```

and you see a `tailwind.config.js` like this

```javascript
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
```

Now imagine your project also has a relay config, a custom webpack config, babel config, tsconfig, turborepo config, vercel config, renovate config, react native Expo config (eas.json) and on and on and on. Oh! And actually you want to use some portions of this same config across 20 projects in different repos and keep the config for all of these up to date.

Enter ZodFig. By having certain pieces of your config managed as libraries, you can simply bump the library version to get access to the latest recommended config.
And because all the config is type-safe, your IDE and the zodfig CLI will show you if any of your overrides have since become invalid post-update.

Extending config by library sort of works today with the extends functionality of several tools, like eslint or tsconfig or renovate, but unfortunately many of these projects don't have extends functionality (ie relay) or have limited extensibility (ie tsconfg allows you to extend `compilerOptions` but not other fields on the root level of the JSON), and all of these projects implement the config extension in their own way. ZodFig suddenly makes all configuration files extensible by any number of template bases (not just one), and the extension protocol is universal, so you could easily ship a ZodFig library which sets up configuration for several tools at the same time (that's why I created this).

In the future, the goal here is that most major open source configurable projects will have some official companion zodfig library, so we all have a clean and automated way of keeping our project configuration up to date, with our repo only containing the overrides it's actually concerned with, and all `create-*` npm packages will come with a zodfig.ts to keep the project up-to-date long after the project was generated. Here's an example of what I'm going for.

```typescript
// zodfig.ts
import { next, tailwind, typescript } from  'next/zodfig';
import { turbo } from 'turbo/zodfig';
import { relay } from 'relay-compiler/zodfig';
import { merge } from '@zodfig/core';
import { composeSupergraph } from './utils/compose-supergraph';

export default async function() {
  const { schemaPath } = await composeSupergraph();
  return next.merge(tailwind).merge(typescript).merge(turbo).merge(relay).override({
    'relay.config.json': {
      schema: schemaPath
    }
  });
}
```

Which would generate the following files:

- package.json
- tailwind.json (which is referenced by tailwind.config.js)
- tsconfig.json
- relay.config.json
- turbo.json
- vercel.json

all with the values you would expect.

## Food for thought

Some ideas of what could be built with the ZodFig primitives:

- because the export is an async function, you can do all sorts of network calls to gather data before returning a json to be written out. One example of a use-case for this is an evergreen plugin which would always output the most up to date version of your package.json dependencies.
- since this can write out any json or yaml file, it could be used as a synthesizer for infrastructure like terraform JSON, Kubernetes manifests, ArgoCD application sets. It'd be nice for fullstack project templates in the future to include deployment config which remains up-to-date.
- in a typescript monorepo, you could use the async function to calculate all interdependencies between workspaces then use this to generate project references tsconfig which matches the current state of the monorepo