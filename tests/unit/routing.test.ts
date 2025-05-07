import { describe, it, expect } from "vitest";
import { compileRouters, routerBuilder } from "src/routing";
import { z } from "zod";
import {
  HttpMethodNotAllowedError,
  HttpNotFoundError,
  InvalidRequestBodyError,
} from "src/errors";

type Request = {
  some: string;
};

type Response = {
  data: string;
};

describe("routerBuilder + compileRouters", () => {
  const userRouter = routerBuilder<Request, Response>()("/user/:userId")
    .get(async ({ routeResult: { userId } }) => ({ data: `User ${userId}` }))
    .build();

  const commentRouter = routerBuilder<Request, Response>()(
    "/user/:userId/comment/:postId"
  )
    .get(async ({ routeResult: { userId, postId } }) => ({
      data: `User ${userId}, Comment ${postId}`,
    }))
    .post(
      z.object({ text: z.string() }),
      async ({ routeResult: { userId, postId }, body: { text } }) => ({
        data: `User ${userId}, Comment ${postId}, Text ${text}`,
      })
    )
    .build();

  it("should be able to handle a GET request", async () => {
    const handler = compileRouters<Request, Response>([userRouter]);

    const result = await handler("/user/123", "GET", null, { some: "request" });

    expect(result).toEqual({ data: "User 123" });
  });

  it("should be able to handle a request to any endpoint defined", async () => {
    const handler = compileRouters<Request, Response>([
      userRouter,
      commentRouter,
    ]);

    const getUserResult = await handler("/user/123", "GET", null, {
      some: "request",
    });
    expect(getUserResult).toEqual({ data: "User 123" });

    const getCommentResult = await handler(
      "/user/123/comment/456",
      "GET",
      null,
      {
        some: "request",
      }
    );
    expect(getCommentResult).toEqual({ data: "User 123, Comment 456" });

    const postCommentResult = await handler(
      "/user/123/comment/456",
      "POST",
      {
        text: "Hello World",
      },
      {
        some: "request",
      }
    );
    expect(postCommentResult).toEqual({
      data: "User 123, Comment 456, Text Hello World",
    });
  });

  it("should throw a HttpNotFoundError if the path is not found", async () => {
    const handler = compileRouters<Request, Response>([userRouter]);

    await expect(
      handler("/something/else", "GET", null, { some: "request" })
    ).rejects.toThrowError(HttpNotFoundError);
  });

  it("should throw a HttpMethodNotAllowedError if the method is not allowed", async () => {
    const handler = compileRouters<Request, Response>([userRouter]);

    await expect(
      handler("/user/123", "DELETE", null, { some: "request" })
    ).rejects.toThrowError(new HttpMethodNotAllowedError(["GET"]));
  });

  it("should throw a InvalidRequestBodyError if the body does not match the schema", async () => {
    const handler = compileRouters<Request, Response>([commentRouter]);

    await expect(
      handler(
        "/user/123/comment/456",
        "POST",
        { invalid: "body" },
        { some: "request" }
      )
    ).rejects.toThrowError(InvalidRequestBodyError);
  });

  it("should handle a path prefix", async () => {
    const handler = compileRouters<Request, Response>([userRouter], {
      pathPrefix: "/api",
    });

    const goodResult = await handler("/api/user/123", "GET", null, {
      some: "request",
    });

    expect(goodResult).toEqual({ data: "User 123" });

    const badResult = await handler("/api/user/123", "GET", null, {
      some: "request",
    });

    await expect(
      handler("/user/123", "GET", null, {
        some: "request",
      })
    ).rejects.toThrowError(HttpNotFoundError);
  });
});
