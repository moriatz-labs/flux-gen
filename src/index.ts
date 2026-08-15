#!/usr/bin/env bun
import { runCli } from "./cli.ts";

try {
  await runCli();
} catch (error) {
  if ((error as Error).name === "ExitPromptError") process.exit(130);
  console.error(`Error: ${(error as Error).message}`);
  process.exit(1);
}
