#!/bin/bash
# Manual test script for Milestone 2

set -e

echo "🧪 Testing Milestone 2: Initiative Creation"
echo ""

# Setup test directory
TEST_DIR="/tmp/forge-test-$(date +%s)"
export FORGE_INITIATIVES_DIR="$TEST_DIR"

echo "📁 Test directory: $TEST_DIR"
mkdir -p "$TEST_DIR"

# Test 1: Create initiative programmatically
echo ""
echo "Test 1: Create initiative with metadata"
node -e "
import { createMetadata, saveMetadata } from './src/metadata-store.js';
import { generateAgentsMd } from './src/agents-template.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const testDir = process.env.FORGE_INITIATIVES_DIR;
const initPath = join(testDir, 'test-auth');

// Create structure
mkdirSync(join(initPath, '.forge'), { recursive: true });
mkdirSync(join(initPath, 'outputs'), { recursive: true });

// Create metadata
const metadata = createMetadata('test-auth', 'Test Authentication System');
saveMetadata(join(initPath, '.forge', 'metadata.json'), metadata);

// Generate AGENTS.md
const agentsMd = generateAgentsMd(metadata);
writeFileSync(join(initPath, 'AGENTS.md'), agentsMd, 'utf8');

console.log('✅ Initiative created:', initPath);
"

# Verify structure
echo ""
echo "Test 2: Verify structure"
ls -la "$TEST_DIR/test-auth/"
echo ""
ls -la "$TEST_DIR/test-auth/.forge/"

# Test 3: Verify metadata.json
echo ""
echo "Test 3: Verify metadata.json"
cat "$TEST_DIR/test-auth/.forge/metadata.json" | jq '{name, displayName, outcome, stage, nextAction}'

# Test 4: Verify AGENTS.md
echo ""
echo "Test 4: Verify AGENTS.md exists and has content"
if [ -f "$TEST_DIR/test-auth/AGENTS.md" ]; then
  echo "✅ AGENTS.md exists"
  head -20 "$TEST_DIR/test-auth/AGENTS.md"
else
  echo "❌ AGENTS.md missing"
  exit 1
fi

# Test 5: Verify outputs/ directory
echo ""
echo "Test 5: Verify outputs/ directory"
if [ -d "$TEST_DIR/test-auth/outputs" ]; then
  echo "✅ outputs/ directory exists"
else
  echo "❌ outputs/ directory missing"
  exit 1
fi

# Cleanup
echo ""
echo "🧹 Cleaning up..."
rm -rf "$TEST_DIR"

echo ""
echo "✅ All M2 tests passed!"
