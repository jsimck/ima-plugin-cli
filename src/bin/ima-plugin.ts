#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { program } from 'commander';
import { createPipe, parseConfig } from '../utils';
import globby from 'globby';

program.name('ima-plugin').description('CLI helper to build ima plugins');

program
  .command('build')
  .description('Build ima plugin at given directory')
  .action(async () => {
    const cwd = process.cwd();
    const config = await parseConfig(cwd);

    const inputDir = path.resolve(cwd, config.input);
    const outputDir = path.resolve(cwd, config.output);

    // Cleanup
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true });
    }

    const files = await globby(path.join(inputDir, './**/*'), {
      ignore: config.exclude ?? ['**/__tests__/**', '**/node_modules/**'],
    });

    files.forEach(
      createPipe({
        inputDir,
        config,
        cwd,
        outputDir,
      })
    );
  });

program.command('dev').option('-c, --clean', 'clean output directory');
program.command('link');

program.parse();
