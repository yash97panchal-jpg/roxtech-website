const inquiryAttempts = new Map();

async function submitRoxTechInquiry(path, payload) {
  const body = JSON.stringify(payload);
  const previous = inquiryAttempts.get(path);
  const requestId = previous?.body === body ? previous.requestId : crypto.randomUUID();
  inquiryAttempts.set(path, { body, requestId });
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...payload, request_id: requestId }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(result?.message || 'Could not save your inquiry.');
  inquiryAttempts.delete(path);
  return result;
}
