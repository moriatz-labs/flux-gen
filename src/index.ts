#!/usr/bin/env bun
import { offerDeapiKeyRecovery, runCli } from "./cli.ts";
import { friendlyHttpError } from "./errors.ts";
import { HttpError } from "./http.ts";

try {
  await runCli();
} catch (error) {
  if ((error as Error).name === "ExitPromptError") process.exit(130);
  if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
    console.log(friendlyHttpError(error));
    try {
      if (await offerDeapiKeyRecovery(error)) process.exit(0);
    } catch (recoveryError) {
      if (recoveryError instanceof HttpError && (recoveryError.status === 401 || recoveryError.status === 403)) {
        console.log(friendlyHttpError(recoveryError));
        process.exit(1);
      }
      console.error(`Error: ${(recoveryError as Error).message}`);
      process.exit(1);
    }
    process.exit(1);
  }
  console.error(`Error: ${(error as Error).message}`);
  process.exit(1);
}
