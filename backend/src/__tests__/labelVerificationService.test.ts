import { LabelVerificationService } from '../services/labelVerificationService';
import { GovernmentWarningValidator } from '../services/governmentWarningValidator';
import type { LabelData } from '../types';

const service = new LabelVerificationService();

describe('LabelVerificationService — government warning integration', () => {
  const CANONICAL = GovernmentWarningValidator.CANONICAL_WARNING_TEXT;

  it('should include governmentWarningResult in field verification for governmentWarning', () => {
    const extractedData: LabelData = {
      brandName: 'TEST BRAND',
      alcoholContent: '40% Alc./Vol.',
      governmentWarning: CANONICAL
    };

    const applicationData: LabelData = {
      brandName: 'TEST BRAND',
      alcoholContent: '40% Alc./Vol.',
      governmentWarning: CANONICAL
    };

    const result = service.createVerificationResult(
      'test-1', 'label.png', extractedData, applicationData, 100
    );

    const gwVerification = result.fieldVerifications.find(
      v => v.fieldName === 'governmentWarning'
    );

    expect(gwVerification).toBeDefined();
    expect(gwVerification?.governmentWarningResult).toBeDefined();
    expect(gwVerification?.governmentWarningResult?.subResults).toHaveLength(3);

    const presence = gwVerification?.governmentWarningResult?.subResults.find(
      s => s.check === 'presence'
    );
    const textAccuracy = gwVerification?.governmentWarningResult?.subResults.find(
      s => s.check === 'textAccuracy'
    );

    expect(presence?.passed).toBe(true);
    expect(textAccuracy?.passed).toBe(true);
  });

  it('should not include governmentWarningResult for non-warning fields', () => {
    const extractedData: LabelData = {
      brandName: 'TEST BRAND',
      alcoholContent: '40% Alc./Vol.'
    };

    const applicationData: LabelData = {
      brandName: 'TEST BRAND',
      alcoholContent: '40% Alc./Vol.'
    };

    const result = service.createVerificationResult(
      'test-2', 'label.png', extractedData, applicationData, 50
    );

    const brandVerification = result.fieldVerifications.find(
      v => v.fieldName === 'brandName'
    );

    expect(brandVerification).toBeDefined();
    expect(brandVerification?.governmentWarningResult).toBeUndefined();
  });

  it('should fail government warning when extracted text is missing the header', () => {
    const extractedData: LabelData = {
      governmentWarning: 'Some random warning text without the proper header'
    };

    const applicationData: LabelData = {
      governmentWarning: CANONICAL
    };

    const result = service.createVerificationResult(
      'test-3', 'label.png', extractedData, applicationData, 50
    );

    const gwVerification = result.fieldVerifications.find(
      v => v.fieldName === 'governmentWarning'
    );

    expect(gwVerification?.isMatch).toBe(false);
    expect(gwVerification?.governmentWarningResult?.subResults.find(
      s => s.check === 'presence'
    )?.passed).toBe(false);
  });

  it('should handle missing government warning in extracted data', () => {
    const extractedData: LabelData = {
      brandName: 'TEST BRAND'
      // No governmentWarning
    };

    const applicationData: LabelData = {
      brandName: 'TEST BRAND',
      governmentWarning: CANONICAL
    };

    const result = service.createVerificationResult(
      'test-4', 'label.png', extractedData, applicationData, 50
    );

    const gwVerification = result.fieldVerifications.find(
      v => v.fieldName === 'governmentWarning'
    );

    expect(gwVerification?.isMatch).toBe(false);
    expect(gwVerification?.governmentWarningResult).toBeDefined();
    expect(gwVerification?.governmentWarningResult?.overallPass).toBe(false);
  });
});
