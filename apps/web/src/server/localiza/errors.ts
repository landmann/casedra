import type { LocalizaErrorCode } from "@casedra/types";

export class LocalizaServiceError extends Error {
  readonly code: LocalizaErrorCode;

  constructor(code: LocalizaErrorCode, message: string) {
    super(message);
    this.name = "LocalizaServiceError";
    this.code = code;
  }
}
