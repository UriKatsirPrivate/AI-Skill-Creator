export async function generateSkillResponse(model: string, history: { role: string; parts: { text: string }[] }[], message: string): Promise<string> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, history, message }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage: string | undefined;
    try {
      errorMessage = JSON.parse(errorText).error;
    } catch {
      // Non-JSON error body (e.g. an HTML gateway error page); fall through to the generic message.
    }
    throw new Error(errorMessage || `Request failed with status ${res.status}`);
  }
  const data = await res.json();
  return data.text;
}
