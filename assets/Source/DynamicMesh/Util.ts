import { DEBUG } from "cc/env";

/**
 * Asserts that the expression evaluated to `true`.
 * @param expr Testing expression.
 * @param message Optional message.
 */
 export function assertIsTrue (expr: unknown, message?: string): asserts expr {
    if (DEBUG && !expr) {
        // eslint-disable-next-line no-debugger
        // debugger;
        throw new Error(`Assertion failed: ${message ?? '<no-message>'}`);
    }
}
