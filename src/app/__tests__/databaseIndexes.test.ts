import * as fs from 'fs';
import * as path from 'path';

describe('Database Schema & Index Specifications', () => {
  const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
  let schemaContent: string;

  beforeAll(() => {
    schemaContent = fs.readFileSync(schemaPath, 'utf8');
  });

  it('declares compound index on Test (userId, createdAt)', () => {
    expect(schemaContent).toContain('@@index([userId, createdAt])');
  });

  it('declares compound index on Test (userId, idempotencyKey)', () => {
    expect(schemaContent).toContain('@@index([userId, idempotencyKey])');
  });

  it('declares compound index on TestAttempt (userId, createdAt)', () => {
    expect(schemaContent).toContain('@@index([userId, createdAt])');
  });

  it('declares leaderboard compound index on TestAttempt (testId, score, createdAt)', () => {
    expect(schemaContent).toContain('@@index([testId, score, createdAt])');
  });

  it('declares compound index on DescriptiveTest (userId, createdAt)', () => {
    expect(schemaContent).toContain('@@index([userId, createdAt])');
  });

  it('does not have unsupported non-sparse unique index on nullable phone', () => {
    // phone String? must NOT have @unique in Mongo schema because multiple nulls violate Mongo unique constraint
    const phoneLine = schemaContent.split('\n').find((line) => line.trim().startsWith('phone'));
    expect(phoneLine).toBeDefined();
    expect(phoneLine).not.toContain('@unique');
  });
});
