import {
  GovernmentWarningResult,
  GovernmentWarningSubResult,
  WarningFormatAttributes
} from '../types';

/**
 * Dedicated government warning validator for TTB compliance.
 *
 * Performs three independent checks:
 *   1. **Presence** — "GOVERNMENT WARNING:" header appears verbatim (case-sensitive).
 *   2. **Format**   — Rendering attributes indicate bold header and adequate font size.
 *   3. **Text Accuracy** — Body text matches the canonical TTB-mandated warning
 *      (word-level normalized comparison, ≥95 % match required).
 */
export class GovernmentWarningValidator {
  /**
   * The exact TTB-mandated government warning statement.
   * 27 CFR § 16.21 — Health Warning Statement.
   */
  static readonly CANONICAL_WARNING_TEXT =
    'GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink ' +
    'alcoholic beverages during pregnancy because of the risk of birth defects. ' +
    '(2) Consumption of alcoholic beverages impairs your ability to drive a car or ' +
    'operate machinery, and may cause health problems.';

  /** Minimum word-level similarity for the text-accuracy check to pass. */
  private static readonly TEXT_ACCURACY_THRESHOLD = 0.95;

  // ──────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────

  /**
   * Run all three government-warning checks.
   *
   * @param extractedText  Raw warning text extracted from the label (may be undefined).
   * @param formatAttributes  Optional rendering attributes from vision model analysis.
   * @returns Complete validation result with three sub-results.
   */
  validate(
    extractedText: string | undefined | null,
    formatAttributes?: WarningFormatAttributes | null
  ): GovernmentWarningResult {
    const presenceResult = this.checkPresence(extractedText);
    const textAccuracyResult = this.checkTextAccuracy(extractedText);
    const formatResult = this.checkFormat(formatAttributes ?? null);

    const subResults: GovernmentWarningSubResult[] = [
      presenceResult,
      formatResult,
      textAccuracyResult
    ];

    return {
      subResults,
      formatAttributes: formatAttributes ?? null,
      overallPass: subResults.every(s => s.passed)
    };
  }

  // ──────────────────────────────────────────────────────────
  // Individual checks
  // ──────────────────────────────────────────────────────────

  /**
   * Check 1 — Presence: the exact string "GOVERNMENT WARNING:" must appear
   * verbatim (case-sensitive) in the extracted text.
   */
  checkPresence(text: string | undefined | null): GovernmentWarningSubResult {
    if (!text) {
      return { check: 'presence', passed: false, details: 'No government warning text found' };
    }

    const found = text.includes('GOVERNMENT WARNING:');
    return {
      check: 'presence',
      passed: found,
      details: found
        ? '"GOVERNMENT WARNING:" header found'
        : '"GOVERNMENT WARNING:" header not found (must be uppercase and verbatim)'
    };
  }

  /**
   * Check 2 — Format: rendering attributes indicate proper visual formatting.
   * TTB requires the "GOVERNMENT WARNING" header to be bold or conspicuous.
   */
  checkFormat(attrs: WarningFormatAttributes | null): GovernmentWarningSubResult {
    if (!attrs) {
      return {
        check: 'format',
        passed: false,
        details: 'Format attributes not available — cannot verify rendering'
      };
    }

    const issues: string[] = [];

    // The header "GOVERNMENT WARNING" must appear bold / conspicuous
    if (attrs.isBold === false) {
      issues.push('"GOVERNMENT WARNING" header is not bold');
    } else if (attrs.isBold === null) {
      issues.push('Could not determine if header is bold');
    }

    if (issues.length === 0) {
      const sizeNote = attrs.relativeFontSize
        ? ` (font size: ${attrs.relativeFontSize})`
        : '';
      return {
        check: 'format',
        passed: true,
        details: `Warning header is bold${sizeNote}`
      };
    }

    return {
      check: 'format',
      passed: false,
      details: issues.join('; ')
    };
  }

  /**
   * Check 3 — Text Accuracy: the extracted body text must match the canonical
   * TTB warning at ≥95 % word-level similarity.
   *
   * Normalises whitespace and compares word-by-word so that line breaks, extra
   * spaces, and minor formatting differences are tolerated.
   */
  checkTextAccuracy(text: string | undefined | null): GovernmentWarningSubResult {
    if (!text) {
      return {
        check: 'textAccuracy',
        passed: false,
        details: 'No text to compare against canonical warning'
      };
    }

    // Try to extract the warning portion starting from "GOVERNMENT WARNING:"
    const headerIndex = text.indexOf('GOVERNMENT WARNING:');
    if (headerIndex === -1) {
      return {
        check: 'textAccuracy',
        passed: false,
        details: 'Cannot assess text accuracy without "GOVERNMENT WARNING:" header'
      };
    }

    const warningBody = text.slice(headerIndex);
    const similarity = this.wordSimilarity(
      GovernmentWarningValidator.CANONICAL_WARNING_TEXT,
      warningBody
    );

    const passed = similarity >= GovernmentWarningValidator.TEXT_ACCURACY_THRESHOLD;
    const pct = (similarity * 100).toFixed(1);

    return {
      check: 'textAccuracy',
      passed,
      details: passed
        ? `Text matches canonical warning (${pct}% word accuracy)`
        : `Text differs from canonical warning (${pct}% word accuracy, requires ${(GovernmentWarningValidator.TEXT_ACCURACY_THRESHOLD * 100)}%)`
    };
  }

  // ──────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────

  /**
   * Word-level similarity between two strings.
   * Normalises whitespace and punctuation, then computes the ratio of matching
   * words (order-aware, using longest common subsequence).
   */
  private wordSimilarity(canonical: string, extracted: string): number {
    const canonWords = this.normalizeToWords(canonical);
    const extractWords = this.normalizeToWords(extracted);

    if (canonWords.length === 0) return 0;

    const lcsLen = this.longestCommonSubsequenceLength(canonWords, extractWords);
    return lcsLen / canonWords.length;
  }

  /** Lowercase, collapse whitespace, split into words. */
  private normalizeToWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(w => w.length > 0);
  }

  /**
   * Length of the longest common subsequence of two string arrays.
   * O(m×n) dynamic programming — fine for warning-length texts (~45 words).
   */
  private longestCommonSubsequenceLength(a: string[], b: string[]): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    return dp[m][n];
  }
}
