#!/usr/bin/env node

import { program } from 'commander';
import { build, watchFactory } from '../utils/commands';

program.name('ima-plugin').description('CLI helper to build ima plugins');

program
  .command('build')
  .description('Build ima plugin at current directory')
  .action(build);

program
  .command('dev')
  .description('Watch ima plugin at current directory')
  .action(watchFactory('dev'));

program
  .command('link')
  .description(
    'Link ima plugin at current directory to ima application at given path'
  )
  .argument('<path>', 'path to app directory for linking')
  .action(watchFactory('link'));

program.parse();
