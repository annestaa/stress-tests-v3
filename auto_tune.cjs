#!/usr/bin/env node

/**
 * Auto-Tuning Configuration Generator
 * Membuat rekomendasi config berdasarkan kondisi network dan hasil test
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg, color = colors.reset) {
  console.log(color + msg + colors.reset);
}

function testNetwork() {
  log('\n🌐 Testing network latency...', colors.cyan);
  
  try {
    const start = Date.now();
    execSync('curl -s -o /dev/null -w "%{time_total}" https://minigames.liputan6.com', {
      timeout: 10000,
      stdio: 'pipe',
    });
    const latency = Date.now() - start;
    
    log(`   Latency: ${latency}ms`, colors.green);
    
    if (latency < 200) return 'fast';
    if (latency < 500) return 'normal';
    if (latency < 1000) return 'slow';
    return 'very_slow';
  } catch (error) {
    log('   ⚠️  Network test failed, assuming normal', colors.yellow);
    return 'normal';
  }
}

function detectServerLoad() {
  log('\n🔍 Detecting server load...', colors.cyan);
  
  const hour = new Date().getHours();
  
  // Peak hours: 18:00-23:00
  if (hour >= 18 && hour <= 23) {
    log('   Peak hours detected (18:00-23:00)', colors.yellow);
    return 'high';
  }
  
  // Business hours: 09:00-17:00
  if (hour >= 9 && hour <= 17) {
    log('   Business hours (09:00-17:00)', colors.blue);
    return 'medium';
  }
  
  // Off-peak: 00:00-08:00
  log('   Off-peak hours (00:00-08:00)', colors.green);
  return 'low';
}

function analyzeExistingLog() {
  log('\n📊 Analyzing existing performance data...', colors.cyan);
  
  const logPath = path.join(__dirname, 'automation_optimized.log');
  
  if (!fs.existsSync(logPath)) {
    log('   No existing log found (first run)', colors.yellow);
    return null;
  }
  
  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.split('\n');
  
  let errors429 = 0;
  let errors500 = 0;
  let successRates = [];
  
  for (const line of lines) {
    if (line.includes('429')) errors429++;
    if (line.includes('500')) errors500++;
    
    const srMatch = line.match(/SR:\s*([\d.]+)%/);
    if (srMatch) {
      successRates.push(parseFloat(srMatch[1]));
    }
  }
  
  const avgSR = successRates.length > 0 
    ? successRates.reduce((a, b) => a + b, 0) / successRates.length 
    : 0;
  
  log(`   Errors 429: ${errors429}`, errors429 > 10 ? colors.red : colors.green);
  log(`   Errors 500: ${errors500}`, errors500 > 5 ? colors.red : colors.green);
  log(`   Avg Success Rate: ${avgSR.toFixed(1)}%`, avgSR > 75 ? colors.green : colors.yellow);
  
  return {
    errors429,
    errors500,
    avgSuccessRate: avgSR,
  };
}

function generateConfig(networkSpeed, serverLoad, existingPerf) {
  log('\n⚙️  Generating optimal configuration...', colors.cyan);
  
  let config = {
    INITIAL_BATCH_SIZE: 8,
    MIN_BATCH_SIZE: 2,
    MAX_BATCH_SIZE: 12,
    TARGET_SUCCESS_RATE: 0.75,
    MIN_ROUND_DELAY_SEC: 1.0,
    MAX_ROUND_DELAY_SEC: 3.0,
    AGGRESSIVE_MODE: true,
    GAMEPLAY_DURATION_SEC: 7.5,
  };
  
  // Adjust based on network speed
  if (networkSpeed === 'fast') {
    config.INITIAL_BATCH_SIZE = 10;
    config.MAX_BATCH_SIZE = 15;
    config.MIN_ROUND_DELAY_SEC = 0.8;
    config.MAX_ROUND_DELAY_SEC = 2.0;
    log('   🚀 Fast network: Aggressive settings', colors.green);
  } else if (networkSpeed === 'slow') {
    config.INITIAL_BATCH_SIZE = 5;
    config.MAX_BATCH_SIZE = 8;
    config.MIN_ROUND_DELAY_SEC = 1.5;
    config.MAX_ROUND_DELAY_SEC = 3.5;
    config.TARGET_SUCCESS_RATE = 0.80;
    log('   🐌 Slow network: Conservative settings', colors.yellow);
  } else if (networkSpeed === 'very_slow') {
    config.INITIAL_BATCH_SIZE = 3;
    config.MIN_BATCH_SIZE = 1;
    config.MAX_BATCH_SIZE = 5;
    config.MIN_ROUND_DELAY_SEC = 2.0;
    config.MAX_ROUND_DELAY_SEC = 4.0;
    config.TARGET_SUCCESS_RATE = 0.85;
    config.AGGRESSIVE_MODE = false;
    log('   🐢 Very slow network: Ultra-conservative', colors.red);
  }
  
  // Adjust based on server load
  if (serverLoad === 'high') {
    config.INITIAL_BATCH_SIZE = Math.max(3, Math.floor(config.INITIAL_BATCH_SIZE * 0.6));
    config.MAX_BATCH_SIZE = Math.max(6, Math.floor(config.MAX_BATCH_SIZE * 0.6));
    config.MIN_ROUND_DELAY_SEC += 1.0;
    config.MAX_ROUND_DELAY_SEC += 1.5;
    config.TARGET_SUCCESS_RATE = Math.min(0.9, config.TARGET_SUCCESS_RATE + 0.05);
    config.AGGRESSIVE_MODE = false;
    log('   🏢 High server load: Reduced batch sizes', colors.yellow);
  } else if (serverLoad === 'low') {
    config.INITIAL_BATCH_SIZE = Math.min(15, Math.floor(config.INITIAL_BATCH_SIZE * 1.3));
    config.MAX_BATCH_SIZE = Math.min(20, Math.floor(config.MAX_BATCH_SIZE * 1.3));
    config.MIN_ROUND_DELAY_SEC = Math.max(0.5, config.MIN_ROUND_DELAY_SEC - 0.3);
    config.TARGET_SUCCESS_RATE = Math.max(0.65, config.TARGET_SUCCESS_RATE - 0.05);
    log('   🌙 Low server load: Increased batch sizes', colors.green);
  }
  
  // Adjust based on existing performance
  if (existingPerf) {
    if (existingPerf.errors429 > 20) {
      config.INITIAL_BATCH_SIZE = Math.max(2, Math.floor(config.INITIAL_BATCH_SIZE * 0.5));
      config.MAX_BATCH_SIZE = Math.max(4, Math.floor(config.MAX_BATCH_SIZE * 0.5));
      config.MIN_ROUND_DELAY_SEC += 1.0;
      config.TARGET_SUCCESS_RATE = Math.min(0.9, config.TARGET_SUCCESS_RATE + 0.1);
      config.AGGRESSIVE_MODE = false;
      log('   🛑 High 429 errors detected: Drastically reduced', colors.red);
    }
    
    if (existingPerf.avgSuccessRate < 60) {
      config.TARGET_SUCCESS_RATE = Math.min(0.9, config.TARGET_SUCCESS_RATE + 0.1);
      config.MIN_ROUND_DELAY_SEC += 0.5;
      config.MAX_ROUND_DELAY_SEC += 1.0;
      log('   ⚠️  Low success rate: Increased delays', colors.yellow);
    } else if (existingPerf.avgSuccessRate > 90 && existingPerf.errors429 < 5) {
      config.INITIAL_BATCH_SIZE = Math.min(20, Math.floor(config.INITIAL_BATCH_SIZE * 1.2));
      config.MAX_BATCH_SIZE = Math.min(25, Math.floor(config.MAX_BATCH_SIZE * 1.2));
      config.TARGET_SUCCESS_RATE = Math.max(0.65, config.TARGET_SUCCESS_RATE - 0.05);
      log('   🏆 Excellent performance: Increasing throughput', colors.green);
    }
  }
  
  return config;
}

function writeEnvFile(config, envPath) {
  log('\n📝 Writing configuration to .env.auto...', colors.cyan);
  
  let envContent = `# ==============================================================================
# 🤖 AUTO-GENERATED CONFIGURATION
# Generated: ${new Date().toISOString()}
# ==============================================================================

# Game Configuration
MINIGAMES_USERNAME=zildjiannesta
GAME_CHOICE=tariktambang
API_BASE_URL=https://minigames.liputan6.com
RECAPTCHA_SITEKEY=6Ld_e78qAAAAAF1Uwh807r9U5E9w1lWbQvE9k7N2

# ============================================================================
# 🎯 AUTO-TUNED ADAPTIVE RATE LIMITING
# ============================================================================

# Batch Size Configuration
INITIAL_BATCH_SIZE=${config.INITIAL_BATCH_SIZE}
MIN_BATCH_SIZE=${config.MIN_BATCH_SIZE}
MAX_BATCH_SIZE=${config.MAX_BATCH_SIZE}

# Target Success Rate
TARGET_SUCCESS_RATE=${config.TARGET_SUCCESS_RATE}

# Aggressive Mode
AGGRESSIVE_MODE=${config.AGGRESSIVE_MODE}

# ============================================================================
# TIMING CONFIGURATION
# ============================================================================

GAMEPLAY_DURATION_SEC=${config.GAMEPLAY_DURATION_SEC}
MIN_ROUND_DELAY_SEC=${config.MIN_ROUND_DELAY_SEC}
MAX_ROUND_DELAY_SEC=${config.MAX_ROUND_DELAY_SEC}
TIME_LEFT=22

# ============================================================================
# K6 CONFIGURATION
# ============================================================================

VUS=1
LOOP_COUNT=9999

# ============================================================================
# CAPTCHA SOLVER CONFIGURATION
# ============================================================================

CDP_URL=http://127.0.0.1:9222
CAPTCHA_MIN_INTERVAL_SEC=6
CAPTCHA_DOS_COOLDOWN_SEC=90

# Uncomment and fill these if you have cloud solver accounts:
# CAPSOLVER_API_KEY=
# TWOCAPTCHA_API_KEY=
# WITAI_ACCESS_TOKEN=
# OPENAI_API_KEY=
`;

  fs.writeFileSync(envPath, envContent, 'utf-8');
  log('   ✅ Configuration saved', colors.green);
}

function displayRecommendations(config, networkSpeed, serverLoad) {
  console.log('\n' + '='.repeat(80));
  log('📋 RECOMMENDED CONFIGURATION', colors.bright + colors.cyan);
  console.log('='.repeat(80));
  
  console.log(`\n${colors.bright}Network Speed:${colors.reset} ${networkSpeed}`);
  console.log(`${colors.bright}Server Load:${colors.reset} ${serverLoad}`);
  
  console.log(`\n${colors.bright}Batch Size:${colors.reset}`);
  console.log(`  Initial: ${config.INITIAL_BATCH_SIZE}`);
  console.log(`  Min: ${config.MIN_BATCH_SIZE}`);
  console.log(`  Max: ${config.MAX_BATCH_SIZE}`);
  
  console.log(`\n${colors.bright}Performance:${colors.reset}`);
  console.log(`  Target Success Rate: ${(config.TARGET_SUCCESS_RATE * 100).toFixed(0)}%`);
  console.log(`  Aggressive Mode: ${config.AGGRESSIVE_MODE ? 'ON' : 'OFF'}`);
  
  console.log(`\n${colors.bright}Timing:${colors.reset}`);
  console.log(`  Round Delay: ${config.MIN_ROUND_DELAY_SEC}s - ${config.MAX_ROUND_DELAY_SEC}s`);
  console.log(`  Gameplay Duration: ${config.GAMEPLAY_DURATION_SEC}s`);
  
  console.log('\n' + '='.repeat(80));
  
  console.log(`\n${colors.green}✅ Configuration saved to: .env.auto${colors.reset}`);
  console.log(`\n${colors.bright}To use this configuration:${colors.reset}`);
  console.log(`  1. ${colors.cyan}cp .env.auto .env${colors.reset}`);
  console.log(`  2. Edit MINIGAMES_USERNAME in .env`);
  console.log(`  3. ${colors.cyan}k6 run play_optimized.js${colors.reset}`);
  
  console.log(`\n${colors.yellow}💡 Tips:${colors.reset}`);
  
  if (networkSpeed === 'fast' && serverLoad === 'low') {
    console.log(`  - Kondisi optimal! Expected: 35-50 wins per token`);
  } else if (networkSpeed === 'slow' || serverLoad === 'high') {
    console.log(`  - Kondisi kurang ideal. Expected: 15-25 wins per token`);
    console.log(`  - Consider running during off-peak hours (00:00-08:00)`);
  } else {
    console.log(`  - Kondisi normal. Expected: 25-35 wins per token`);
  }
  
  if (serverLoad === 'high') {
    console.log(`  - Peak hours detected. Success rate mungkin lebih rendah`);
    console.log(`  - Coba jalankan lagi jam 00:00-08:00 untuk hasil optimal`);
  }
  
  console.log('\n');
}

function interactiveMode() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  log('\n🎮 Interactive Configuration Mode', colors.bright + colors.cyan);
  log('=' .repeat(80), colors.cyan);
  
  console.log('\nAnswer a few questions to generate optimal config:\n');
  
  rl.question('1. Network speed? (fast/normal/slow): ', (network) => {
    rl.question('2. Current time feels like? (peak/normal/quiet): ', (time) => {
      rl.question('3. Priority? (speed/balanced/safety): ', (priority) => {
        rl.close();
        
        let networkSpeed = network.toLowerCase() || 'normal';
        if (!['fast', 'normal', 'slow'].includes(networkSpeed)) networkSpeed = 'normal';
        
        let serverLoad = 'medium';
        if (time.toLowerCase().includes('peak')) serverLoad = 'high';
        if (time.toLowerCase().includes('quiet')) serverLoad = 'low';
        
        let config = generateConfig(networkSpeed, serverLoad, null);
        
        // Adjust based on priority
        if (priority.toLowerCase().includes('speed')) {
          config.INITIAL_BATCH_SIZE = Math.min(20, Math.floor(config.INITIAL_BATCH_SIZE * 1.5));
          config.MAX_BATCH_SIZE = Math.min(25, Math.floor(config.MAX_BATCH_SIZE * 1.5));
          config.TARGET_SUCCESS_RATE = Math.max(0.6, config.TARGET_SUCCESS_RATE - 0.1);
          config.AGGRESSIVE_MODE = true;
          log('\n⚡ Speed priority: Maximum throughput config', colors.yellow);
        } else if (priority.toLowerCase().includes('safety')) {
          config.INITIAL_BATCH_SIZE = Math.max(2, Math.floor(config.INITIAL_BATCH_SIZE * 0.6));
          config.MAX_BATCH_SIZE = Math.max(5, Math.floor(config.MAX_BATCH_SIZE * 0.6));
          config.TARGET_SUCCESS_RATE = Math.min(0.9, config.TARGET_SUCCESS_RATE + 0.1);
          config.AGGRESSIVE_MODE = false;
          log('\n🛡️  Safety priority: Conservative config', colors.green);
        } else {
          log('\n⚖️  Balanced priority: Default config', colors.blue);
        }
        
        writeEnvFile(config, path.join(__dirname, '.env.auto'));
        displayRecommendations(config, networkSpeed, serverLoad);
      });
    });
  });
}

// Main
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--interactive') || args.includes('-i')) {
    interactiveMode();
    return;
  }
  
  log('🤖 Auto-Tuning Configuration Generator', colors.bright + colors.blue);
  log('=' .repeat(80), colors.blue);
  
  const networkSpeed = testNetwork();
  const serverLoad = detectServerLoad();
  const existingPerf = analyzeExistingLog();
  
  const config = generateConfig(networkSpeed, serverLoad, existingPerf);
  
  const envPath = path.join(__dirname, '.env.auto');
  writeEnvFile(config, envPath);
  
  displayRecommendations(config, networkSpeed, serverLoad);
}

if (require.main === module) {
  main();
}

module.exports = { generateConfig, testNetwork, detectServerLoad };
