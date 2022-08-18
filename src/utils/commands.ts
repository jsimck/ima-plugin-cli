import fs from 'fs';
import chalk from 'chalk';
import globby from 'globby';
import path from 'path';
import chokidar from 'chokidar';
import { info, parsePkgJSON, success, trackTime } from './utils';
import {
  createProcessingPipeline,
  parseConfigFile,
  runPlugins,
} from './process';
import { Command } from '../types';

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
        await fs.promises.rm(outputDir, { recursive: true });
      }

      // Get file paths at input directory
      const files = await globby(path.join(inputDir, './**/*'), {
        ignore: config.exclude,
        cwd,
      });

      const context = {
        command: 'build' as Command,
        inputDir,
        config,
        cwd,
        outputDir,
      };

      // Init processing pipeline
      const process = await createProcessingPipeline(context);

      // Process each file with loaded pipeline
      files.forEach(process);

      // Run plugins
      await runPlugins(context);
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

      const context = {
        command: command as Command,
        inputDir,
        config,
        cwd,
        outputDir,
      };

      // Init processing pipeline
      const process = await createProcessingPipeline(context);

      // Dev instance
      chokidar
        .watch([path.join(inputDir, './**/*')], {
          ignoreInitial: false,
          ignored: config.exclude,
        })
        .on('all', async (eventName, filePath) => {
          const relativePath = path.relative(inputDir, filePath);

          // Process new and changed files with pipeline
          if (['add', 'change'].includes(eventName)) {
            const time = trackTime();
            await process(filePath);
            info(
              `Processed ${chalk.magenta(relativePath)} in ${chalk.gray(
                time()
              )}`
            );
          }

          // Sync deleted dirs and files
          if (['unlink', 'unlinkDir'].includes(eventName)) {
            info(`Removing ${relativePath}`);
            await fs.promises.rm(filePath, { recursive: true });
          }

          // Sync newly added directories
          if (eventName === 'addDir') {
            info(`Creating ${relativePath}`);
            await fs.promises.mkdir(filePath, { recursive: true });
          }
        })
        .on('ready', async () => {
          // Run plugins
          await runPlugins(context);
        });

      // Link instance
      if (command === 'link' && args[0]) {
        const linkedPath = path.resolve(args[0]);
        const [pkgJson, linkedPkgJson] = await Promise.all([
          parsePkgJSON(cwd),
          parsePkgJSON(linkedPath),
        ]);

        const linkedBasePath = path.resolve(
          linkedPath,
          'node_modules',
          pkgJson.name,
          config.output
        );

        chokidar
          .watch([path.join(outputDir, './**/*')], {
            ignoreInitial: false,
            ignored: ['**/tsconfig.tsbuildinfo/**'],
          })
          .on('all', async (eventName, filePath) => {
            const contextPath = path.relative(outputDir, filePath);
            const outputPath = path.join(linkedBasePath, contextPath);

            if (['add', 'change'].includes(eventName)) {
              info(
                `Copied ${chalk.gray(pkgJson.name + ':')}${chalk.magenta(
                  contextPath
                )} ${chalk.green('→')} ${chalk.gray(
                  linkedPkgJson.name
                )}:${chalk.magenta(contextPath)}`
              );
              await fs.promises.copyFile(filePath, outputPath);
            }

            if (['unlink', 'unlinkDir'].includes(eventName)) {
              info(
                `Removing linked ${
                  chalk.gray(linkedPkgJson.name) + ':'
                }{chalk.magenta(contextPath)}`
              );
              await fs.promises.rm(outputPath, { recursive: true });
            }

            if (eventName === 'addDir') {
              info(
                `Creating ${
                  chalk.gray(linkedPkgJson.name) + ':'
                }${chalk.magenta(contextPath)}`
              );
              await fs.promises.mkdir(outputPath, { recursive: true });
            }
          });
      }
    });
  };
}
