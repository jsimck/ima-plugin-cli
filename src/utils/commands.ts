import fs from 'fs';
import chalk from 'chalk';
import { info } from 'console';
import globby from 'globby';
import path from 'path';
import chokidar from 'chokidar';
import { success, trackTime, update } from './logger';
import { createProcessingPipeline, parseConfigFile } from './process';
import { linkPlugin } from '../plugins/linkPlugin';

/**
 * Build command function handler.
 */
export async function build() {
  const time = trackTime();
  const cwd = process.cwd();
  const configurations = await parseConfigFile(cwd);

  info(`Starting compilation in ${chalk.magenta(cwd)} directory...`);

  // Spawn compilation for each config
  await Promise.all(
    configurations.map(async config => {
      const inputDir = path.resolve(cwd, config.input);
      const outputDir = path.resolve(cwd, config.output);

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
    })
  );

  success(`Finished compilation in ${chalk.gray(time())}`);
}

/**
 * Dev/link command function handler
 */
export function watchFactory(command: 'dev' | 'link') {
  return async (...args: any[]) => {
    const cwd = process.cwd();
    const configurations = await parseConfigFile(cwd);

    const time = trackTime();
    info(`Watching compilation in ${chalk.magenta(cwd)} directory...`);

    // Spawn watch for each config
    await Promise.all(
      configurations.map(async config => {
        const inputDir = path.resolve(cwd, config.input);
        const outputDir = path.resolve(cwd, config.output);

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
            const process = createProcessingPipeline({
              inputDir,
              config,
              cwd,
              outputDir,
            });

            // Process new and changed files with pipeline
            if (['add', 'change'].includes(eventName)) {
              update(`Processing ${chalk.magenta(filePath)} file...`);
              const time = trackTime();
              await process(filePath);
              success(`Finished in ${chalk.gray(time())}`);
            }

            // Sync deleted dirs and files
            if (['unlink', 'unlinkDir'].includes(eventName)) {
              await fs.promises.rm(filePath, { recursive: true });
            }

            // Sync newly added directories
            if (eventName === 'addDir') {
              await fs.promises.mkdir(filePath, { recursive: true });
            }
          });
      })
    );

    success(`Finished compilation in ${chalk.gray(time())}`);
  };
}
