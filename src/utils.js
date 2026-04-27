const path = require('path');
const fs = require('fs/promises');
const toml = require('toml');

/**
 * Finds all Cargo.toml files recursively, including inside Anchor `programs/*` or `tests/*`
 */
async function findAllCargoToml(dir){
  const results = [];

  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      if (
        entry.name === 'target' ||
        entry.name === 'node_modules' ||
        entry.name.startsWith('.')
      ) {
        continue;
      }

      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name === 'Cargo.toml') {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

/**
 * Recursively searches for Cargo.toml files and returns true if any contain `litesvm`
 */
async function workspaceHasLitesvmOrMollusk(rootDir) {
  const cargoFiles = await findAllCargoToml(rootDir);

  for (const cargoPath of cargoFiles) {
    try {
      const content = await fs.readFile(cargoPath, 'utf8');
      const parsed = toml.parse(content);

      for (const section of Object.values(parsed)) {
        if (section && typeof section === 'object') {
          if (
            Object.keys(section).some(
              key => key === 'litesvm' || key.startsWith('mollusk')
            )
          ) {
            return true;
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to parse ${cargoPath}:`, e);
    }
  }
  return false;
}

module.exports = { workspaceHasLitesvmOrMollusk };