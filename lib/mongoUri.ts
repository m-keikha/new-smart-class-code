const VALID_MONGO_SCHEME = /^mongodb(\+srv)?:\/\//i;

/**
 * Normalizes a MongoDB connection string read from environment variables.
 * Handles common copy-paste issues such as:
 * - Leading/trailing whitespace, newlines, or Unicode BOM/directional marks
 * - Accidental `MONGODB_URI=` (or `KEY=`) prefix pasted into a secret value
 * - Accidental surrounding single, double, or backtick quotes
 */
export function normalizeMongoUri(rawUri: string | undefined): string {
  if (!rawUri || typeof rawUri !== 'string') {
    throw new Error(
      'Please define the MONGODB_URI environment variable in Secrets or .env.local'
    );
  }

  let uri = rawUri
    .replace(/[\u200B-\u200F\u202A-\u202E\uFEFF]/g, '')
    .trim();

  // Strip wrapping quotes before checking for KEY= prefix (e.g. "MONGODB_URI=...")
  uri = stripWrappingQuotes(uri);

  // Strip accidental env assignment prefix such as `MONGODB_URI=mongodb+srv://...`
  const envAssignMatch = uri.match(/^[A-Za-z_][A-Za-z0-9_]*\s*=\s*(.+)$/);
  if (envAssignMatch) {
    uri = envAssignMatch[1].trim();
    uri = stripWrappingQuotes(uri);
  }

  if (!VALID_MONGO_SCHEME.test(uri)) {
    throw new Error(
      'Invalid MONGODB_URI: expected connection string to start with "mongodb://" or "mongodb+srv://"'
    );
  }

  return uri;
}

function stripWrappingQuotes(value: string): string {
  let result = value.trim();
  if (
    result.length >= 2 &&
    ((result.startsWith('"') && result.endsWith('"')) ||
      (result.startsWith("'") && result.endsWith("'")) ||
      (result.startsWith('`') && result.endsWith('`')))
  ) {
    result = result.slice(1, -1).trim();
  }
  return result;
}
