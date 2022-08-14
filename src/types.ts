export type TransformerFactory<T> = (options: T) => Promise<Transformer>;
export type Transformer = (
  source: Source,
  context: PipeContext
) => Source | Promise<Source>;
export type TransformerOptions = { test: RegExp };

export interface BuildConfig {
  input: string;
  output: string;
  transforms?: Array<Transformer | [Transformer, TransformerOptions]>;
  exclude?: string[];
  // plugins?: []
}

export interface PipeContext {
  cwd: string;
  fileName: string;
  filePath: string;
  contextFilePath: string;
  config: BuildConfig;
  inputDir: string;
  outputDir: string;
}

export interface Source {
  code: string;
  map?: string;
}
