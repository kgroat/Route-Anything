import { Command } from 'commander'

import registerGenerateCommand from './commands/generate.js'

export const program = new Command()

program.name('ra')

registerGenerateCommand(program.command('generate'))

program.parse()
