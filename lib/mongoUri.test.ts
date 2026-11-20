import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMongoUri } from './mongoUri';

test('accepts standard mongodb+srv and mongodb URIs', () => {
  const srv = 'mongodb+srv://user:pass@cluster0.example.mongodb.net/school?retryWrites=true&w=majority';
  const std = 'mongodb://localhost:27017/school';
  assert.equal(normalizeMongoUri(srv), srv);
  assert.equal(normalizeMongoUri(std), std);
});

test('strips accidental MONGODB_URI= prefix', () => {
  const raw = 'MONGODB_URI=mongodb+srv://user:pass@cluster0.example.mongodb.net/school';
  assert.equal(
    normalizeMongoUri(raw),
    'mongodb+srv://user:pass@cluster0.example.mongodb.net/school'
  );
});

test('strips surrounding quotes and whitespace', () => {
  assert.equal(
    normalizeMongoUri('  "mongodb+srv://user:pass@cluster.example.net/db"  '),
    'mongodb+srv://user:pass@cluster.example.net/db'
  );
  assert.equal(
    normalizeMongoUri("MONGODB_URI='mongodb://127.0.0.1:27017/test'\n"),
    'mongodb://127.0.0.1:27017/test'
  );
});

test('strips invisible BOM and RTL/LTR directional marks', () => {
  const withRtlMarks = '\u200F\uFEFFMONGODB_URI=mongodb+srv://user:pass@cluster.example.net/db\u200E';
  assert.equal(
    normalizeMongoUri(withRtlMarks),
    'mongodb+srv://user:pass@cluster.example.net/db'
  );
});

test('throws clear error when missing or invalid scheme', () => {
  assert.throws(() => normalizeMongoUri(undefined), /MONGODB_URI/);
  assert.throws(() => normalizeMongoUri('   '), /Invalid MONGODB_URI/);
  assert.throws(() => normalizeMongoUri('https://example.com'), /mongodb:\/\//);
});
