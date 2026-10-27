/**
 * SQLite File Format Specification & Header Detection
 * The official SQLite format starts with the exact 16-byte header:
 * "SQLite format 3\000" (53 51 4c 69 74 65 20 66 6f 72 6d 61 74 20 33 00)
 */

export const SQLITE_MAGIC_HEADER = 'SQLite format 3\0';

export const COMMON_SQLITE_EXTENSIONS = [
  '.db',
  '.sqlite',
  '.sqlite3',
  '.db3',
  '.s3db',
  '.sl3',
  '.sqlitedb',
  '.gpkg', // OGC GeoPackage (SQLite 3 container)
  '.mbtiles', // Mapbox Vector/Raster Tiles (SQLite 3 container)
] as const;

/**
 * Validates whether a given byte array begins with the SQLite 3 magic header.
 */
export function isSqliteDatabase(buffer: Uint8Array | ArrayBuffer): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 16) return false;

  const header = new TextDecoder().decode(bytes.subarray(0, 16));
  return header === SQLITE_MAGIC_HEADER;
}
