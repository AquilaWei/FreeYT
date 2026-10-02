import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

// Only what the browser needs at runtime; tests, scripts, node_modules and the icon source (assets/) stay out.
const SHIPPED_FILES = ['manifest.json', 'popup.html'];
const SHIPPED_DIRS = ['icons', 'src'];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

// Own CRC-32: zlib.crc32 is missing on older Node 20/22 releases.
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Fixed timestamp (1980-01-01) so the same sources always give the same archive.
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;

/** Builds a zip archive (deflate, no zip64) from `[{ name, data }]`; names use `/` separators. */
export function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + packed.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

/** Lists the files to ship, sorted so the archive is reproducible. */
export function collectFiles(baseDir) {
  const names = [...SHIPPED_FILES];
  for (const dir of SHIPPED_DIRS) {
    for (const file of readdirSync(join(baseDir, dir)).sort()) names.push(`${dir}/${file}`);
  }
  return names.map((name) => ({ name, data: readFileSync(join(baseDir, name)) }));
}

/** Writes `<outDir>/freeyt-<version>.zip` and returns its path. Throws if a shipped file is missing. */
export function build(baseDir = root, outDir = join(baseDir, 'dist')) {
  const { version } = JSON.parse(readFileSync(join(baseDir, 'package.json'), 'utf8'));
  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, `freeyt-${version}.zip`);
  writeFileSync(target, createZip(collectFiles(baseDir)));
  return target;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(build());
