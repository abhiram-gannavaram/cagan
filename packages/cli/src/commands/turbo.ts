/**
 * turbo.ts — CLI command handler for TurboQuant controls.
 *
 * Provides sub-commands: --stats, --cache stats, --budget set, --report
 * All data displayed comes from local files only — no network calls.
 */

import { TurboQuant } from '@cagan/turbo';

interface TurboOptions {
  stats?: boolean;
  cache?: string;
  budget?: boolean;
  usd?: string;
  report?: boolean;
}

export async function turboCommand(options: TurboOptions): Promise<void> {
  const turbo = new TurboQuant();

  if (options.stats) {
    const budgetStatus = turbo.budget.getStatus();
    const cacheStats = await turbo.cache.getStats();

    console.log('\nTurboQuant Session Stats');
    console.log('━'.repeat(40));
    console.log(`  Session tokens used : ${budgetStatus.sessionTokensUsed.toLocaleString()}`);
    console.log(`  Session cost (USD)  : $${budgetStatus.sessionUsdUsed.toFixed(4)}`);
    console.log(`  Cache hit rate      : ${cacheStats.hitRate}%`);
    console.log(`  Cache hits          : ${cacheStats.hitCount}`);
    console.log(`  Tokens saved (cache): ${cacheStats.tokensSaved.toLocaleString()}`);
    console.log(`  Budget alert        : ${budgetStatus.alertTriggered ? 'YES — approaching limit' : 'No'}`);
    if (budgetStatus.budgetOptions.maxUsdPerSession) {
      console.log(`  Budget used         : ${budgetStatus.percentUsedUsd}% of $${budgetStatus.budgetOptions.maxUsdPerSession}`);
    }
    console.log('━'.repeat(40) + '\n');
    return;
  }

  if (options.cache === 'stats') {
    // FILE READ: reads cache directory stats from ~/.cagan/cache/ — local only
    const stats = await turbo.cache.getStats();
    console.log('\nTurboQuant Cache Statistics');
    console.log('━'.repeat(40));
    console.log(`  Total entries       : ${stats.totalEntries}`);
    console.log(`  Cache size          : ${(stats.totalSizeBytes / 1024).toFixed(1)} KB`);
    console.log(`  Hit count           : ${stats.hitCount}`);
    console.log(`  Miss count          : ${stats.missCount}`);
    console.log(`  Hit rate            : ${stats.hitRate}%`);
    console.log(`  Tokens saved        : ${stats.tokensSaved.toLocaleString()}`);
    if (stats.newestEntry > 0) {
      console.log(`  Newest entry        : ${new Date(stats.newestEntry).toLocaleDateString()}`);
    }
    console.log('━'.repeat(40));
    console.log(`  Cache location: ~/.cagan/cache/ (local only — never uploaded)\n`);
    return;
  }

  if (options.budget && options.usd) {
    const usd = parseFloat(options.usd);
    if (isNaN(usd) || usd <= 0) {
      console.error('Error: --usd must be a positive number (e.g. --usd 5.0)');
      process.exit(1);
    }
    turbo.budget.setBudget({
      maxUsdPerSession: usd,
      alertAtPercent: 80,
      blockAtPercent: 100
    });
    console.log(`Budget set: $${usd.toFixed(2)} per session (alert at 80%, block at 100%)`);
    return;
  }

  if (options.report) {
    const cacheStats = await turbo.cache.getStats();
    const budgetStatus = turbo.budget.getStatus();
    const analytics = turbo.analytics;

    // Build a synthetic session summary from available data
    console.log('\nTurboQuant Analytics Report');
    console.log('━'.repeat(50));
    console.log(`  Session tokens    : ${budgetStatus.sessionTokensUsed.toLocaleString()}`);
    console.log(`  Session cost      : $${budgetStatus.sessionUsdUsed.toFixed(4)}`);
    console.log(`  Cache hit rate    : ${cacheStats.hitRate}%`);
    console.log(`  Cache tokens saved: ${cacheStats.tokensSaved.toLocaleString()}`);
    console.log('');
    console.log('  Budget Status:');
    if (budgetStatus.budgetOptions.maxUsdPerSession) {
      console.log(`    Max USD/session : $${budgetStatus.budgetOptions.maxUsdPerSession}`);
      console.log(`    Used            : ${budgetStatus.percentUsedUsd}%`);
    } else {
      console.log('    No budget configured. Set one with: cagan turbo --budget set --usd 10.0');
    }
    console.log('');
    console.log('  Recommendations:');
    if (cacheStats.hitRate < 30) {
      console.log('    • Cache hit rate is low. Ensure turbo.cache_enabled: true in config.');
    }
    if (!budgetStatus.budgetOptions.maxUsdPerSession) {
      console.log('    • Set a session budget to prevent runaway costs.');
    }
    if (budgetStatus.sessionTokensUsed === 0) {
      console.log('    • No tokens used this session yet.');
    }
    console.log('━'.repeat(50) + '\n');
    return;
  }

  // Default: show help
  console.log(`
cagan turbo — TurboQuant token efficiency controls

Usage:
  cagan turbo --stats                   Show session token savings
  cagan turbo --cache stats             Show cache hit rate and stored entries
  cagan turbo --budget set --usd 5.0   Set session budget to $5.00
  cagan turbo --report                  Full analytics report

Configuration:
  turbo:
    enabled: true
    compression_level: medium  # light | medium | aggressive
    cache_enabled: true
    cache_ttl_days: 7
    budget:
      max_usd_per_session: 10.0
      alert_at_percent: 80
      block_at_percent: 100
  `);
}
