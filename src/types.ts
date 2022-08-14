export type TransformerFactory<T> = (options: T) => Promise<Transformer>;
export type Transformer = ({
  source,
  context,
}: {
  source: Source;
  context: PipeContext;
}) => Source | Promise<Source>;
export type TransformerOptions = { test: RegExp };

export type Plugin = ({
  source,
  context,
}: {
  source?: Source;
  context: PipeContext;
}) => void | Promise<void>;

export interface BuildConfig {
  input: string;
  output: string;
  transforms?: Array<Transformer | [Transformer, TransformerOptions]>;
  exclude?: string[];
  skipTransform?: RegExp[];
  plugins?: Plugin[];
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
