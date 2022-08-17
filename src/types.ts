export type TransformerFactory<T> = (options: T) => Promise<Transformer>;
export type Transformer = ({
  source,
  context,
}: {
  source: Source;
  context: PipeContext;
}) => Source | Promise<Source>;
export type TransformerOptions = { test: RegExp };

export type Command = 'dev' | 'link' | 'build';

export interface BuildConfig {
  input: string;
  output: string;
  transforms?: Array<Transformer | [Transformer, TransformerOptions]>;
  exclude?: string[];
  skipTransform?: RegExp[];
  plugins?: Plugin[];
}

export type Plugin = (context: PluginContext) => void | Promise<void>;

export interface PluginContext {
  cwd: string;
  config: BuildConfig;
  inputDir: string;
  outputDir: string;
}

export interface PipeContext {
  cwd: string;
  fileName: string;
  filePath: string;
  contextDir: string;
  config: BuildConfig;
  inputDir: string;
  outputDir: string;
}

export interface Source {
  fileName: string;
  code: string;
  map?: string;
}
