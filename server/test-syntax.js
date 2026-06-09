/**
 * Quick syntax check for refactored files
 */

console.log('Testing imports...\n');

try {
  console.log('✓ Checking hybridMatcher...');
  await import('./src/services/hybridMatcher.js');
  console.log('  ✅ hybridMatcher.js - OK\n');
} catch (err) {
  console.error('  ❌ hybridMatcher.js - ERROR:', err.message);
  process.exit(1);
}

try {
  console.log('✓ Checking match route...');
  await import('./src/routes/match.js');
  console.log('  ✅ match.js - OK\n');
} catch (err) {
  console.error('  ❌ match.js - ERROR:', err.message);
  process.exit(1);
}

try {
  console.log('✓ Checking index...');
  await import('./src/index.js');
  console.log('  ✅ index.js - OK\n');
} catch (err) {
  console.error('  ❌ index.js - ERROR:', err.message);
  process.exit(1);
}

console.log('✅ All syntax checks passed!\n');
console.log('Summary:');
console.log('  - NLP Matcher: Removed (integrated into Hybrid)');
console.log('  - AI Matcher: Removed');
console.log('  - Hybrid Matcher: Enhanced (self-contained)\n');
