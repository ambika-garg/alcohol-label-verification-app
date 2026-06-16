import { GovernmentWarningValidator } from '../services/governmentWarningValidator';
import type { WarningFormatAttributes } from '../types';

const validator = new GovernmentWarningValidator();

const CANONICAL =
  'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink ' +
  'alcoholic beverages during pregnancy because of the risk of birth defects. ' +
  '(2) Consumption of alcoholic beverages impairs your ability to drive a car or ' +
  'operate machinery, and may cause health problems.';

describe('GovernmentWarningValidator', () => {
  // ──────────────────────────────────────────────────────────
  // Test 1 — Exact canonical text, with valid format attrs
  // ──────────────────────────────────────────────────────────
  it('should pass all checks for exact canonical text with valid format', () => {
    const attrs: WarningFormatAttributes = { isBold: true, relativeFontSize: 'normal', isAllCaps: null };
    const result = validator.validate(CANONICAL, attrs);

    expect(result.overallPass).toBe(true);
    expect(result.subResults).toHaveLength(3);

    const presence = result.subResults.find(s => s.check === 'presence');
    const format = result.subResults.find(s => s.check === 'format');
    const text = result.subResults.find(s => s.check === 'textAccuracy');

    expect(presence?.passed).toBe(true);
    expect(format?.passed).toBe(true);
    expect(text?.passed).toBe(true);
  });

  // ──────────────────────────────────────────────────────────
  // Test 2 — Missing "GOVERNMENT WARNING:" prefix
  // ──────────────────────────────────────────────────────────
  it('should fail presence when header is missing', () => {
    const noHeader =
      '(1) According to the Surgeon General, women should not drink ' +
      'alcoholic beverages during pregnancy because of the risk of birth defects. ' +
      '(2) Consumption of alcoholic beverages impairs your ability to drive a car or ' +
      'operate machinery, and may cause health problems.';

    const result = validator.validate(noHeader);
    const presence = result.subResults.find(s => s.check === 'presence');
    const text = result.subResults.find(s => s.check === 'textAccuracy');

    expect(presence?.passed).toBe(false);
    expect(text?.passed).toBe(false);
    expect(result.overallPass).toBe(false);
  });

  // ──────────────────────────────────────────────────────────
  // Test 3 — Lowercase header "government warning:"
  // ──────────────────────────────────────────────────────────
  it('should fail presence for lowercase header', () => {
    const lowercase = CANONICAL.replace('GOVERNMENT WARNING:', 'government warning:');
    const result = validator.validate(lowercase);
    const presence = result.subResults.find(s => s.check === 'presence');

    expect(presence?.passed).toBe(false);
    expect(result.overallPass).toBe(false);
  });

  // ──────────────────────────────────────────────────────────
  // Test 4 — Correct header, truncated body
  // ──────────────────────────────────────────────────────────
  it('should pass presence but fail text accuracy for truncated body', () => {
    const truncated = 'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink';
    const result = validator.validate(truncated);
    const presence = result.subResults.find(s => s.check === 'presence');
    const text = result.subResults.find(s => s.check === 'textAccuracy');

    expect(presence?.passed).toBe(true);
    expect(text?.passed).toBe(false);
    expect(result.overallPass).toBe(false);
  });

  // ──────────────────────────────────────────────────────────
  // Test 5 — Minor OCR typos (within 95% threshold)
  // ──────────────────────────────────────────────────────────
  it('should pass text accuracy for minor OCR typos', () => {
    // Replace 2 words out of ~45 — well within 95%
    const minorTypos = CANONICAL
      .replace('Surgeon General', 'Surgean General')
      .replace('machinery', 'machnery');

    const result = validator.validate(minorTypos);
    const presence = result.subResults.find(s => s.check === 'presence');
    const text = result.subResults.find(s => s.check === 'textAccuracy');

    expect(presence?.passed).toBe(true);
    expect(text?.passed).toBe(true);
  });

  // ──────────────────────────────────────────────────────────
  // Test 6 — Major OCR errors (below 95% threshold)
  // ──────────────────────────────────────────────────────────
  it('should fail text accuracy for major OCR errors', () => {
    const majorErrors =
      'GOVERNMENT WARNING: (1) Accrdng t0 th3 Surgen Gneral, w0men ' +
      'shld nt drnk alc0h0lic bvrgs durng prgncy bcz of th rsk ' +
      'of brth dfcts. (2) Cnsmptn of alc0h0lic bvrgs impr yr ablty ' +
      'to drv a cr or oprt mchnry, and my cs hlth prblms.';

    const result = validator.validate(majorErrors);
    const presence = result.subResults.find(s => s.check === 'presence');
    const text = result.subResults.find(s => s.check === 'textAccuracy');

    expect(presence?.passed).toBe(true);
    expect(text?.passed).toBe(false);
    expect(result.overallPass).toBe(false);
  });

  // ──────────────────────────────────────────────────────────
  // Test 7 — Empty string input
  // ──────────────────────────────────────────────────────────
  it('should fail all checks for empty string', () => {
    const result = validator.validate('');

    expect(result.overallPass).toBe(false);
    result.subResults.forEach(sub => {
      expect(sub.passed).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Test 8 — Undefined input
  // ──────────────────────────────────────────────────────────
  it('should fail all checks for undefined input', () => {
    const result = validator.validate(undefined as unknown as string);

    expect(result.overallPass).toBe(false);
    result.subResults.forEach(sub => {
      expect(sub.passed).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Test 9 — Format check: bold + normal size
  // ──────────────────────────────────────────────────────────
  it('should pass format check when bold and normal size', () => {
    const attrs: WarningFormatAttributes = { isBold: true, relativeFontSize: 'normal', isAllCaps: null };
    const result = validator.validate(CANONICAL, attrs);
    const format = result.subResults.find(s => s.check === 'format');

    expect(format?.passed).toBe(true);
  });

  // ──────────────────────────────────────────────────────────
  // Test 10 — Format check: not bold
  // ──────────────────────────────────────────────────────────
  it('should fail format check when not bold', () => {
    const attrs: WarningFormatAttributes = { isBold: false, relativeFontSize: 'normal', isAllCaps: null };
    const result = validator.validate(CANONICAL, attrs);
    const format = result.subResults.find(s => s.check === 'format');

    expect(format?.passed).toBe(false);
    expect(result.overallPass).toBe(false);
  });

  // ──────────────────────────────────────────────────────────
  // Test 11 — Format check: null attrs (no image analysis)
  // ──────────────────────────────────────────────────────────
  it('should fail format check when attributes are null', () => {
    const result = validator.validate(CANONICAL, null);
    const format = result.subResults.find(s => s.check === 'format');

    expect(format?.passed).toBe(false);
    expect(format?.details).toContain('not available');
  });

  // ──────────────────────────────────────────────────────────
  // Test 12 — Extra whitespace / line breaks in text
  // ──────────────────────────────────────────────────────────
  it('should handle extra whitespace and line breaks', () => {
    const withWhitespace = CANONICAL
      .replace('women should', 'women  should')
      .replace('drive a car', 'drive  a  car')
      .replace('birth defects.', 'birth defects.\n');

    const result = validator.validate(withWhitespace);
    const presence = result.subResults.find(s => s.check === 'presence');
    const text = result.subResults.find(s => s.check === 'textAccuracy');

    expect(presence?.passed).toBe(true);
    expect(text?.passed).toBe(true);
  });

  // ──────────────────────────────────────────────────────────
  // Test 13 — Warning with extra text before/after
  // ──────────────────────────────────────────────────────────
  it('should pass when canonical text is embedded in surrounding text', () => {
    const withSurroundingText =
      'Some label preamble text here. ' + CANONICAL + ' Additional info follows.';

    const result = validator.validate(withSurroundingText);
    const presence = result.subResults.find(s => s.check === 'presence');
    const text = result.subResults.find(s => s.check === 'textAccuracy');

    expect(presence?.passed).toBe(true);
    expect(text?.passed).toBe(true);
  });

  // ──────────────────────────────────────────────────────────
  // Test 14 — Overall pass requires all three checks
  // ──────────────────────────────────────────────────────────
  it('should only set overallPass when all three sub-results pass', () => {
    // Presence ✅, Text ✅, Format ❌ (not bold)
    const attrs: WarningFormatAttributes = { isBold: false, relativeFontSize: 'normal', isAllCaps: null };
    const result = validator.validate(CANONICAL, attrs);

    expect(result.subResults.find(s => s.check === 'presence')?.passed).toBe(true);
    expect(result.subResults.find(s => s.check === 'textAccuracy')?.passed).toBe(true);
    expect(result.subResults.find(s => s.check === 'format')?.passed).toBe(false);
    expect(result.overallPass).toBe(false);
  });

  // ──────────────────────────────────────────────────────────
  // Test: default format (no attrs provided) still allows presence + text
  // ──────────────────────────────────────────────────────────
  it('should pass presence and text accuracy even without format attrs', () => {
    const result = validator.validate(CANONICAL);
    const presence = result.subResults.find(s => s.check === 'presence');
    const text = result.subResults.find(s => s.check === 'textAccuracy');

    expect(presence?.passed).toBe(true);
    expect(text?.passed).toBe(true);
    // Overall should be false because format failed (no attrs)
    expect(result.overallPass).toBe(false);
  });

  // ──────────────────────────────────────────────────────────
  // Test: CANONICAL_WARNING_TEXT is exported for re-use
  // ──────────────────────────────────────────────────────────
  it('should export the canonical warning text constant', () => {
    expect(GovernmentWarningValidator.CANONICAL_WARNING_TEXT).toBeDefined();
    expect(GovernmentWarningValidator.CANONICAL_WARNING_TEXT).toContain('GOVERNMENT WARNING:');
    expect(GovernmentWarningValidator.CANONICAL_WARNING_TEXT).toContain('Surgeon General');
    expect(GovernmentWarningValidator.CANONICAL_WARNING_TEXT).toContain('birth defects');
    expect(GovernmentWarningValidator.CANONICAL_WARNING_TEXT).toContain('health problems');
  });

  // ──────────────────────────────────────────────────────────
  // Test: format with bold header + large/small font
  // ──────────────────────────────────────────────────────────
  it('should pass format check for bold with small or large font size', () => {
    const attrsSmall: WarningFormatAttributes = { isBold: true, relativeFontSize: 'small', isAllCaps: null };
    const attrsLarge: WarningFormatAttributes = { isBold: true, relativeFontSize: 'large', isAllCaps: null };

    const resultSmall = validator.validate(CANONICAL, attrsSmall);
    const resultLarge = validator.validate(CANONICAL, attrsLarge);

    // Bold is the key requirement — font size is informational
    expect(resultSmall.subResults.find(s => s.check === 'format')?.passed).toBe(true);
    expect(resultLarge.subResults.find(s => s.check === 'format')?.passed).toBe(true);
  });
});
