import chalk from 'chalk';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Plugin } from '../types';
import { info, error, trackTime } from '../utils/utils';

export interface TypescriptDeclarationsPluginOptions {
  additionalArgs?: string[];
}

export function typescriptDeclarationsPlugin(
  options: TypescriptDeclarationsPluginOptions
): Plugin {
  let hasTsConfig: boolean | undefined;

  return async context => {
    if (typeof hasTsConfig === 'undefined') {
      hasTsConfig = fs.existsSync(path.join(context.cwd, 'tsconfig.json'));
    }

    if (!hasTsConfig) {
      return;
    }

    const time = trackTime();
    info('Generating typescript declaration files...');

    await new Promise<void>((resolve, reject) => {
      spawn(
        'tsc',
        [
          '--outDir',
          context.config.output,
          '--emitDeclarationOnly',
          ...(['dev', 'link'].includes(context.command)
            ? ['--watch', '--incremental']
            : []),
          ...(options?.additionalArgs ?? []),
        ].filter(Boolean) as string[],
        {
          stdio: 'overlapped',
          cwd: context.cwd,
        }
      )
        .on('close', () => {
          info(
            `Typescript declaration generated in ${chalk.gray(`${time()}`)}`
          );
          resolve();
        })
        .on('error', err => {
          error('Error generating declaration files.');
          reject(err);
        });
    });
  };
}
