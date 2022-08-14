import { Options, transform } from '@swc/core';
import { Transformer } from '../types';

export type SWCTransformerOptions = Options;

export function swcTransformer(options: SWCTransformerOptions): Transformer {
  return async source => {
    const { code, map } = await transform(source.code, options);

    return {
      code,
      map,
    };
  };
}
