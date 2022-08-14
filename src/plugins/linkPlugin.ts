import fs from 'fs';
import path from 'path';
import { Plugin } from '../types';
import { emitSource } from '../utils/process';

export interface LinkPluginOptions {
  output: string;
}

export function linkPlugin({ output }: LinkPluginOptions): Plugin {
  let pkgName: string;
  let outputBasePath: string;

  return async ({ context, source }) => {
    if (!pkgName) {
      pkgName = JSON.parse(
        await (
          await fs.promises.readFile(path.join(context.cwd, 'package.json'))
        ).toString()
      ).name;
    }

    if (!outputBasePath) {
      outputBasePath = path.resolve(
        output,
        'node_modules',
        pkgName,
        context.config.output
      );
    }

    // Emit source to new location
    await emitSource(
      source,
      context.filePath,
      path.join(outputBasePath, context.contextFilePath)
    );
  };
}
