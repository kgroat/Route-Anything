import { Node, SourceFile, Type } from 'ts-morph'
import { OpenAPIV3_1 } from 'openapi-types'
import { getJsdocFromProperties, JSDocsByProperty } from './jsdoc.js'
import { uniqueElementsBy } from './arrayHelpers.js'

export function findAnyReferences(
  schema: unknown,
  pathSoFar: string,
  found: string[] = [],
): string[] {
  if (!schema) {
    return found
  }

  if (schema === anyReference) {
    return [...found, pathSoFar]
  }

  if (typeof schema !== 'object') {
    return found
  }

  if (Array.isArray(schema)) {
    return schema.flatMap((s, i) =>
      findAnyReferences(s, `${pathSoFar}[${i}]`, found),
    )
  }

  if ('$ref' in schema) {
    if (schema.$ref === anyReference.$ref) {
      return [...found, pathSoFar]
    } else {
      return found
    }
  }

  return Object.entries(schema).flatMap(([p, s], i) => {
    const propertyRequiresQuotes = !p.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)
    const propertyReference = propertyRequiresQuotes ? `["${p}"]` : `.${p}`

    return findAnyReferences(s, `${pathSoFar}${propertyReference}`, found)
  })
}

export const anyReference: OpenAPIV3_1.ReferenceObject = {
  $ref: '#/components/schemas/any',
}

export const anySchema: OpenAPIV3_1.SchemaObject = {
  oneOf: [
    { type: 'null' },
    { type: 'boolean' },
    { type: 'number' },
    { type: 'string' },
    { type: 'array', items: { $ref: '#/components/schemas/any' } },
    {
      type: 'object',
      additionalProperties: true,
    },
  ],
}

export function schemasAreSimilar(
  schema1: OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject,
  schema2: OpenAPIV3_1.SchemaObject | OpenAPIV3_1.ReferenceObject,
): boolean {
  if (
    ('$ref' in schema1 && !('$ref' in schema2)) ||
    (!('$ref' in schema1) && '$ref' in schema2)
  ) {
    return false
  }

  if ('$ref' in schema1 || '$ref' in schema2) {
    return (
      (schema1 as OpenAPIV3_1.ReferenceObject).$ref ===
      (schema2 as OpenAPIV3_1.ReferenceObject).$ref
    )
  }

  if (
    schema1 === schema2 ||
    JSON.stringify(schema1) === JSON.stringify(schema2)
  ) {
    return true
  }

  if (schema1.type !== schema2.type) {
    return false
  }

  if (schema1.const !== schema2.const) {
    return false
  }

  if ((schema1.oneOf && !schema2.oneOf) || (!schema1.oneOf && schema2.oneOf)) {
    return false
  }

  if (schema1.oneOf && schema2.oneOf) {
    const union1 = schema1.oneOf
    const union2 = schema2.oneOf

    return (
      union1.length === union2.length &&
      union1.every((t1) => union2.some((t2) => schemasAreSimilar(t1, t2))) &&
      union2.every((t2) => union1.some((t1) => schemasAreSimilar(t2, t1)))
    )
  }

  if ((schema1.allOf && !schema2.allOf) || (!schema1.allOf && schema2.allOf)) {
    return false
  }

  if (schema1.allOf && schema2.allOf) {
    const int1 = schema1.allOf
    const int2 = schema2.allOf

    return (
      int1.length === int2.length &&
      int1.every((t1) => int2.some((t2) => schemasAreSimilar(t1, t2))) &&
      int2.every((t2) => int1.some((t1) => schemasAreSimilar(t2, t1)))
    )
  }

  if (schema1.type === 'array' && schema2.type === 'array') {
    return schemasAreSimilar(schema1.items!, schema2.items!)
  }

  if (schema1.type === 'object' && schema2.type === 'object') {
    const props1 = schema1.properties!
    const props2 = schema2.properties!
    const keys1 = Object.keys(props1)
    const keys2 = Object.keys(props2)

    const required1 = schema1.required ?? []
    const required2 = schema2.required ?? []

    return (
      keys1.length === keys2.length &&
      keys1.every((k1) => {
        if (!keys2.includes(k1)) {
          return false
        }

        return schemasAreSimilar(props1[k1], props2[k1])
      }) &&
      required1.length === required2.length &&
      required1.every((r1) => required2.includes(r1))
    )
  }

  return false
}

export type ExtendedSchemaObject = OpenAPIV3_1.SchemaObject & {
  jsDocs?: JSDocsByProperty
}

export function cleanExtendedSchema<
  TSchema extends OpenAPIV3_1.SchemaObject | null | undefined,
>(
  schema: TSchema,
): TSchema extends OpenAPIV3_1.SchemaObject
  ? OpenAPIV3_1.SchemaObject
  : typeof schema {
  if (!schema) {
    return schema as any
  }

  const copy: ExtendedSchemaObject = { ...schema }
  delete copy.jsDocs

  if (copy.properties) {
    for (const propName in copy.properties) {
      copy.properties[propName] = cleanExtendedSchema(copy.properties[propName])
    }
  }

  return copy as any
}

export function tsTypeToOpenApiSchema(
  type: Type,
  statements: Node[],
  tempFile: SourceFile,
): ExtendedSchemaObject | null {
  if (type.getSymbol()?.getName() === 'Promise') {
    const resolvedType = type.getTypeArguments()[0]
    return tsTypeToOpenApiSchema(resolvedType, statements, tempFile)
  }

  if (type.isUnion()) {
    const unionTypes = type.getUnionTypes()
    const schemas = uniqueElementsBy(
      unionTypes
        .map((t) => tsTypeToOpenApiSchema(t, statements, tempFile))
        .filter((s) => !!s)
        .flatMap((s) => {
          if (s.oneOf) {
            return s.oneOf
          } else {
            return s
          }
        }),
      schemasAreSimilar,
    )

    return { oneOf: schemas }
  }

  if (type.isIntersection()) {
    const intersectionTypes = type.getIntersectionTypes()
    const schemas = intersectionTypes
      .map((t) => tsTypeToOpenApiSchema(t, statements, tempFile))
      .filter((s) => !!s)

    return { allOf: schemas }
  }

  if (type.isBooleanLiteral()) {
    return { type: 'boolean', const: type.getLiteralValue() }
  }
  if (type.isBoolean()) {
    return { type: 'boolean' }
  }

  if (type.isNumberLiteral()) {
    return { type: 'number', const: type.getLiteralValue() }
  }
  if (type.isNumber()) {
    return { type: 'number' }
  }

  if (type.isStringLiteral()) {
    return { type: 'string', const: type.getLiteralValue() }
  }
  if (type.isString()) {
    return { type: 'string' }
  }

  if (type.isArray()) {
    const elementType = type.getArrayElementTypeOrThrow()
    const elementSchema = tsTypeToOpenApiSchema(
      elementType,
      statements,
      tempFile,
    )

    if (elementSchema) {
      return {
        type: 'array',
        items: elementSchema,
      }
    }
  }

  if (type.isObject()) {
    if (statements.length === 0) {
      const propertySchemas: Record<string, OpenAPIV3_1.SchemaObject> = {}
      const requiredProperties: string[] = []
      type.getProperties().forEach((prop) => {
        const statementType = prop.getDeclaredType()

        const propSchema = tsTypeToOpenApiSchema(statementType, [], tempFile)
        if (!propSchema) {
          return
        }

        propertySchemas[prop.getName()] = propSchema

        if (!statementType.isNullable()) {
          requiredProperties.push(prop.getName())
        }
      })

      return {
        type: 'object' as const,
        properties: propertySchemas,
        required: requiredProperties,
      }
    }

    const union = statements.map((st) => {
      const jsDocs = getJsdocFromProperties(st, tempFile)
      const propertySchemas: Record<string, OpenAPIV3_1.SchemaObject> = {}
      const requiredProperties: string[] = []
      type.getProperties().forEach((prop) => {
        const statementType = prop.getTypeAtLocation(st)

        const propSchema = tsTypeToOpenApiSchema(statementType, [st], tempFile)
        if (!propSchema) {
          return
        }

        if (jsDocs && jsDocs[prop.getName()]) {
          const doc = jsDocs[prop.getName()][0]
          const tags = doc.getTags()

          propSchema.description = doc.getDescription().trim() || undefined

          if (tags.some((t) => t.getTagName() === 'deprecated')) {
            propSchema.deprecated = true
          }

          const exampleJson = tags
            .find((t) => t.getTagName() === 'example')
            ?.getCommentText()

          if (exampleJson) {
            propSchema.example = JSON.parse(exampleJson)
          }
        }

        propertySchemas[prop.getName()] = propSchema

        if (!statementType.isNullable()) {
          requiredProperties.push(prop.getName())
        }
      })

      return {
        type: 'object' as const,
        properties: propertySchemas,
        required: requiredProperties,
        jsDocs: jsDocs ?? undefined,
      }
    })

    const uniqueUnion = uniqueElementsBy(union, schemasAreSimilar)

    if (uniqueUnion.length === 1) {
      return union[0]
    } else {
      return {
        oneOf: union,
      }
    }
  }

  if (type.isAny()) {
    return anyReference
  }

  console.warn('Could not convert type to OpenAPI schema', type.getText())

  return null
}
