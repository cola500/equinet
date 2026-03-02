#!/usr/bin/env node
/* global console, process */

/**
 * Validates YAML frontmatter in markdown files.
 * No external dependencies -- uses simple regex-based YAML parsing.
 *
 * Usage: node scripts/validate-frontmatter.mjs
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();

const VALID_CATEGORIES = [
  "architecture",
  "operations",
  "security",
  "testing",
  "guide",
  "api",
  "plan",
  "retro",
  "rule",
  "idea",
  "research",
  "sprint",
  "root",
];

const VALID_STATUSES = ["active", "draft", "archived", "wip"];

const REQUIRED_FIELDS = [
  "title",
  "description",
  "category",
  "status",
  "last_updated",
  "sections",
];

const EXCLUDED_DIRS = [
  "node_modules",
  "docs/archive",
  ".claude/agents",
  ".claude/skills",
  ".next",
  ".git",
];

// Directories to scan for .md files
const SCAN_PATHS = [
  "", // root .md files
  "docs",
  ".claude/rules",
  "e2e",
];

/**
 * Recursively find all .md files in a directory, excluding EXCLUDED_DIRS.
 */
async function findMarkdownFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(ROOT, fullPath);

    if (EXCLUDED_DIRS.some((ex) => relPath.startsWith(ex))) {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...(await findMarkdownFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Parse YAML frontmatter from markdown content.
 * Returns null if no frontmatter found.
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result = {};

  let currentKey = null;
  let currentList = null;

  for (const line of yaml.split("\n")) {
    // Skip empty lines and comments
    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    // List item (indented with -)
    const listItemMatch = line.match(/^\s+-\s+(.+)/);
    if (listItemMatch && currentKey) {
      if (!currentList) currentList = [];
      currentList.push(listItemMatch[1].trim().replace(/^["']|["']$/g, ""));
      result[currentKey] = currentList;
      continue;
    }

    // Key: value pair
    const kvMatch = line.match(/^(\w[\w_]*)\s*:\s*(.*)/);
    if (kvMatch) {
      // Save previous list if any
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim();

      if (value === "" || value === "[]") {
        // Start of a list or empty value
        currentList = value === "[]" ? [] : null;
        result[currentKey] = value === "[]" ? [] : "";
      } else if (value.startsWith("[") && value.endsWith("]")) {
        // Inline list: [a, b, c]
        result[currentKey] = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
        currentList = null;
      } else {
        // Simple value
        result[currentKey] = value.replace(/^["']|["']$/g, "");
        currentList = null;
      }
    }
  }

  return result;
}

/**
 * Validate a single file's frontmatter.
 * Returns array of error strings.
 */
function validateFile(relPath, frontmatter) {
  const errors = [];

  if (!frontmatter) {
    errors.push("Missing frontmatter");
    return errors;
  }

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in frontmatter) || frontmatter[field] === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate category
  if (
    frontmatter.category &&
    !VALID_CATEGORIES.includes(frontmatter.category)
  ) {
    errors.push(
      `Invalid category: "${frontmatter.category}" (valid: ${VALID_CATEGORIES.join(", ")})`
    );
  }

  // Validate status
  if (frontmatter.status && !VALID_STATUSES.includes(frontmatter.status)) {
    errors.push(
      `Invalid status: "${frontmatter.status}" (valid: ${VALID_STATUSES.join(", ")})`
    );
  }

  // Validate date format (YYYY-MM-DD)
  if (
    frontmatter.last_updated &&
    !/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.last_updated)
  ) {
    errors.push(
      `Invalid date format: "${frontmatter.last_updated}" (expected YYYY-MM-DD)`
    );
  }

  // Validate sections is an array
  if (frontmatter.sections && !Array.isArray(frontmatter.sections)) {
    errors.push("sections must be a list");
  }

  return errors;
}

// Main
async function main() {
  const allFiles = new Set();

  for (const scanPath of SCAN_PATHS) {
    const fullScanPath = join(ROOT, scanPath);

    try {
      const info = await stat(fullScanPath);
      if (info.isDirectory()) {
        if (scanPath === "") {
          // Root: only scan top-level .md files
          const entries = await readdir(fullScanPath, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile() && entry.name.endsWith(".md")) {
              allFiles.add(join(fullScanPath, entry.name));
            }
          }
        } else {
          const found = await findMarkdownFiles(fullScanPath);
          found.forEach((f) => allFiles.add(f));
        }
      }
    } catch {
      // Directory doesn't exist, skip
    }
  }

  const files = [...allFiles].sort();
  let okCount = 0;
  let errorCount = 0;
  const fileErrors = [];

  for (const file of files) {
    const relPath = relative(ROOT, file);
    const content = await readFile(file, "utf-8");
    const frontmatter = parseFrontmatter(content);
    const errors = validateFile(relPath, frontmatter);

    if (errors.length === 0) {
      okCount++;
    } else {
      errorCount++;
      fileErrors.push({ path: relPath, errors });
    }
  }

  // Report
  console.log(`\nFrontmatter validation: ${files.length} files scanned\n`);

  if (fileErrors.length > 0) {
    console.log(`ERRORS (${errorCount} files):\n`);
    for (const { path, errors } of fileErrors) {
      console.log(`  ${path}`);
      for (const err of errors) {
        console.log(`    - ${err}`);
      }
    }
    console.log();
  }

  console.log(`OK: ${okCount} | Errors: ${errorCount} | Total: ${files.length}`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(2);
});
