#!/usr/bin/env ts-node
/**
 * Asset Manifest Validator
 * Parses manifest.ts, extracts texture keys, greps code for references.
 * Reports dead (unreferenced) and missing (referenced but not in manifest) assets.
 * Exit code 1 if missing assets found. Dead assets = warning only.
 */

import * as fs from 'fs';
import * as path from 'path';

const CLIENT_DIR = path.resolve(__dirname, '../packages/client/src');
const MANIFEST_PATH = path.resolve(CLIENT_DIR, 'assets/manifest.ts');

function extractTextureKeys(manifestContent: string): Set<string> {
  const keys = new Set<string>();
  // Match string literals in Key/texture/buildingKey/idleKey/walkKey/deathFxKey assignments
  const patterns = [
    /(?:Key|texture|buildingKey|idleKey|walkKey|deathFxKey)\s*:\s*['"]([^'"]+)['"]/g,
    /enemy_\w+/g,
    /tower_\w+/g,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(manifestContent)) !== null) {
      keys.add(match[1] ?? match[0]);
    }
  }
  return keys;
}

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
      results.push(...findTsFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.includes('manifest')) {
      results.push(fullPath);
    }
  }
  return results;
}

function findReferencedKeys(files: string[]): Set<string> {
  const refs = new Set<string>();
  const keyPattern = /['"]([a-z][a-z0-9_]+(?:_[a-z0-9]+)+)['"]/g;
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    let match;
    while ((match = keyPattern.exec(content)) !== null) {
      const key = match[1];
      if (key.includes('tower_') || key.includes('enemy_') || key.includes('fx_') || key.includes('terrain_') || key.includes('tier_')) {
        refs.add(key);
      }
    }
  }
  return refs;
}

// Main
const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf-8');
const manifestKeys = extractTextureKeys(manifestContent);
const tsFiles = findTsFiles(CLIENT_DIR);
const referencedKeys = findReferencedKeys(tsFiles);

const dead = [...manifestKeys].filter(k => !referencedKeys.has(k));
const missing = [...referencedKeys].filter(k => !manifestKeys.has(k));

console.log(`\n📦 Asset Manifest Validator`);
console.log(`   Manifest keys: ${manifestKeys.size}`);
console.log(`   Referenced keys: ${referencedKeys.size}\n`);

if (dead.length > 0) {
  console.log(`⚠️  Dead assets (in manifest, never referenced): ${dead.length}`);
  dead.forEach(k => console.log(`   - ${k}`));
  console.log();
}

if (missing.length > 0) {
  console.log(`❌ Missing assets (referenced in code, not in manifest): ${missing.length}`);
  missing.forEach(k => console.log(`   - ${k}`));
  console.log();
  process.exit(1);
}

if (dead.length === 0 && missing.length === 0) {
  console.log('✅ All assets accounted for!\n');
}

process.exit(0);
