import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeacherSessionToken,
  verifyTeacherSessionToken,
  resolveTeacherClassId,
  escapeRegExp,
  TEACHER_SESSION_TTL_MS,
} from './teacherSession';

const SECRET = 'test-secret-key-for-unit-tests';
const CLASS_ID = '6b0060c1eca8dfac918c7d14';
const NOW = 1_700_000_000_000;

test('createTeacherSessionToken & verifyTeacherSessionToken round-trip succeeds', () => {
  const token = createTeacherSessionToken(CLASS_ID, NOW, SECRET);
  assert.equal(verifyTeacherSessionToken(token, NOW + 1000, SECRET), CLASS_ID);
});

test('verifyTeacherSessionToken rejects tampered classId or signature', () => {
  const token = createTeacherSessionToken(CLASS_ID, NOW, SECRET);
  const parts = token.split('.');
  const tamperedId = `6b0060c1eca8dfac918c7d15.${parts[1]}.${parts[2]}`;
  assert.equal(verifyTeacherSessionToken(tamperedId, NOW + 1000, SECRET), null);

  const tamperedSig = `${parts[0]}.${parts[1]}.${'a'.repeat(64)}`;
  assert.equal(verifyTeacherSessionToken(tamperedSig, NOW + 1000, SECRET), null);
});

test('verifyTeacherSessionToken rejects expired tokens', () => {
  const token = createTeacherSessionToken(CLASS_ID, NOW, SECRET);
  assert.equal(
    verifyTeacherSessionToken(token, NOW + TEACHER_SESSION_TTL_MS + 1, SECRET),
    null
  );
});

test('verifyTeacherSessionToken rejects raw unsigned ObjectId', () => {
  assert.equal(verifyTeacherSessionToken(CLASS_ID, NOW, SECRET), null);
});

test('resolveTeacherClassId accepts signed client token when cookie is missing (iframe fallback)', () => {
  const token = createTeacherSessionToken(CLASS_ID, NOW, SECRET);
  assert.equal(
    resolveTeacherClassId(undefined, token, NOW + 5000, SECRET),
    CLASS_ID
  );
});

test('resolveTeacherClassId rejects raw unsigned ObjectId passed as client token', () => {
  assert.equal(
    resolveTeacherClassId(undefined, CLASS_ID, NOW + 5000, SECRET),
    null
  );
});

test('resolveTeacherClassId preserves backward compatibility with legacy raw ObjectId cookie', () => {
  assert.equal(
    resolveTeacherClassId(CLASS_ID, undefined, NOW + 5000, SECRET),
    CLASS_ID
  );
});

test('resolveTeacherClassId accepts signed cookie directly', () => {
  const token = createTeacherSessionToken(CLASS_ID, NOW, SECRET);
  assert.equal(
    resolveTeacherClassId(token, undefined, NOW + 5000, SECRET),
    CLASS_ID
  );
});

test('escapeRegExp safely escapes email special characters', () => {
  const escaped = escapeRegExp('teacher+1.test@example.com');
  const re = new RegExp(`^${escaped}$`, 'i');
  assert.equal(re.test('TEACHER+1.TEST@EXAMPLE.COM'), true);
  assert.equal(re.test('teacherX1Ytest@example.com'), false);
});
