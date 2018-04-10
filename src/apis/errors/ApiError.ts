export class APIError extends Error {

  constructor(message: string, public statusCode: number) {
    super(message);
    // https://stackoverflow.com/a/41102306
    Object.setPrototypeOf(this, APIError.prototype);
  }
}
