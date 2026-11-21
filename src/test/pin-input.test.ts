import { describe, expect, it } from 'vitest';
import { sanitizePinInput } from '@/lib/pin-input';

describe('sanitizePinInput', () => {
  it('should keep all 6 digits when pasted PIN contains a space', () => {
    expect(sanitizePinInput('908 358')).toBe('908358');
  });

  it('should strip non-digit characters', () => {
    expect(sanitizePinInput(' 9-0a8\t358 ')).toBe('908358');
  });

  it('should cap the result at 6 digits', () => {
    expect(sanitizePinInput('1234567890')).toBe('123456');
  });
});
