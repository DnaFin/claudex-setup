#!/usr/bin/env node

/**
 * Generate a CycloneDX SBOM (Software Bill of Materials) in JSON format.
 *
 * Reads package.json and package-lock.json from the project root, then produces
 * sbom.cdx.json with component name, version, license, purl, and hashes.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');

function readJsonFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

function computeSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function packageToPurl(name, version) {
  // purl format: pkg:npm/<namespace>/<name>@<version> or pkg:npm/<name>@<version>
  const encoded = name.replace(/^@/, '%40').replace(/\//, '%2F');
  return `pkg:npm/${encoded}@${version}`;
}

function extractLicense(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (typeof pkg.license === 'object' && pkg.license.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses) && pkg.licenses.length > 0) {
    return pkg.licenses.map(l => l.type || l).join(' OR ');
  }
  return 'NOASSERTION';
}

function buildComponents(lockfilePackages) {
  const components = [];

  for (const [pkgPath, pkgData] of Object.entries(lockfilePackages)) {
    // Skip the root package (empty string key)
    if (!pkgPath || pkgPath === '') continue;

    // Extract package name from the path (e.g., "node_modules/@scope/name" -> "@scope/name")
    const name = pkgPath.replace(/^node_modules\//, '');
    if (!name || name.startsWith('.')) continue;

    const version = pkgData.version || '0.0.0';
    const license = extractLicense(pkgData);
    const purl = packageToPurl(name, version);

    const component = {
      type: 'library',
      name,
      version,
      purl,
      licenses: [{
        license: {
          id: license !== 'NOASSERTION' ? license : undefined,
          name: license === 'NOASSERTION' ? 'NOASSERTION' : undefined,
        },
      }],
    };

    // Add integrity hash if available
    if (pkgData.integrity) {
      const hashes = [];
      const parts = pkgData.integrity.split(' ');
      for (const part of parts) {
        const [alg, hash] = part.split('-');
        if (alg === 'sha512') {
          hashes.push({
            alg: 'SHA-512',
            content: Buffer.from(hash, 'base64').toString('hex'),
          });
        } else if (alg === 'sha256') {
          hashes.push({
            alg: 'SHA-256',
            content: Buffer.from(hash, 'base64').toString('hex'),
          });
        } else if (alg === 'sha1') {
          hashes.push({
            alg: 'SHA-1',
            content: Buffer.from(hash, 'base64').toString('hex'),
          });
        }
      }
      if (hashes.length > 0) {
        component.hashes = hashes;
      }
    }

    components.push(component);
  }

  return components.sort((a, b) => a.name.localeCompare(b.name));
}

function generateSbom() {
  const pkgPath = path.join(ROOT, 'package.json');
  const lockPath = path.join(ROOT, 'package-lock.json');

  if (!fs.existsSync(pkgPath)) {
    console.error('Error: package.json not found at', pkgPath);
    process.exit(1);
  }
  if (!fs.existsSync(lockPath)) {
    console.error('Error: package-lock.json not found at', lockPath);
    process.exit(1);
  }

  const pkg = readJsonFile(pkgPath);
  const lock = readJsonFile(lockPath);

  const packages = lock.packages || {};
  const components = buildComponents(packages);

  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{
        vendor: 'Nerviq',
        name: 'generate-sbom',
        version: '1.0.0',
      }],
      component: {
        type: 'application',
        name: pkg.name || 'unknown',
        version: pkg.version || '0.0.0',
        purl: packageToPurl(pkg.name || 'unknown', pkg.version || '0.0.0'),
        licenses: [{
          license: {
            id: extractLicense(pkg),
          },
        }],
      },
    },
    components,
  };

  // Add hash of package-lock.json itself for reproducibility
  const lockHash = computeSha256(lockPath);
  if (lockHash) {
    sbom.metadata.properties = [{
      name: 'nerviq:lockfile-hash',
      value: `sha256:${lockHash}`,
    }];
  }

  const outputPath = path.join(ROOT, 'sbom.cdx.json');
  fs.writeFileSync(outputPath, JSON.stringify(sbom, null, 2), 'utf8');

  console.log(`SBOM generated: ${outputPath}`);
  console.log(`  Format: CycloneDX ${sbom.specVersion}`);
  console.log(`  Components: ${components.length}`);
  console.log(`  Root: ${pkg.name}@${pkg.version}`);

  return { outputPath, componentCount: components.length, sbom };
}

// Run if invoked directly
if (require.main === module) {
  generateSbom();
}

module.exports = { generateSbom, buildComponents, packageToPurl, extractLicense };
