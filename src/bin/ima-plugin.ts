#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { program } from 'commander';
import { createProcessingPipeline, parseConfig } from '../utils/process';
import globby from 'globby';
import { success, info, trackTime, update } from '../utils/logger';
import chalk from 'chalk';
import chokidar from 'chokidar';
import { BuildConfig } from '../types';
import { linkPlugin } from '../plugins/linkPlugin';

const dev = async (config: BuildConfig) => {
  const time = trackTime();
  const cwd = process.cwd();

  const inputDir = path.resolve(cwd, config.input);
  const outputDir = path.resolve(cwd, config.output);

  info(`Watching compilation in ${chalk.magenta(cwd)} directory...`);

  // Cleanup
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }

  chokidar
    .watch([path.join(inputDir, './**/*')], {
      cwd,
      ignoreInitial: false,
      ignored: config.exclude,
    })
    .on('all', async (eventName, filePath) => {
      const processingPipeline = createProcessingPipeline({
        inputDir,
        config,
        cwd,
        outputDir,
      });

      if (['add', 'change'].includes(eventName)) {
        update(`Processing ${chalk.magenta(filePath)} file...`);
        const time = trackTime();
        await processingPipeline(filePath);
        success(`Finished in ${chalk.gray(time())}`);
      }
    });

  success(`Finished compilation in ${chalk.gray(time())}`);
};

program.name('ima-plugin').description('CLI helper to build ima plugins');

program
  .command('build')
  .description('Build ima plugin at given directory')
  .action(async () => {
    const time = trackTime();
    const cwd = process.cwd();
    const config = await parseConfig(cwd);

    const inputDir = path.resolve(cwd, config.input);
    const outputDir = path.resolve(cwd, config.output);

    info(`Starting compilation in ${chalk.magenta(cwd)} directory...`);

    // Cleanup
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true });
    }

    const files = await globby(path.join(inputDir, './**/*'), {
      ignore: config.exclude,
    });

    files.forEach(
      createProcessingPipeline({
        inputDir,
        config,
        cwd,
        outputDir,
      })
    );

    success(`Finished compilation in ${chalk.gray(time())}`);
  });

program.command('dev').action(async () => {
  const cwd = process.cwd();
  const config = await parseConfig(cwd);
  dev(config);
});

program
  .command('link')
  .argument('<path>', 'path to app directory for linking')
  .action(async pkgPath => {
    const cwd = process.cwd();
    const config = await parseConfig(cwd);

    // INJECT link plugin
    if (!Array.isArray(config.plugins)) {
      config.plugins = [];
    }

    config.plugins.push(
      linkPlugin({
        output: path.resolve(pkgPath),
      })
    );

    dev(config);
  });

program.parse();
