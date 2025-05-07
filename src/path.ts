type ParseParam<TSegment extends string> = TSegment extends `:${infer TParam}`
  ? { [param in TParam]: string }
  : unknown;

type ParsePathInner<
  TPath extends string, // The path remaining to parse
  TParams = unknown, // The collected path parameters
> = TPath extends ""
  ? TParams // Base case: there is no more path to parse (it is an empty string)
  : TPath extends `/*${infer TParam}` // Splat operator stops all other operations
    ? TParams & { [param in TParam]?: string }
    : TPath extends `(/${infer TSegment})${infer TRest}` // The current segment is opional
      ? ParsePathInner<TRest, TParams & Partial<ParseParam<TSegment>>>
      : TPath extends `/${infer TSegment}/${infer TRest}` // There is another segment to parse
        ? TSegment extends `${infer TBefore}(`
          ? ParsePathInner<`(/${TRest}`, TParams & ParseParam<TBefore>> // The next segment is optional
          : ParsePathInner<`/${TRest}`, TParams & ParseParam<TSegment>> // The next segment is required
        : TPath extends `/${infer TSegment}`
          ? TParams & ParseParam<TSegment> // Base case: this is the last segment
          : TParams; // Base case: there are no more segments to parse

export type ParsePath<TPath extends string> =
  ParsePathInner<TPath> extends object
    ? Readonly<ParsePathInner<TPath>>
    : undefined;

function nextSegmentIndex(path: string) {
  if (!path.includes("(")) {
    if (!path.includes("/")) {
      return -1;
    } else {
      return path.indexOf("/");
    }
  } else {
    if (!path.includes("/")) {
      return path.indexOf("(");
    } else {
      return Math.min(path.indexOf("("), path.indexOf("/"));
    }
  }
}

function buildPathRegex(path: string, inPartial = false) {
  let pathRemaining = path;
  let regexStr = "";

  while (pathRemaining) {
    if (pathRemaining.startsWith("(") && pathRemaining.includes(")")) {
      // Current segment is optional -- it's wrapped in `()`
      if (inPartial) {
        throw new Error("Cannot nest optional segments");
      }

      const optionalSegment = pathRemaining.substring(
        1,
        pathRemaining.indexOf(")")
      );
      regexStr += `(?:${buildPathRegex(optionalSegment, true)})?`;
      pathRemaining = pathRemaining.substring(pathRemaining.indexOf(")") + 1);
    } else {
      if (!pathRemaining.startsWith("/")) {
        throw new Error(
          `Path segment must start with /, was "${pathRemaining}"`
        );
      }

      if (pathRemaining.startsWith("/*")) {
        // The rest is a splat operator
        const paramName = pathRemaining.substring(2);
        regexStr += `(?<${paramName}>/.*)?`;
        pathRemaining = "";

        // Short-circuit
        continue;
      }

      // Remove the `/` from the beginning
      pathRemaining = pathRemaining.substring(1);
      regexStr += "/";

      // Find the index of the next segment in the path
      const nextIdx = nextSegmentIndex(pathRemaining);
      let currentSegment;

      if (nextIdx > 0) {
        // There is another segment
        currentSegment = pathRemaining.substring(0, nextIdx);
        pathRemaining = pathRemaining.substring(nextIdx);
      } else {
        // This is the last segment
        currentSegment = pathRemaining;
        pathRemaining = "";
      }

      if (currentSegment.startsWith(":")) {
        // The segment is a param
        // Remove the leading `:`
        const paramName = currentSegment.substring(1);
        regexStr += `(?<${paramName}>[^/]+)`;
      } else {
        // The segment is a literal
        regexStr += currentSegment;
      }
    }
  }

  return regexStr;
}

export class Path<TPath extends string> {
  readonly blueprint: TPath;
  readonly regexp: RegExp;

  constructor(blueprint: TPath) {
    this.blueprint = blueprint;
    this.regexp = new RegExp(`^${buildPathRegex(blueprint)}$`);
  }

  test(path: string): ParsePath<TPath> | null {
    const result = this.regexp.exec(path);

    // Did not match
    if (!result) {
      return null;
    }

    // Matched and there were not capture groups
    if (!result.groups) {
      return {} as ParsePath<TPath>;
    }

    // Mapped and there were capture groups
    return result.groups as ParsePath<TPath>;
  }
}
