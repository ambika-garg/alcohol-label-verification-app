import { LabelVerificationService } from '../services/labelVerificationService';
import type { LabelData, FieldVerification } from '../types';

const service = new LabelVerificationService();

/** Helper to get a field verification from createVerificationResult */
function verifyField(
  fieldName: string,
  expectedValue: string | undefined,
  extractedValue: string | undefined
): FieldVerification {
  const extracted: LabelData = { [fieldName]: extractedValue };
  const application: LabelData = { [fieldName]: expectedValue };
  const result = service.createVerificationResult(
    'test', 'test.png', extracted, application, 10
  );
  return result.fieldVerifications.find(v => v.fieldName === fieldName)!;
}

describe('Three-tier matching: exact / probable / mismatch', () => {
  // ──────────────────────────────────────────────────────────
  // EXACT MATCH TIER
  // ──────────────────────────────────────────────────────────
  describe('Exact match tier', () => {
    it('should return matchTier "exact" for identical strings', () => {
      const v = verifyField('brandName', 'OLD TOM DISTILLERY', 'OLD TOM DISTILLERY');
      expect(v.matchTier).toBe('exact');
      expect(v.isMatch).toBe(true);
      expect(v.confidence).toBe(1.0);
    });

    it('should return matchTier "exact" for identical numeric values', () => {
      const v = verifyField('alcoholContent', '40% Alc./Vol.', '40% Alc./Vol.');
      expect(v.matchTier).toBe('exact');
      expect(v.isMatch).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────
  // PROBABLE MATCH TIER
  // ──────────────────────────────────────────────────────────
  describe('Probable match tier', () => {
    it('should treat "STONE\'S THROW" and "Stone\'s Throw" as probable match (case difference)', () => {
      const v = verifyField('brandName', "STONE'S THROW", "Stone's Throw");
      expect(v.matchTier).toBe('probable');
      expect(v.isMatch).toBe(true);
      expect(v.confidence).toBeGreaterThanOrEqual(0.85);
      expect(v.notes).toContain('Probable match');
    });

    it('should treat strings differing only in punctuation as probable match', () => {
      const v = verifyField('brandName', "MAKER'S MARK", 'MAKERS MARK');
      expect(v.matchTier).toBe('probable');
      expect(v.isMatch).toBe(true);
    });

    it('should treat strings differing only in whitespace as probable match', () => {
      const v = verifyField('bottlerName', 'Jack  Daniel Distillery', 'Jack Daniel Distillery');
      expect(v.matchTier).toBe('probable');
      expect(v.isMatch).toBe(true);
    });

    it('should treat strings with case + punctuation differences as probable match', () => {
      const v = verifyField('brandName', "GENTLEMAN JACK", 'Gentleman Jack');
      expect(v.matchTier).toBe('probable');
      expect(v.isMatch).toBe(true);
    });

    it('should return probable match for minor OCR typos within Levenshtein threshold', () => {
      // 1 character difference in a long brand name
      const v = verifyField('brandName', 'WOODFORD RESERVE', 'WOODFORD RESERVF');
      expect(v.matchTier).toBe('probable');
      expect(v.isMatch).toBe(true);
      expect(v.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('should return probable match for "Kentucky Straight Bourbon" vs "KENTUCKY STRAIGHT BOURBON"', () => {
      const v = verifyField('classType', 'Kentucky Straight Bourbon Whiskey', 'KENTUCKY STRAIGHT BOURBON WHISKEY');
      expect(v.matchTier).toBe('probable');
      expect(v.isMatch).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────
  // MISMATCH TIER
  // ──────────────────────────────────────────────────────────
  describe('Mismatch tier', () => {
    it('should return matchTier "mismatch" for completely different strings', () => {
      const v = verifyField('brandName', 'OLD TOM DISTILLERY', 'WILD TURKEY');
      expect(v.matchTier).toBe('mismatch');
      expect(v.isMatch).toBe(false);
    });

    it('should return matchTier "mismatch" for different alcohol content', () => {
      const v = verifyField('alcoholContent', '40% Alc./Vol.', '12% Alc./Vol.');
      expect(v.matchTier).toBe('mismatch');
      expect(v.isMatch).toBe(false);
    });

    it('should return matchTier "mismatch" for different countries', () => {
      const v = verifyField('countryOfOrigin', 'United States', 'Scotland');
      expect(v.matchTier).toBe('mismatch');
      expect(v.isMatch).toBe(false);
    });

    it('should return matchTier "mismatch" for significantly different strings', () => {
      const v = verifyField('brandName', 'MAKERS MARK', 'ABSOLUT VODKA');
      expect(v.matchTier).toBe('mismatch');
      expect(v.isMatch).toBe(false);
      expect(v.confidence).toBeLessThan(0.85);
    });
  });

  // ──────────────────────────────────────────────────────────
  // EDGE CASES
  // ──────────────────────────────────────────────────────────
  describe('Edge cases', () => {
    it('should skip verification (no matchTier) when no expected value', () => {
      const v = verifyField('bottlerName', undefined, 'Some Bottler');
      expect(v.matchTier).toBeUndefined();
      expect(v.isMatch).toBe(true); // skipped = not a failure
      expect(v.notes).toContain('No value to verify');
    });

    it('should return mismatch when expected is present but extracted is missing', () => {
      const v = verifyField('brandName', 'OLD TOM', undefined);
      expect(v.matchTier).toBe('mismatch');
      expect(v.isMatch).toBe(false);
    });

    it('should not assign matchTier to government warning (handled by dedicated validator)', () => {
      const v = verifyField(
        'governmentWarning',
        'GOVERNMENT WARNING: (1) test',
        'GOVERNMENT WARNING: (1) test'
      );
      // Government warning uses its own validator, not the three-tier system
      expect(v.governmentWarningResult).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────
  // NORMALIZED COMPARISON LOGIC
  // ──────────────────────────────────────────────────────────
  describe('Normalized comparison', () => {
    it('should normalize by collapsing whitespace', () => {
      const v = verifyField('brandName', 'OLD   TOM   DISTILLERY', 'OLD TOM DISTILLERY');
      // After normalization, these are identical → probable (since raw strings differ)
      expect(v.matchTier).toBe('probable');
      expect(v.isMatch).toBe(true);
    });

    it('should normalize by stripping punctuation', () => {
      const v = verifyField('brandName', 'O.L.D. TOM', 'OLD TOM');
      expect(v.matchTier).toBe('probable');
      expect(v.isMatch).toBe(true);
    });

    it('should normalize by lowercasing', () => {
      const v = verifyField('brandName', 'old tom', 'OLD TOM');
      expect(v.matchTier).toBe('probable');
      expect(v.isMatch).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────
  // matchTier in VerificationResult
  // ──────────────────────────────────────────────────────────
  describe('VerificationResult integration', () => {
    it('should count probable matches towards matchPercentage', () => {
      const extracted: LabelData = {
        brandName: "Stone's Throw",   // probable match
        alcoholContent: '40% Alc./Vol.',  // exact match
      };
      const application: LabelData = {
        brandName: "STONE'S THROW",
        alcoholContent: '40% Alc./Vol.',
      };
      const result = service.createVerificationResult(
        'test', 'test.png', extracted, application, 10
      );

      // Both should count as matches
      const brand = result.fieldVerifications.find(v => v.fieldName === 'brandName');
      const abv = result.fieldVerifications.find(v => v.fieldName === 'alcoholContent');
      expect(brand?.matchTier).toBe('probable');
      expect(abv?.matchTier).toBe('exact');
      expect(brand?.isMatch).toBe(true);
      expect(abv?.isMatch).toBe(true);
    });
  });
});
