import { describe, it, expect } from 'vitest';
import {
  TEMPLATES, SAMPLE_BUSINESS, LAUNCH_STEPS, STATUS_META, GRADUATION_THRESHOLDS,
  getTemplate, isTitanReady,
} from '@/lib/nbf/business';

describe('TEC NBF — Business Foundation Runtime (C-124), read-only V1', () => {
  it('offers business templates each with a checklist', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(5);
    for (const t of TEMPLATES) {
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.checklist.length).toBeGreaterThan(0);
      // every template ends in Zone verification — NBF never self-verifies
      expect(t.checklist.some((c) => c.toLowerCase().includes('zone'))).toBe(true);
    }
  });

  it('the launch funnel is the 25-minute flow (C-124)', () => {
    expect(LAUNCH_STEPS.length).toBe(5);
    const declaredMinutes = LAUNCH_STEPS.reduce((sum, s) => sum + s.minutes, 0);
    expect(declaredMinutes).toBe(25);   // async Zone step is 0 (1–7 days)
  });

  it('the sample business is Zone-verified and presents analytics (never asserts truth)', () => {
    expect(SAMPLE_BUSINESS.zoneVerified).toBe(true);
    expect(STATUS_META[SAMPLE_BUSINESS.status]).toBeTruthy();
    expect(SAMPLE_BUSINESS.analytics.piReceived).toBeGreaterThanOrEqual(0);
  });

  it('GRADUATION (C-124 → Titan C-130): titanReady iff a threshold is exceeded', () => {
    // sample is below all thresholds → not ready
    expect(isTitanReady(SAMPLE_BUSINESS.graduation)).toBe(false);
    expect(SAMPLE_BUSINESS.graduation.titanReady).toBe(false);
    // exceed one threshold → ready
    const grown = { ...SAMPLE_BUSINESS.graduation, monthlyRevenuePi: GRADUATION_THRESHOLDS.monthlyRevenuePi + 1 };
    expect(isTitanReady(grown)).toBe(true);
  });

  it('getTemplate resolves by type and fails closed for an unknown type', () => {
    expect(getTemplate('STORE')?.label).toBe('Pi Store');
    expect(getTemplate('nope')).toBeNull();
  });
});
