#!/usr/bin/env node

/**
 * Performance Comparison Tool
 * Membandingkan performa script lama vs optimized
 */

const fs = require('fs');
const path = require('path');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function parseLogFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const stats = {
    totalGames: 0,
    totalPoints: 0,
    sessionSuccessRate: 0,
    scoreSuccessRate: 0,
    avgBatchSize: 0,
    tokenUtilization: 0,
    errors429: 0,
    errors500: 0,
    cycles: 0,
    totalWins: 0,
  };

  // Parse FINAL SUMMARY
  const summaryMatch = content.match(/Total Games Played:\s*(\d+)/);
  if (summaryMatch) stats.totalGames = parseInt(summaryMatch[1], 10);

  const pointsMatch = content.match(/Total Points Earned:\s*(\d+)/);
  if (pointsMatch) stats.totalPoints = parseInt(pointsMatch[1], 10);

  const sessionSRMatch = content.match(/Session Success Rate:\s*([\d.]+)%/);
  if (sessionSRMatch) stats.sessionSuccessRate = parseFloat(sessionSRMatch[1]);

  const scoreSRMatch = content.match(/Score Submit Success Rate:\s*([\d.]+)%/);
  if (scoreSRMatch) stats.scoreSuccessRate = parseFloat(scoreSRMatch[1]);

  const avgBatchMatch = content.match(/Average Batch Size:\s*([\d.]+)/);
  if (avgBatchMatch) stats.avgBatchSize = parseFloat(avgBatchMatch[1]);

  const tokenUtilMatch = content.match(/Token Utilization:\s*([\d.]+)%/);
  if (tokenUtilMatch) stats.tokenUtilization = parseFloat(tokenUtilMatch[1]);

  // Count errors
  for (const line of lines) {
    if (line.includes('429')) stats.errors429++;
    if (line.includes('500')) stats.errors500++;
    if (line.includes('Cycle complete:')) {
      stats.cycles++;
      const winsMatch = line.match(/(\d+)\s+wins/);
      if (winsMatch) stats.totalWins += parseInt(winsMatch[1], 10);
    }
  }

  // Calculate averages
  if (stats.cycles > 0) {
    stats.avgWinsPerCycle = stats.totalWins / stats.cycles;
  }

  return stats;
}

function formatNumber(num) {
  return num.toLocaleString('id-ID');
}

function formatPercent(num) {
  return `${num.toFixed(1)}%`;
}

function printComparison(oldStats, newStats) {
  console.log('\n' + '='.repeat(100));
  console.log(colors.bright + colors.cyan + '📊 PERFORMANCE COMPARISON - Original vs Optimized' + colors.reset);
  console.log('='.repeat(100));

  if (!oldStats || !newStats) {
    console.log(colors.yellow + '\n⚠️  Data tidak lengkap. Pastikan kedua log file tersedia.' + colors.reset);
    if (!oldStats) console.log('   Missing: automation_original.log');
    if (!newStats) console.log('   Missing: automation_optimized.log');
    console.log('\nJalankan kedua script dengan:');
    console.log('  k6 run play.js 2>&1 | tee automation_original.log');
    console.log('  k6 run play_optimized.js 2>&1 | tee automation_optimized.log');
    return;
  }

  const metrics = [
    {
      name: 'Total Games Played',
      old: oldStats.totalGames,
      new: newStats.totalGames,
      format: formatNumber,
      higherIsBetter: true,
    },
    {
      name: 'Total Points Earned',
      old: oldStats.totalPoints,
      new: newStats.totalPoints,
      format: formatNumber,
      higherIsBetter: true,
    },
    {
      name: 'Session Success Rate',
      old: oldStats.sessionSuccessRate,
      new: newStats.sessionSuccessRate,
      format: formatPercent,
      higherIsBetter: true,
    },
    {
      name: 'Score Success Rate',
      old: oldStats.scoreSuccessRate,
      new: newStats.scoreSuccessRate,
      format: formatPercent,
      higherIsBetter: true,
    },
    {
      name: 'Average Batch Size',
      old: oldStats.avgBatchSize,
      new: newStats.avgBatchSize,
      format: (n) => n.toFixed(1),
      higherIsBetter: true,
    },
    {
      name: 'Token Utilization',
      old: oldStats.tokenUtilization,
      new: newStats.tokenUtilization,
      format: formatPercent,
      higherIsBetter: true,
    },
    {
      name: 'Avg Wins per Cycle',
      old: oldStats.avgWinsPerCycle || 0,
      new: newStats.avgWinsPerCycle || 0,
      format: (n) => n.toFixed(1),
      higherIsBetter: true,
    },
    {
      name: 'Error 429 Count',
      old: oldStats.errors429,
      new: newStats.errors429,
      format: formatNumber,
      higherIsBetter: false,
    },
    {
      name: 'Error 500 Count',
      old: oldStats.errors500,
      new: newStats.errors500,
      format: formatNumber,
      higherIsBetter: false,
    },
  ];

  console.log('\n' + colors.bright + 'Metric'.padEnd(30) + 'Original'.padEnd(20) + 'Optimized'.padEnd(20) + 'Change' + colors.reset);
  console.log('-'.repeat(100));

  let totalImprovements = 0;
  let significantImprovements = 0;

  for (const metric of metrics) {
    const oldVal = metric.old;
    const newVal = metric.new;
    const oldStr = metric.format(oldVal);
    const newStr = metric.format(newVal);

    let change = 0;
    let changeStr = '-';
    let changeColor = colors.reset;

    if (oldVal > 0) {
      change = ((newVal - oldVal) / oldVal) * 100;
      const sign = change > 0 ? '+' : '';
      changeStr = `${sign}${change.toFixed(1)}%`;

      const isImprovement = metric.higherIsBetter ? change > 0 : change < 0;
      if (isImprovement) {
        changeColor = colors.green;
        totalImprovements++;
        if (Math.abs(change) > 20) significantImprovements++;
      } else if (change !== 0) {
        changeColor = colors.red;
      }
    }

    console.log(
      metric.name.padEnd(30) +
      oldStr.padEnd(20) +
      newStr.padEnd(20) +
      changeColor + changeStr + colors.reset
    );
  }

  console.log('-'.repeat(100));

  // Overall assessment
  console.log('\n' + colors.bright + '🎯 Overall Assessment:' + colors.reset);
  
  const overallScore = totalImprovements / metrics.length * 100;
  let rating = '';
  let ratingColor = colors.reset;

  if (overallScore >= 80) {
    rating = '🏆 EXCELLENT - Optimasi sangat efektif!';
    ratingColor = colors.green;
  } else if (overallScore >= 60) {
    rating = '✅ GOOD - Optimasi bekerja dengan baik';
    ratingColor = colors.cyan;
  } else if (overallScore >= 40) {
    rating = '⚠️  MODERATE - Ada peningkatan tapi bisa lebih baik';
    ratingColor = colors.yellow;
  } else {
    rating = '❌ POOR - Perlu tuning lebih lanjut';
    ratingColor = colors.red;
  }

  console.log(ratingColor + rating + colors.reset);
  console.log(`Improvements: ${totalImprovements}/${metrics.length} metrics (${significantImprovements} significant)`);

  // Recommendations
  if (newStats.errors429 > oldStats.errors429 * 1.5) {
    console.log('\n' + colors.yellow + '⚠️  Rekomendasi: Error 429 masih tinggi. Turunkan INITIAL_BATCH_SIZE dan MAX_BATCH_SIZE' + colors.reset);
  }

  if (newStats.sessionSuccessRate < 70) {
    console.log('\n' + colors.yellow + '⚠️  Rekomendasi: Success rate rendah. Naikkan TARGET_SUCCESS_RATE ke 0.80-0.85' + colors.reset);
  }

  if (newStats.avgWinsPerCycle && newStats.avgWinsPerCycle < 20) {
    console.log('\n' + colors.yellow + '⚠️  Rekomendasi: Wins per cycle rendah. Coba naikkan batch size atau turunkan delay' + colors.reset);
  }

  if (newStats.tokenUtilization < 70) {
    console.log('\n' + colors.yellow + '⚠️  Rekomendasi: Token underutilized. Set AGGRESSIVE_MODE=true dan naikkan batch size' + colors.reset);
  }

  console.log('\n' + '='.repeat(100) + '\n');
}

// Main
console.log(colors.bright + '\n🔍 Analyzing performance logs...\n' + colors.reset);

const originalLog = path.join(__dirname, 'automation_original.log');
const optimizedLog = path.join(__dirname, 'automation_optimized.log');

const oldStats = parseLogFile(originalLog);
const newStats = parseLogFile(optimizedLog);

printComparison(oldStats, newStats);

// Export for programmatic use
if (oldStats && newStats) {
  const report = {
    timestamp: new Date().toISOString(),
    original: oldStats,
    optimized: newStats,
    improvements: {},
  };

  const metrics = ['totalGames', 'totalPoints', 'sessionSuccessRate', 'scoreSuccessRate', 'tokenUtilization'];
  for (const metric of metrics) {
    const oldVal = oldStats[metric];
    const newVal = newStats[metric];
    if (oldVal > 0) {
      report.improvements[metric] = ((newVal - oldVal) / oldVal * 100).toFixed(2) + '%';
    }
  }

  fs.writeFileSync(
    path.join(__dirname, 'performance_report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(colors.green + '✅ Performance report saved to: performance_report.json' + colors.reset);
}
