import { Options, transform } from '@swc/core';
import { Transformer } from '../types';

const TSX_RE = /\.tsx?/;

export type SWCTransformerOptions = Options;

export function swcTransformer(options: SWCTransformerOptions): Transformer {
  return async ({ source, context }) => {
    try {
      const { code, map } = await transform(source.code, options);

      const newFilename = source.fileName.replace(TSX_RE, '.js');
      const withSourceMapsComment =
        code + `\n//# sourceMappingURL=${newFilename}.map`;

      return {
        fileName: newFilename,
        code: withSourceMapsComment,
        map,
      };
    } catch (error) {
      if (context.command === 'build') {
        throw error;
      }

      console.log(error);
    }

    return source;
  };
}
