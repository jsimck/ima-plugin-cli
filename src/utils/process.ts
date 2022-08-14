import fs from 'fs';
import path from 'path';

import { BuildConfig, PipeContext, Source } from '../types';

const CONFIG_FILENAME = 'ima.build.js';

/**
 * Parses ima.build.js file, initializing the build pipeline.
 */
export async function parseConfig(cwd: string): Promise<BuildConfig> {
  const configPath = path.resolve(cwd, CONFIG_FILENAME);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Unable to load the ${configPath} config file.`);
  }

  return {
    plugins: [],
    exclude: ['**/__tests__/**', '**/node_modules/**'],
    ...(await import(configPath)),
  };
}

/**
 * Helper function to emit source. If it's not undefined, the source is
 * written to the output path. If it is undefined, the original file
 * is simply copied.
 */
export async function emitSource(
  source: Source | undefined,
  filePath: string,
  outputPath: string
) {
  const outputDir = path.dirname(outputPath);

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  // Emit source
  if (source) {
    return Promise.all([
      fs.promises.writeFile(outputPath, source.code),
      source.map && fs.promises.writeFile(`${outputPath}.map`, source.map),
    ]);
  } else {
    // Just copy files without source
    await fs.promises.copyFile(filePath, outputPath);
  }
}

/**
 * Load source file contents and runs transformers on it, provided
 * in the ima.build.js config.
 */
export async function processTransformers(
  context: PipeContext
): Promise<Source> {
  const { config, filePath } = context;
  let source: Source = {
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
export function createProcessingPipeline(params: {
  inputDir: string;
  outputDir: string;
  cwd: string;
  config: BuildConfig;
}) {
  return async (filePath: string) => {
    const fileName = path.basename(filePath);
    const contextFilePath = path.relative(params.inputDir, filePath);

    const context: PipeContext = {
      ...params,
      contextFilePath,
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
      filePath,
      path.resolve(params.outputDir, contextFilePath)
    );

    // Run plugins
    if (Array.isArray(params.config.plugins)) {
      for (const plugin of params.config.plugins) {
        await plugin({ source, context });
      }
    }
  };
}
