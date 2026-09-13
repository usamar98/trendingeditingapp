export const SESSION_EVENT = "editingapp-session-updated";
export function notifySessionChanged() {
  window.dispatchEvent(new Event(SESSION_EVENT));
  try {
    localStorage.setItem(SESSION_EVENT, crypto.randomUUID());
  } catch {
    /* Focus refresh remains available. */
  }
}
export async function readApi(response: Response) {
  const body = await response
    .json()
    .catch(() => ({
      error: "The connection was interrupted. Please try checking again.",
    }));
  if (!response.ok)
    throw new Error(body.error || "The request could not be completed.");
  return body;
}
