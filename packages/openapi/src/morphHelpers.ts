import {
  ArrowFunction,
  FunctionDeclaration,
  FunctionExpression,
  Node,
  ts,
} from 'ts-morph'

export function getOwnReturnStatements(
  func: FunctionExpression | ArrowFunction | FunctionDeclaration,
) {
  const rets = func
    .getDescendantsOfKind(ts.SyntaxKind.ReturnStatement)
    .filter((ret) => {
      const declarer =
        ret.getFirstAncestorByKind(ts.SyntaxKind.FunctionDeclaration) ??
        ret.getFirstAncestorByKind(ts.SyntaxKind.FunctionExpression) ??
        ret.getFirstAncestorByKind(ts.SyntaxKind.ArrowFunction)

      return declarer === func
    })

  if (rets.length > 0) {
    return rets
  }

  let lambdaLiteral = func.getLastChild()
  while (Node.isParenthesizedExpression(lambdaLiteral)) {
    lambdaLiteral = lambdaLiteral.getChildAtIndex(1)
  }

  if (lambdaLiteral) {
    return [lambdaLiteral]
  }

  return []
}
