// CLI argument parsing, separated for testability.
//
// Flags come before the command; `--` ends flag parsing. Unknown flags are an
// error (they must never be silently treated as the command to run).

export interface Flags {
  noCat: boolean;
  guard: boolean;
  quiet: boolean;
}

export type ParseResult =
  | { kind: "run"; flags: Flags; cmd: string; args: string[] }
  | { kind: "demo"; flags: Flags }
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "error"; message: string; hint?: string };

export function parseArgs(argv: string[]): ParseResult {
  const flags: Flags = { noCat: false, guard: false, quiet: false };
  let i = 0;
  for (; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") {
      i++;
      break;
    }
    if (!a.startsWith("-")) break;
    if (a === "--guard") flags.guard = true;
    else if (a === "--no-cat") flags.noCat = true;
    else if (a === "--quiet") flags.quiet = true;
    else if (a === "--demo") {
      // the demo exists to show the whole act — guard on unless disabled
      flags.guard = true;
      return { kind: "demo", flags };
    } else if (a === "-h" || a === "--help") return { kind: "help" };
    else if (a === "-v" || a === "--version") return { kind: "version" };
    else {
      return {
        kind: "error",
        message: `catsit: unknown flag: ${a}`,
        hint: `use "catsit -- <command> [args...]" to pass flags to the wrapped command`,
      };
    }
  }
  if (i >= argv.length) return { kind: "help" };
  return { kind: "run", flags, cmd: argv[i]!, args: argv.slice(i + 1) };
}
