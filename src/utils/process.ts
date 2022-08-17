import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

import { BuildConfig, Command, PipeContext, Source } from '../types';
import { info, parsePkgJSON } from './utils';

const CONFIG_FILENAME = 'ima-plugin.config.js';

/**
 * Parses ima.build.js file, initializing the build pipeline.
 */
export async function parseConfigFile(cwd: string): Promise<BuildConfig[]> {
  const configPath = path.resolve(cwd, CONFIG_FILENAME);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Unable to load the ${configPath} config file.`);
  }

  // We handle each config as array for easier handling
  let loadedConfig = (await import(configPath)).default;
  loadedConfig = Array.isArray(loadedConfig) ? loadedConfig : [loadedConfig];

  return loadedConfig.map((config: BuildConfig) => ({
    plugins: [],
    exclude: ['**/__tests__/**', '**/node_modules/**', '**/dist/**'],
    ...config,
  })) as BuildConfig[];
}

/**
 * Helper function to emit source. If it's not undefined, the source is
 * written to the output path. If it is undefined, the original file
 * is simply copied.
 */
export async function emitSource(
  source: Source | undefined,
  context: PipeContext,
  outputDir: string
) {
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  // Emit source
  if (source) {
    const outputPath = path.join(outputDir, source?.fileName);

    return Promise.all([
      fs.promises.writeFile(outputPath, source.code),
      source.map && fs.promises.writeFile(`${outputPath}.map`, source.map),
    ]);
  } else {
    // Just copy files without source
    await fs.promises.copyFile(
      context.filePath,
      path.join(outputDir, context.fileName)
    );
  }
}

/**
 * Load source file contents and runs transformers on it, provided
 * in the ima.build.js config.
 */
export async function processTransformers(
  context: PipeContext
): Promise<Source> {
  const { config, filePath, fileName } = context;
  let source: Source = {
    fileName,
    code: await fs.promises.readFile(context.filePath, 'utf8'),
  };

  if (!Array.isArray(config.transforms)) {
    return source;
  }

  for (const transformer of config.transforms) {
    const [transform, options] = Array.isArray(transformer)
      ? transformer
      : [transformer];

    if (!options) {
      source = await transform({ source, context });
      continue;
    }

    // Handle transformer options
    if (options.test && !options.test.test(filePath)) {
      continue;
    }

    source = await transform({ source, context });
  }

  return source;
}

/**
 * Creates processing pipeline used in build, link and dev scripts.
 * It is constructed to run on each file separately.
 */
export async function createProcessingPipeline(params: {
  command: Command;
  inputDir: string;
  outputDir: string;
  cwd: string;
  config: BuildConfig;
  linkedPath?: string;
}) {
  const pkgName = (await parsePkgJSON(params.cwd)).name;
  const linkedBasePath = params.linkedPath
    ? path.resolve(
        params.linkedPath,
        'node_modules',
        pkgName,
        params.config.output
      )
    : null;

  return async (filePath: string) => {
    const fileName = path.basename(filePath);
    const contextDir = path.dirname(path.relative(params.inputDir, filePath));

    const context: PipeContext = {
      ...params,
      contextDir,
      fileName,
      filePath,
    };

    let source: Source | undefined;

    // Process transforms
    if (!params.config?.skipTransform?.some(testRe => testRe.test(filePath))) {
      source = await processTransformers(context);
    }

    // Write new source
    await emitSource(
      source,
      context,
      path.resolve(params.outputDir, contextDir)
    );

    // Emit to linked location for link command
    if (linkedBasePath && params.command === 'link') {
      const outputDir = path.join(linkedBasePath, context.contextDir);

      // Emit source to new location
      await emitSource(source, context, outputDir);

      info(
        `Linked ${chalk.magenta(
          path.join(context.contextDir, context.fileName)
        )} ${chalk.gray('→')} ${chalk.magenta(outputDir)}`
      );

      // Write new source
      await emitSource(
        source,
        context,
        path.resolve(params.outputDir, contextDir)
      );
    }
  };
}
