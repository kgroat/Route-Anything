#!/usr/bin/env -S node --loader ts-node/esm

import { Command } from 'commander'

import registerGenerateCommand from './commands/generate.js'

export const program = new Command()

program.name('any-router')

registerGenerateCommand(program.command('generate'))

program.parse()
