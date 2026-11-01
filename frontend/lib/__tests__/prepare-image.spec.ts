import { describe, it, expect } from 'vitest';
import { scaledDimensions } from '@/lib/prepare-image';
import { getEvidenceRequirements } from '@veribuy/common/evidence';

describe('scaledDimensions', () => {
  it('leaves images within the limit unchanged', () => {
    expect(scaledDimensions(1200, 800)).toEqual({ width: 1200, height: 800 });
  });

  it('scales the longest edge down to 2048px keeping the aspect ratio', () => {
    expect(scaledDimensions(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    expect(scaledDimensions(3024, 4032)).toEqual({ width: 1536, height: 2048 });
  });
});

describe('getEvidenceRequirements', () => {
  it('never asks for a screen photo for AirPods', () => {
    expect(getEvidenceRequirements('AIRPODS').screen.level).toBe('hidden');
  });

  it('requires a screen photo for phones and makes it optional for consoles', () => {
    expect(getEvidenceRequirements('SMARTPHONE').screen.level).toBe('required');
    expect(getEvidenceRequirements('GAMING_CONSOLE').screen.level).toBe('optional');
  });

  it('falls back to the generic rules for unknown types', () => {
    expect(getEvidenceRequirements('TOASTER')).toEqual(getEvidenceRequirements('OTHER'));
  });
});
