import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = '/tmp/worldmonitor-hive';
const GEO_PATH = path.join(ROOT, 'src/config/geo.ts');
const BASES_PATH = path.join(ROOT, 'src/config/bases-expanded.ts');
const OUTPUT_PATH = '/Users/wayneclub/HIVECOMMAND/hivecommand/src/data/worldIntelSource.generated.json';

const CONFLICT_COUNTRY_ISO = {
  iran: ['IR'],
  ukraine: ['UA'],
  sudan: ['SD'],
  myanmar: ['MM']
};

function extractArrayLiteral(source, exportName) {
  const startToken = `export const ${exportName}`;
  const startIndex = source.indexOf(startToken);
  if (startIndex === -1) throw new Error(`Missing export: ${exportName}`);
  const equalsIndex = source.indexOf('=', startIndex);
  if (equalsIndex === -1) throw new Error(`Missing equals for: ${exportName}`);
  const arrayStart = source.indexOf('[', equalsIndex);
  if (arrayStart === -1) throw new Error(`Missing array start for: ${exportName}`);

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = arrayStart; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }

    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(arrayStart, i + 1);
    }
  }

  throw new Error(`Unclosed array for: ${exportName}`);
}

function evaluateLiteral(literal, exportName) {
  try {
    return vm.runInNewContext(`(${literal})`, {}, { timeout: 5000 });
  } catch (error) {
    throw new Error(`Failed to evaluate ${exportName}: ${error.message}`);
  }
}

async function main() {
  const [geoSource, basesSource] = await Promise.all([
    fs.readFile(GEO_PATH, 'utf8'),
    fs.readFile(BASES_PATH, 'utf8')
  ]);

  const payload = {
    conflictCountryIso: CONFLICT_COUNTRY_ISO,
    hotspots: evaluateLiteral(extractArrayLiteral(geoSource, 'INTEL_HOTSPOTS'), 'INTEL_HOTSPOTS'),
    conflicts: evaluateLiteral(extractArrayLiteral(geoSource, 'CONFLICT_ZONES'), 'CONFLICT_ZONES'),
    nuclear: evaluateLiteral(extractArrayLiteral(geoSource, 'NUCLEAR_FACILITIES'), 'NUCLEAR_FACILITIES'),
    economic: evaluateLiteral(extractArrayLiteral(geoSource, 'ECONOMIC_CENTERS'), 'ECONOMIC_CENTERS'),
    spaceports: evaluateLiteral(extractArrayLiteral(geoSource, 'SPACEPORTS'), 'SPACEPORTS'),
    bases: evaluateLiteral(extractArrayLiteral(basesSource, 'MILITARY_BASES_EXPANDED'), 'MILITARY_BASES_EXPANDED')
  };

  await fs.writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Generated ${OUTPUT_PATH}`);
  console.log(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(payload).map(([key, value]) => [key, Array.isArray(value) ? value.length : Object.keys(value).length])
      ),
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
