import type { HITLType } from "@tz/shared";

/** Raised by a flow when it needs human input. The engine converts this into
 *  an open HITLRequest + push notification and suspends the step durably.
 *  When the user resolves the request, the engine re-executes the flow; the
 *  flow's `ctx.hitl.require()` then returns the resolution and continues. */
export class HITLRequired extends Error {
  constructor(
    public readonly request: {
      /** stable key so re-execution matches the same request, e.g. "brela.captcha" */
      key: string;
      type: HITLType;
      title: string;
      instructionsMd: string;
      payload?: Record<string, unknown>;
      expiresInMinutes?: number;
    },
  ) {
    super(`HITL required: ${request.title}`);
    this.name = "HITLRequired";
  }
}

/** Raised when the flow must wait for government processing; the engine
 *  schedules a wakeup and re-executes the flow after `pollAfterMs`. */
export class GovtWait extends Error {
  constructor(
    public readonly pollAfterMs: number,
    public readonly note: string,
  ) {
    super(`Waiting on government: ${note}`);
    this.name = "GovtWait";
  }
}

/** Non-retryable: the input data is wrong; a human must fix the profile. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Non-retryable: the authority rejected the application. */
export class PortalRejection extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalRejection";
  }
}

export function isNonRetryable(err: unknown): boolean {
  return err instanceof ValidationError || err instanceof PortalRejection;
}
