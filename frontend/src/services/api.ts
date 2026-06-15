import { BatchVerificationResult, VerificationResult, LabelData, BatchRowResult } from '../types';

async function getErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const error = await response.json();
    return error.error || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Verify a single label
 */
export async function verifyLabel(
  imageFile: File,
  applicationData: LabelData,
  apiEndpoint: string
): Promise<VerificationResult> {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('labelId', `label-${Date.now()}`);
  formData.append('applicationData', JSON.stringify(applicationData));

  const response = await fetch(`${apiEndpoint}/api/verification/verify-label`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Verification failed'));
  }

  return response.json();
}

/**
 * Verify batch of labels
 */
export async function verifyBatch(
  imageFiles: File[],
  batchId: string,
  apiEndpoint: string
): Promise<BatchVerificationResult> {
  const formData = new FormData();

  // Add all image files
  imageFiles.forEach(file => {
    formData.append('images', file);
  });

  // Add batch metadata
  formData.append('batchId', batchId);
  formData.append('applicationsData', JSON.stringify(
    imageFiles.map(() => ({})) // Empty application data for now
  ));

  const response = await fetch(`${apiEndpoint}/api/verification/verify-batch`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Batch verification failed'));
  }

  return response.json();
}

/**
 * Verify using JSON payload with base64 image
 */
export async function verifyLabelJSON(
  filename: string,
  imageBase64: string,
  applicationData: LabelData,
  apiEndpoint: string
): Promise<VerificationResult> {
  const response = await fetch(`${apiEndpoint}/api/verification/verify-json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      labelId: `label-${Date.now()}`,
      filename,
      imageBase64,
      applicationData
    })
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Verification failed'));
  }

  return response.json();
}

/**
 * Verify a batch of labels using CSV + ZIP via Server-Sent Events.
 * Calls onProgress for each individual result as it streams in.
 */
export async function verifyBatchCSV(
  csvFile: File,
  zipFile: File,
  apiEndpoint: string,
  onProgress: (result: BatchRowResult, processed: number, total: number) => void
): Promise<void> {
  const formData = new FormData();
  formData.append('csvFile', csvFile);
  formData.append('zipFile', zipFile);

  const response = await fetch(`${apiEndpoint}/api/verification/verify-batch-csv`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Batch verification failed'));
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Streaming not supported');

  const decoder = new TextDecoder();
  let buffer = '';

  let done = false;
  while (!done) {
    const result = await reader.read();
    done = result.done;
    if (done) break;
    const value = result.value;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE messages
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const event = JSON.parse(jsonStr);
          if (event.type === 'result') {
            onProgress(event.result as BatchRowResult, event.processed, event.total);
          }
          // 'done' and 'error' events are also sent but we handle completion
          // by the stream ending
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  }
}
