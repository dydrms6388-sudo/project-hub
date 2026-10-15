// 워커 공통 CLI 플래그 파서. (DoD: 각 워커에 --dry-run 플래그 존재)

export type CliArgs = {
  dryRun: boolean;
  limit: number | null;
  vertical: string | null;
  raw: string[];
};

export function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const get = (flag: string): string | null => {
    const i = args.indexOf(flag);
    if (i === -1) return null;
    const val = args[i + 1];
    return val && !val.startsWith('--') ? val : '';
  };
  const limitStr = get('--limit');
  const vertical = get('--vertical');
  return {
    dryRun: args.includes('--dry-run'),
    limit: limitStr && limitStr !== '' ? Number(limitStr) : null,
    vertical: vertical && vertical !== '' ? vertical : null,
    raw: args,
  };
}
