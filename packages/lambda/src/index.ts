import { routerBuilder as makeRouterBuilder } from '@any-router/core'
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
} from 'aws-lambda'

export type HttpEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2
export type HttpResult<TCode extends number, T = unknown> = Omit<
  APIGatewayProxyResult,
  'body'
> & {
  statusCode: TCode
  body: T
}

export const routerBuilder = makeRouterBuilder<HttpEvent, HttpResult<number>>()
