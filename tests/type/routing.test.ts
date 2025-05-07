import type { Equal, Expect } from "@type-challenges/utils";
import { ParsePath } from "src/path";
import { routerBuilder, RouteHandler } from "src/routing";
import { z } from "zod";

const router1 = routerBuilder<string, string>()("/user/:userId")
  .get(async ({ routeResult: { userId } }) => `User ${userId}`)
  .build();

const router2 = routerBuilder<string, string>()("/user/:userId/post(/:postId)")
  .get(
    async ({ routeResult: { userId, postId } }) =>
      `User ${userId}, Post ${postId}`
  )
  .put(
    z.object({
      text: z.string(),
    }),
    async ({ routeResult: { userId, postId }, body: { text } }) =>
      `User ${userId}, Post ${postId}, Text: ${text}`
  )
  .build();

type cases = [
  Expect<
    Equal<
      typeof router1,
      {
        "/user/:userId": {
          GET: RouteHandler<
            ParsePath<"/user/:userId">,
            undefined,
            string,
            string
          >;
        };
      }
    >
  >,
  Expect<
    Equal<
      typeof router2,
      {
        "/user/:userId/post(/:postId)": {
          GET: RouteHandler<
            ParsePath<"/user/:userId/post(/:postId)">,
            undefined,
            string,
            string
          >;
          PUT: RouteHandler<
            ParsePath<"/user/:userId/post(/:postId)">,
            { text: string },
            string,
            string
          >;
        };
      }
    >
  >,
];
