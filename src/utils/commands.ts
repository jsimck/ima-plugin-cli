import fs from 'fs';
import chalk from 'chalk';
import globby from 'globby';
import path from 'path';
import chokidar from 'chokidar';
import { info, parsePkgJSON, success, trackTime } from './utils';
import { createProcessingPipeline, parseConfigFile } from './process';
import { linkPlugin } from '../plugins/linkPlugin';

/**
 * Build command function handler.
 */
export async function build() {
  const time = trackTime();
  const cwd = process.cwd();
  const [pkgJson, configurations] = await Promise.all([
    parsePkgJSON(cwd),
    parseConfigFile(cwd),
  ]);

  info(`Building ${chalk.bold.magenta(pkgJson.name)}`);

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

      // Init processing pipeline
      const process = createProcessingPipeline({
        inputDir,
        config,
        cwd,
        outputDir,
      });

      // Process each file with loaded pipeline
      files.forEach(process);
    })
  );

  success(`Finished in ${chalk.bold.gray(time())}`);
}

/**
 * Dev/link command function handler
 */
export function watchFactory(command: 'dev' | 'link') {
  return async (...args: any[]) => {
    const cwd = process.cwd();
    const [pkgJson, configurations] = await Promise.all([
      parsePkgJSON(cwd),
      parseConfigFile(cwd),
    ]);

    info(`Watching ${chalk.bold.magenta(pkgJson.name)}`);

    // Spawn watch for each config
    configurations.forEach(async config => {
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

      // Init processing pipeline
      const process = createProcessingPipeline({
        inputDir,
        config,
        cwd,
        outputDir,
      });

      chokidar
        .watch([path.join(inputDir, './**/*')], {
          cwd,
          ignoreInitial: false,
          ignored: config.exclude,
        })
        .on('all', async (eventName, filePath) => {
          // Process new and changed files with pipeline
          if (['add', 'change'].includes(eventName)) {
            const time = trackTime();
            await process(filePath);
            info(
              `Processed ${chalk.magenta(filePath)} in ${chalk.gray(time())}`
            );
          }

          // Sync deleted dirs and files
          if (['unlink', 'unlinkDir'].includes(eventName)) {
            info(`Removing ${filePath}`);
            await fs.promises.rm(filePath, { recursive: true });
          }

          // Sync newly added directories
          if (eventName === 'addDir') {
            info(`Creating ${filePath}`);
            await fs.promises.mkdir(filePath, { recursive: true });
          }
        });
    });
  };
}
