import { Options, transform } from '@swc/core';
import { Transformer } from '../types';

const TSX_RE = /\.tsx?/;

export type SWCTransformerOptions = Options;

export function swcTransformer(options: SWCTransformerOptions): Transformer {
  return async ({ source }) => {
    const { code, map } = await transform(source.code, options);

    return {
      fileName: source.fileName.replace(TSX_RE, '.js'),
      code: code + `\n//# sourceMappingURL=${source.fileName}.map`,
      map,
    };
  };
}
