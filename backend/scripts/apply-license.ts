// Apply (or replace) the install-time license. Usage:
//
//   npm --prefix backend run license:apply -- \
//     --key NEXUS-XXXX-XXXX-XXXX --plan enterprise --seats 100 \
//     --expires 2027-12-31 --by jcolom@example.com --notes "Renewal #2"
//
// `--expires` is optional; omit it (or pass empty) for a perpetual license.
// `--by` and `--notes` are optional metadata for the audit story; the
// script defaults `--by` to "cli" if not provided.
//
// This script is the *only* supported way to write to the `licenses`
// table. There's no admin UI / HTTP endpoint for this by design (license
// rotation is an operator concern, not a tenant-admin one). Future work:
// validate a signed license bundle instead of accepting raw flags.

import { PrismaClient } from '@prisma/client';

interface ParsedArgs {
  key?: string;
  plan?: string;
  seats?: string;
  expires?: string;
  by?: string;
  notes?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const name = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      // No value — treat as boolean-ish (we don't currently use any).
      continue;
    }
    (out as Record<string, string>)[name] = next;
    i++;
  }
  return out;
}

function fail(msg: string): never {
  console.error(`apply-license: ${msg}`);
  console.error('');
  console.error('Usage:');
  console.error('  npm --prefix backend run license:apply -- \\');
  console.error('    --key <license-key> --plan <starter|professional|enterprise> \\');
  console.error('    --seats <int> [--expires YYYY-MM-DD] [--by <actor>] [--notes <text>]');
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.key)   fail('missing required --key');
  if (!args.plan) fail('missing required --plan');
  if (!args.seats) fail('missing required --seats');

  const validPlans = ['starter', 'professional', 'enterprise'];
  if (!validPlans.includes(args.plan!)) {
    fail(`--plan must be one of ${validPlans.join(', ')}; got '${args.plan}'`);
  }

  const seats = Number(args.seats);
  if (!Number.isInteger(seats) || seats <= 0) {
    fail(`--seats must be a positive integer; got '${args.seats}'`);
  }

  const expires = args.expires ?? '';
  if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
    fail(`--expires must be YYYY-MM-DD or empty for perpetual; got '${expires}'`);
  }

  const prisma = new PrismaClient();
  try {
    const result = await prisma.license.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        licenseKey: args.key!,
        plan: args.plan!,
        seatsTotal: seats,
        licenseExpires: expires,
        appliedBy: args.by ?? 'cli',
        notes: args.notes ?? null,
      },
      update: {
        licenseKey: args.key!,
        plan: args.plan!,
        seatsTotal: seats,
        licenseExpires: expires,
        appliedAt: new Date(),
        appliedBy: args.by ?? 'cli',
        notes: args.notes ?? null,
      },
    });

    console.log('License applied:');
    console.log(`  key:          ${result.licenseKey}`);
    console.log(`  plan:         ${result.plan}`);
    console.log(`  seats:        ${result.seatsTotal}`);
    console.log(`  expires:      ${result.licenseExpires || '(never)'}`);
    console.log(`  appliedAt:    ${result.appliedAt.toISOString()}`);
    console.log(`  appliedBy:    ${result.appliedBy ?? '(unset)'}`);
    if (result.notes) console.log(`  notes:        ${result.notes}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
