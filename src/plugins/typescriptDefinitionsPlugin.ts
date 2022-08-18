import chalk from 'chalk';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Plugin } from '../types';
import { info, error, success, trackTime } from '../utils/utils';

const DEV_ARGS = ['--watch', '--incremental'];

export function typescriptDefinitionsPlugin(): Plugin {
  return async context => {
    if (!fs.existsSync(path.join(context.cwd, 'tsconfig.json'))) {
      info('Skipping, unable to locale tsconfig.json.');
    }

    const time = trackTime();
    info('Generating typescript declaration files...');

    await new Promise<void>((resolve, reject) => {
      spawn(
        'tsc',
        [
          '--emitDeclarationOnly',
          ...(['dev', 'link'].includes(context.command) && ['--']
            ? DEV_ARGS
            : []),
        ].filter(Boolean) as string[],
        {
          stdio: 'overlapped',
          cwd: context.cwd,
        }
      )
        .on('close', () => {
          success(
            `Typescript definitions generated in ${chalk.gray(`${time()}`)}`
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
