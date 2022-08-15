import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { Plugin } from '../types';
import { emitSource } from '../utils/process';
import { info, parsePkgJSON } from '../utils/utils';

export interface LinkPluginOptions {
  output: string;
}

export function linkPlugin({ output }: LinkPluginOptions): Plugin {
  let pkgName: string;
  let outputBasePath: string;

  return async ({ context, source }) => {
    if (!pkgName) {
      pkgName = (await parsePkgJSON(context.cwd)).name;
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
    const outputFilePath = path.join(outputBasePath, context.contextFilePath);
    await emitSource(source, context.filePath, outputFilePath);

    info(
      `Linked ${chalk.magenta(context.contextFilePath)} ${chalk.gray(
        '→'
      )} ${chalk.magenta(outputFilePath)}`
    );
  };
}
