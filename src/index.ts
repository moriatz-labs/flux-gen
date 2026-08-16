#!/usr/bin/env bun
import { runCli } from "./cli.ts";
import { friendlyHttpError } from "./errors.ts";
import { HttpError } from "./http.ts";

try {
  await runCli();
} catch (error) {
  if ((error as Error).name === "ExitPromptError") process.exit(130);
  if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
    console.log(friendlyHttpError(error));
    process.exit(1);
  }
  console.error(`Error: ${(error as Error).message}`);
  process.exit(1);
}
