import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base class for business‑logic exceptions.
 * Returns an object `{ code, message }` with the provided HTTP status.
 */
export class BusinessException extends HttpException {
  constructor(code: string, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ code, message }, status);
  }
}

/**
 * 429 – Too Many Requests
 * Used for rate‑limit / retry‑limit errors.
 */
export class TooManyRequestsException extends BusinessException {
  constructor(code: string, message: string) {
    super(code, message, HttpStatus.TOO_MANY_REQUESTS);
  }
}
