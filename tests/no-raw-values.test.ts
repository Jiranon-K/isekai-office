import { describe, expect, test } from "bun:test";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");

const PALETTE =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|white|black";
const COLOR_UTILITIES =
  "bg|text|border|border-[trblxyse]|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|shadow|accent|caret|divide|placeholder";

const RULES: [string, RegExp][] = [
  ["hex colour", /#[0-9a-fA-F]{3,8}\b/],
  ["colour function", /\b(?:oklch|oklab|rgba?|hsla?|lab|lch|color-mix)\(/],
  [
    "palette class",
    new RegExp(
      `(?<![\\w-])(?:${COLOR_UTILITIES})-(?:${PALETTE})(?:-\\d{2,3})?(?:\\/\\d+)?(?![\\w-])`,
    ),
  ],
  ["arbitrary z-index", /(?<![\w-])z-\[/],
  ["arbitrary duration", /(?<![\w-])duration-(?:\[|\d)/],
];

export function findRawValues(source: string): string[] {
  const hits: string[] = [];
  for (const [name, pattern] of RULES) {
    const match = source.match(pattern);
    if (match) hits.push(`${name} "${match[0]}"`);
  }
  return hits;
}

describe("no raw design values in web sources", () => {
  test("the rules catch what they should and spare tokens", () => {
    expect(findRawValues('className="bg-[#c96442]"')).not.toEqual([]);
    expect(findRawValues('className="text-orange-500"')).not.toEqual([]);
    expect(findRawValues('className="text-white"')).not.toEqual([]);
    expect(findRawValues('className="border-t-stone-200/50"')).not.toEqual([]);
    expect(findRawValues('style={{ color: "oklch(0.6 0.1 40)" }}')).not.toEqual([]);
    expect(findRawValues('className="z-[60] duration-300"')).not.toEqual([]);
    expect(
      findRawValues(
        'className="bg-primary text-primary-foreground text-status-done border-input z-dialog duration-base text-sm"',
      ),
    ).toEqual([]);
  });

  test("components use tokens, not raw colours, z-indexes or durations", async () => {
    const offenders: string[] = [];
    for await (const file of new Bun.Glob("web/src/**/*.{ts,tsx}").scan({
      cwd: root,
      onlyFiles: true,
    })) {
      const normalized = file.replaceAll("\\", "/");
      if (normalized.endsWith(".test.ts") || normalized.endsWith(".test.tsx")) continue;
      const source = await Bun.file(path.join(root, file)).text();
      for (const hit of findRawValues(source)) offenders.push(`${normalized}: ${hit}`);
    }

    expect(offenders).toEqual([]);
  });
});
