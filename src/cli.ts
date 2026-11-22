#!/usr/bin/env node
import { Command } from "@commander-js/extra-typings";

export function buildProgram() {
  return new Command()
    .name("zivex-skills")
    .description("Install AI-agent skills for .NET modular monoliths");
}

buildProgram().parse();
