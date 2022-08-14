import fs from 'fs';
import chalk from 'chalk';
import { info } from 'console';
import globby from 'globby';
import path from 'path';
import chokidar from 'chokidar';
import { success, trackTime, update } from './logger';
import { createProcessingPipeline, parseConfig } from './process';
import { linkPlugin } from '../plugins/linkPlugin';

/**
 * Does some pre-processing which is needed for all commands.
 * Returns object with initialized context properties.
 */
export async function initCommand() {
  const cwd = process.cwd();
  const config = await parseConfig(cwd);

  return {
    cwd,
    config,
    inputDir: path.resolve(cwd, config.input),
    outputDir: path.resolve(cwd, config.output),
  };
}

/**
 * Build command function handler.
 */
export async function build() {
  const time = trackTime();
  const { config, cwd, inputDir, outputDir } = await initCommand();

  info(`Starting compilation in ${chalk.magenta(cwd)} directory...`);

  // Cleanup
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }

  // Get file paths at input directory
  const files = await globby(path.join(inputDir, './**/*'), {
    ignore: config.exclude,
  });

  // Process each file with loaded pipeline
  files.forEach(
    createProcessingPipeline({
      inputDir,
      config,
      cwd,
      outputDir,
    })
  );

  success(`Finished compilation in ${chalk.gray(time())}`);
}

/**
 * Dev/link command function handler factory.
 */
export function watchFactory(command: 'dev' | 'link') {
  return async (...args: any[]) => {
    const { config, cwd, inputDir, outputDir } = await initCommand();

    const time = trackTime();
    info(`Watching compilation in ${chalk.magenta(cwd)} directory...`);

    // Cleanup
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true });
    }

    // Inject link plugin
    if (command === 'link') {
      if (!Array.isArray(config.plugins)) {
        config.plugins = [];
      }

      config.plugins.push(
        linkPlugin({
          output: path.resolve(args[0]),
        })
      );
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
}
