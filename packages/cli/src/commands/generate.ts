import { Command } from 'commander'
import registerOpenapiCommand from './generate/openapi.js'

export default (command: Command) => {
  command.description('Generate')

  registerOpenapiCommand(command.command('openapi'))
}
