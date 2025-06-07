import {
  CallExpression,
  ts,
  Identifier,
  SourceFile,
  FunctionDeclaration,
  Node,
  FunctionLikeDeclaration,
  Type,
  TypeNode,
} from 'ts-morph'
import { ExtendedSchemaObject, tsTypeToOpenApiSchema } from './jsonSchema.js'
import { getOwnReturnStatements } from './morphHelpers.js'

function getStringLiteralFromNode(node: Node) {
  if (Node.isStringLiteral(node)) {
    return node.getLiteralValue()
  }

  if (Node.isIdentifier(node)) {
    const defs = node.getDefinitionNodes()

    const varLiteral = defs[0].getLastChildByKind(ts.SyntaxKind.StringLiteral)

    if (varLiteral) {
      return varLiteral.getLiteralValue()
    }
  }

  if (Node.isCallExpression(node)) {
    const returnLiteral = node.getReturnType().getLiteralValue()

    if (returnLiteral && typeof returnLiteral === 'string') {
      return returnLiteral
    }
  }

  return null
}

function getPathDefinitionFromCall(call: CallExpression) {
  const firstArgument = call.getArguments()[0]

  const literal = getStringLiteralFromNode(firstArgument)

  if (!literal) {
    console.warn('Could not find path definition literal', call.getText())
    return null
  }

  return literal
}

type RouterBuilderExport = {
  exportName: string
  file: SourceFile
}

type RouterBuilderDefinition = {
  variableName: string
  file: SourceFile
}

const traversedExports = new Map<string, RouterBuilderExport[]>()
const traversedBuilderDefinitions = new Map<string, RouterBuilderDefinition[]>()

function traverseImportsForRouterBuilderCalls(file: SourceFile) {
  const builderExports: RouterBuilderExport[] = []
  traversedExports.set(file.getFilePath(), builderExports)

  const builderDefinitions: RouterBuilderDefinition[] = []
  traversedBuilderDefinitions.set(file.getFilePath(), builderDefinitions)

  const imports = file.getImportDeclarations()

  for (const importDeclaration of imports) {
    const importedFile = importDeclaration.getModuleSpecifierSourceFile()

    if (importedFile) {
      if (!traversedExports.has(importedFile.getFilePath())) {
        traverseImportsForRouterBuilderCalls(importedFile)
      }

      traversedExports
        .get(importedFile?.getFilePath())
        ?.forEach((exportDecl) => {
          if (exportDecl.exportName === 'default') {
            const defaultImport = importDeclaration.getDefaultImport()
            if (!defaultImport) {
              return
            }

            const importedSymbol = defaultImport.getSymbol()

            if (!importedSymbol) {
              return
            }

            builderDefinitions.push({
              variableName: importedSymbol.getName(),
              file: importedFile,
            })
          } else {
            const namedImport = importDeclaration
              .getNamedImports()
              .find((namedImport) => {
                return namedImport.getName() === exportDecl.exportName
              })

            if (!namedImport) {
              return
            }

            builderDefinitions.push({
              variableName:
                namedImport.getAliasNode()?.getText() ??
                namedImport.getNameNode().getText(),
              file: importedFile,
            })
          }
        })
    }

    if (
      importDeclaration.getModuleSpecifier().getLiteralText() ===
      '@any-router/core'
    ) {
      const routerBuilderImport = importDeclaration
        .getNamedImports()
        .find((namedImport) => namedImport.getName() === 'routerBuilder')

      if (routerBuilderImport) {
        const name =
          routerBuilderImport.getAliasNode() ??
          (routerBuilderImport.getNameNode() as Identifier)
        const calls = name
          .findReferencesAsNodes()
          .map((ref) =>
            ref.getFirstAncestorByKind(ts.SyntaxKind.CallExpression),
          )
          .filter((call) => call !== undefined)
          .filter((call) => call.getSourceFile() == file)

        calls.forEach((call) => {
          const varStatement = call.getFirstAncestorByKind(
            ts.SyntaxKind.VariableStatement,
          )

          const varName = varStatement?.getFirstDescendantByKind(
            ts.SyntaxKind.Identifier,
          )

          if (varName) {
            builderDefinitions.push({
              variableName: varName.getText(),
              file: file,
            })

            const exportKeyword = varStatement?.getFirstDescendantByKind(
              ts.SyntaxKind.ExportKeyword,
            )

            if (exportKeyword) {
              builderExports.push({
                exportName: varName.getText(),
                file: file,
              })
            }
          }

          const exportDecl = call.getFirstAncestorByKind(
            ts.SyntaxKind.ExportAssignment,
          )

          if (exportDecl) {
            const defaultKeyword = exportDecl.getFirstDescendantByKind(
              ts.SyntaxKind.DefaultKeyword,
            )

            if (defaultKeyword) {
              builderExports.push({
                exportName: 'default',
                file: file,
              })
            }
          }
        })
      }
    }
  }
}

type RouterNodeDefinition = {
  pathDefition: string
  file: SourceFile
  definition: CallExpression
}

const traversedRouters = new Map<string, Map<string, RouterNodeDefinition>>()

function traverseImportsForRouters(file: SourceFile) {
  const routers = new Map<string, RouterNodeDefinition>()
  traversedRouters.set(file.getFilePath(), routers)

  const builderFunctions = traversedBuilderDefinitions
    .get(file.getFilePath())!
    .map((def) => def.variableName)

  const imports = file.getImportDeclarations()

  for (const importDeclaration of imports) {
    const importedFile = importDeclaration.getModuleSpecifierSourceFile()

    if (importedFile) {
      if (!traversedRouters.has(importedFile.getFilePath())) {
        traverseImportsForRouters(importedFile)
      }
    }
  }

  const callExpressions = file.getDescendantsOfKind(
    ts.SyntaxKind.CallExpression,
  )

  const builderCalls = callExpressions.filter((call) => {
    const functionName = call
      .getFirstChildByKind(ts.SyntaxKind.Identifier)
      ?.getText()

    return functionName && builderFunctions.includes(functionName)
  })

  const builtRouters = builderCalls
    .map((builderCall) => {
      const propertyCalls = builderCall
        .getAncestors()
        .filter(Node.isCallExpression)
        .filter((c) =>
          c.getFirstChildByKind(ts.SyntaxKind.PropertyAccessExpression),
        )

      const buildCall = propertyCalls.find((a) => {
        const identifiers = a
          .getLastChildByKind(ts.SyntaxKind.PropertyAccessExpression)
          ?.getDescendantsOfKind(ts.SyntaxKind.Identifier)

        const propertyName = identifiers?.[identifiers.length - 1]?.getText()

        return propertyName === 'build'
      })

      if (buildCall) {
        return {
          buildCall,
          builderCall,
        }
      }
    })
    .filter((a) => !!a)

  builtRouters.forEach((call) => {
    const pathDefition = getPathDefinitionFromCall(call.builderCall)

    if (pathDefition) {
      routers.set(pathDefition, {
        pathDefition,
        file,
        definition: call.buildCall,
      })
    }
  })
}

type MethodHandler = {
  method: string
  function: FunctionDeclaration
}

function getMethodPropertyName(call: CallExpression) {
  const identifier = call
    .getLastChildByKind(ts.SyntaxKind.PropertyAccessExpression)
    ?.getFirstChildByKind(ts.SyntaxKind.Identifier)

  if (!identifier) {
    return null
  }

  return identifier.getText()
}

function mapMethodCallToMethod(propertyName: string, call: CallExpression) {
  switch (propertyName) {
    case 'get':
      return 'GET'
    case 'post':
      return 'POST'
    case 'put':
      return 'PUT'
    case 'delete':
      return 'DELETE'
    case 'patch':
      return 'PATCH'
    case 'http':
      return getStringLiteralFromNode(call.getArguments()[0])
    default:
      return null
  }
}

function filterNodeToFunctionLike(node: Node) {
  if (Node.isArrowFunction(node)) {
    return node
  }

  if (Node.isFunctionExpression(node)) {
    return node
  }

  return null
}

function getFunctionArgForMethod(propertyName: string, call: CallExpression) {
  if (propertyName === 'http') {
    return call.getArguments()[1]
  }

  return call.getArguments()[0]
}

function mapMethodCallToFunctionDefinition(
  propertyName: string,
  call: CallExpression,
) {
  const arg = getFunctionArgForMethod(propertyName, call)

  if (!arg) {
    return null
  }

  if (Node.isArrowFunction(arg)) {
    return arg
  }

  if (Node.isFunctionExpression(arg)) {
    return arg
  }

  if (Node.isIdentifier(arg)) {
    const definition = arg.getDefinitionNodes()[0]

    if (Node.isVariableDeclaration(definition)) {
      const value = definition.getInitializer()

      if (!value) {
        return null
      }

      return filterNodeToFunctionLike(value)
    }
  }

  return null
}

export type RouteHandler = {
  method: string
  function: FunctionLikeDeclaration
  returnType: Type
  returnTypeNode: TypeNode | undefined
  returnSchema: ExtendedSchemaObject | null
  call: CallExpression
}

function getRouteHandlersFromRouter(
  definition: CallExpression,
  tempFile: SourceFile,
) {
  const methodCalls = definition
    .getDescendantsOfKind(ts.SyntaxKind.PropertyAccessExpression)
    .map((a) => a.getParentIfKind(ts.SyntaxKind.CallExpression))
    .filter((c) => !!c)
    .map((call): RouteHandler | null => {
      const propertyName = getMethodPropertyName(call)
      if (!propertyName) {
        return null
      }

      const method = mapMethodCallToMethod(propertyName, call)
      if (!method) {
        return null
      }

      const functionDecl = mapMethodCallToFunctionDefinition(propertyName, call)

      if (!functionDecl) {
        return null
      }

      const returnType = functionDecl.getReturnType()
      const returnTypeNode = functionDecl.getReturnTypeNode()

      const returnStatements = getOwnReturnStatements(functionDecl)

      const returnSchema = tsTypeToOpenApiSchema(
        returnType,
        returnStatements,
        tempFile,
      )

      return {
        method,
        function: functionDecl,
        returnType,
        returnTypeNode,
        returnSchema,
        call,
      }
    })
    .filter((a) => !!a)

  return methodCalls
}

export function getRoutersFromProgram(
  program: SourceFile,
  tempFile: SourceFile,
) {
  const routersByPath = new Map<string, RouteHandler[]>()

  traverseImportsForRouterBuilderCalls(program)
  traverseImportsForRouters(program)

  for (const routers of traversedRouters.values()) {
    for (const router of routers.values()) {
      if (routersByPath.has(router.pathDefition)) {
        console.warn(
          `Multiple routers with path ${router.pathDefition} were defined`,
        )
        continue
      }

      const routeHandlers = getRouteHandlersFromRouter(
        router.definition,
        tempFile,
      )

      routersByPath.set(router.pathDefition, routeHandlers)
    }
  }

  return routersByPath
}
