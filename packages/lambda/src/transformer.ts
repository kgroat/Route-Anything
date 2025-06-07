import { OpenAPIV3_1 } from 'openapi-types'
import {
  OpenapiTransformer,
  transformerSymbol,
} from '@any-router/openapi/transformer'
import {
  cleanExtendedSchema,
  schemasAreSimilar,
} from '@any-router/openapi/jsonSchema'

import { uniqueElementsBy } from './helpers/arrayHelpers.js'

function getResponsesFromSchema(
  schema: OpenAPIV3_1.SchemaObject | null | undefined,
) {
  const responses: OpenAPIV3_1.ResponsesObject = {}
  if (!schema) {
    return responses
  }

  if (schema.oneOf) {
    const unionResponses = schema.oneOf.map(getResponsesFromSchema)
    unionResponses.forEach((unionResponse) => {
      Object.keys(unionResponse).forEach((code) => {
        const currResponse = unionResponse[code] as OpenAPIV3_1.ResponseObject
        if (!responses[code]) {
          responses[code] = currResponse
        } else {
          const currSchema = cleanExtendedSchema(
            currResponse.content?.['application/json']?.schema,
          )

          if (currSchema) {
            const existingResponse = responses[
              code
            ] as OpenAPIV3_1.ResponseObject
            if (!existingResponse.content) {
              existingResponse.content = {}
            }

            const existingSchema = cleanExtendedSchema(
              existingResponse.content['application/json']?.schema,
            )

            const union = uniqueElementsBy(
              [currSchema, existingSchema]
                .filter((s) => !!s)
                .flatMap((s) => {
                  if ('oneOf' in s && Array.isArray(s.oneOf)) {
                    return s.oneOf
                  } else {
                    return s
                  }
                }),
              schemasAreSimilar,
            )

            existingResponse.content['application/json'].schema =
              union.length > 1 ? { oneOf: union } : union[0]
          }
        }
      })
    })
  }

  if (schema.type === 'object') {
    let code = 200
    const codeProp = schema?.properties?.statusCode

    if (
      codeProp &&
      'type' in codeProp &&
      codeProp.type === 'number' &&
      'const' in codeProp &&
      typeof codeProp.const === 'number'
    ) {
      code = codeProp.const
    }

    let body: OpenAPIV3_1.SchemaObject = { type: 'null' }
    let bodyProp = schema?.properties?.body
    if (bodyProp) {
      body = bodyProp
    }

    responses[code] = {
      description: `Status ${code.toString(10)}`,
      content: {
        'application/json': {
          schema: cleanExtendedSchema(body),
        },
      },
    }
  }

  return responses
}

const transformer: OpenapiTransformer = {
  [transformerSymbol]: true,
  getResponses: ({ returnSchema }) => getResponsesFromSchema(returnSchema),
}

export default transformer
