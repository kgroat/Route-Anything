import {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
  JSDoc,
  Node,
  SourceFile,
  ts,
} from 'ts-morph'
import { randomName } from './random.js'
import { getOwnReturnStatements } from './morphHelpers.js'

export type JSDocsByProperty = Record<string, JSDoc[]>

export function jsDocsFrom(node: Node, tempFile: SourceFile): JSDoc[] | null {
  if ('getJsDocs' in node && typeof node.getJsDocs === 'function') {
    const docs = node.getJsDocs() as JSDoc[]

    if (docs && docs.length > 0) {
      docs
    }
  }

  if (
    'jsDoc' in node.compilerNode &&
    Array.isArray(node.compilerNode.jsDoc) &&
    node.compilerNode.jsDoc.length > 0
  ) {
    const jsdocs = node.compilerNode.jsDoc as ts.JSDoc[]
    const docStrings = jsdocs.map((d) => {
      let text = ''
      if (typeof d.comment === 'object' && Array.isArray(d.comment)) {
        text = d.comment.map((c) => c.text).join('\n')
      } else if (typeof d.comment === 'string') {
        text = d.comment
      }

      if (d.tags) {
        if (text) {
          text += '\n'
        }

        text += d.tags.map((t) => t.getText()).join('\n')
      }

      return text
    })

    const tempFunc = tempFile.addFunction({
      name: randomName(),
    })

    return tempFunc.addJsDocs(docStrings)
  }

  return null
}

export function getJsdocFromProperties(
  node: Node,
  tempFile: SourceFile,
): JSDocsByProperty | null {
  if (Node.isVariableDeclaration(node)) {
    const initializer = node.getInitializer()
    if (!initializer) {
      return null
    }

    return getJsdocFromProperties(initializer, tempFile)
  }

  if (Node.isCallExpression(node)) {
    let calleeNode: Node | undefined =
      node.getFirstChildByKind(ts.SyntaxKind.ParenthesizedExpression) ??
      node.getFirstChildByKind(ts.SyntaxKind.PropertyAccessExpression) ??
      node.getFirstChildByKind(ts.SyntaxKind.Identifier)

    while (Node.isParenthesizedExpression(calleeNode)) {
      calleeNode = calleeNode.getChildren()[1]
    }

    if (!calleeNode) {
      return null
    }

    let func:
      | FunctionExpression
      | ArrowFunction
      | FunctionDeclaration
      | undefined

    if (
      Node.isFunctionExpression(calleeNode) ||
      Node.isArrowFunction(calleeNode) ||
      Node.isFunctionDeclaration(calleeNode)
    ) {
      func = calleeNode
    } else if (Node.isIdentifier(calleeNode)) {
      if (calleeNode) {
        const funcDef = calleeNode.getDefinitionNodes()[0]

        if (
          funcDef &&
          (Node.isFunctionExpression(funcDef) ||
            Node.isArrowFunction(funcDef) ||
            Node.isFunctionDeclaration(funcDef))
        ) {
          func = funcDef
        }
      }
    }

    if (func) {
      return getOwnReturnStatements(func)
        .map((ret) => getJsdocFromProperties(ret, tempFile))
        .reduce(
          (acc, cur) => ({
            ...acc,
            ...cur,
          }),
          {},
        )
    }

    return null
  }

  if (Node.isIdentifier(node)) {
    const definitions = node.getDefinitionNodes()
    return getJsdocFromProperties(
      definitions[0], // The definition of the identifier
      tempFile,
    )
  }

  if (Node.isReturnStatement(node)) {
    return getJsdocFromProperties(
      node.getChildren()[1], // The actual returned value
      tempFile,
    )
  }

  if (Node.isAsExpression(node)) {
    const children = node.getChildren()
    return getJsdocFromProperties(
      children[children.length - 1], // The casted type
      tempFile,
    )
  }

  if (Node.isTypeLiteral(node)) {
    const properties = node.getProperties()
    return properties.reduce((acc, p) => {
      acc[p.getName()] = p.getJsDocs()
      return acc
    }, {} as JSDocsByProperty)
  }

  if (Node.isInterfaceDeclaration(node)) {
    const properties = node.getProperties()
    return properties.reduce((acc, p) => {
      acc[p.getName()] = p.getJsDocs()
      return acc
    }, {} as JSDocsByProperty)
  }

  if (Node.isObjectLiteralExpression(node)) {
    const properties = node.getProperties()
    return properties.reduce((acc, p) => {
      if (Node.isPropertyAssignment(p)) {
        const docs = jsDocsFrom(p, tempFile)

        if (docs && docs.length > 0) {
          acc[p.getName()] = docs
        }

        return acc
      } else if (Node.isShorthandPropertyAssignment(p)) {
        const docs = jsDocsFrom(p, tempFile)

        if (docs && docs.length > 0) {
          acc[p.getName()] = docs
        }

        return acc
      } else if (Node.isSpreadAssignment(p)) {
        const children = p.getChildren()
        const spreadDocs = getJsdocFromProperties(
          children[children.length - 1],
          tempFile,
        )

        if (spreadDocs && Object.keys(spreadDocs).length > 0) {
          return { ...acc, ...spreadDocs }
        }

        return acc
      } else if (Node.isGetAccessorDeclaration(p)) {
        const docs = p.getJsDocs()

        if (docs && docs.length > 0) {
          acc[p.getName()] = docs
        }
      }
      return acc
    }, {} as JSDocsByProperty)
  }

  return null
}
