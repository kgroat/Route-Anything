import { OpenAPIV3_1 } from 'openapi-types'
import { RouteHandler } from './getRouters.js'
import { cleanExtendedSchema } from './jsonSchema.js'

export const transformerSymbol = Symbol('transformer')

export type OpenapiTransformer = {
  [transformerSymbol]: true
  getResponses: (handler: RouteHandler) => OpenAPIV3_1.ResponsesObject
}

export const defaultTransformer: OpenapiTransformer = {
  [transformerSymbol]: true,
  getResponses: ({ returnSchema }) => {
    const responses: OpenAPIV3_1.ResponsesObject = {}

    if (returnSchema) {
      responses['200'] = {
        description: 'OK',
        content: {
          'application/json': {
            schema: cleanExtendedSchema(returnSchema),
          },
        },
      }
    }

    return responses
  },
}
