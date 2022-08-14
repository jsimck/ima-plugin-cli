import fs from 'fs';
import path from 'path';

import { BuildConfig, PipeContext, Source } from './types';

const CONFIG_FILENAME = 'ima.build.js';

export async function parseConfig(cwd: string): Promise<BuildConfig> {
  const configPath = path.resolve(cwd, CONFIG_FILENAME);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Unable to load the ${configPath} config file.`);
  }

  return (await import(configPath)) as BuildConfig;
}

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
      source = await transform(source, context);
      continue;
    }

    // Handle transformer options
    if (options.test && !options.test.test(filePath)) {
      continue;
    }

    source = await transform(source, context);
  }

  return source;
}

export function createPipe(params: {
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

    // Process transforms
    const source = await processTransformers(context);

    // Output
    const outputFilePath = path.resolve(context.outputDir, contextFilePath);
    const outputFileDir = path.dirname(outputFilePath);

    if (!fs.existsSync(outputFileDir)) {
      await fs.promises.mkdir(outputFileDir, { recursive: true });
    }

    await Promise.all([
      fs.promises.writeFile(outputFilePath, source.code),
      source.map && fs.promises.writeFile(`${outputFilePath}.map`, source.map),
    ]);
  };
}
