import { ZodError } from 'zod'
import { HttpMethod } from './http.js'

// BASE ERRORS

export class HttpError extends Error {
  readonly statusCode: number
  readonly details?: unknown

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message)
    this.statusCode = statusCode
    this.details = details
  }
}

export class HttpBadRequestError extends HttpError {
  constructor(message = 'Bad Request', details?: unknown) {
    super(400, message, details)
  }
}

export class HttpNotFoundError extends HttpError {
  constructor(message = 'Not Found', details?: unknown) {
    super(404, message, details)
  }
}

export class HttpMethodNotAllowedError extends HttpError {
  readonly allowedMethods: HttpMethod[]

  constructor(
    allowedMethods: HttpMethod[],
    message = 'Method Not Allowed',
    details?: unknown,
  ) {
    super(405, message, details)
    this.allowedMethods = allowedMethods
  }
}

// CUSTOM ERRORS

export class InvalidRequestBodyError extends HttpBadRequestError {
  readonly details: ZodError

  constructor(zodError: ZodError, message = 'Invalid Request Body') {
    super(message, zodError)
    this.details = zodError
  }
}
