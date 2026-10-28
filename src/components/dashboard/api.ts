// The fetch helper the owner screens share. Decimals arrive as strings ("2.50"). Failures become an `ApiError`
// carrying the contract code; each screen turns the code into a sentence.

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

export async function call<T = undefined>(path: string, method: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("offline", 0);
  }
  if (response.status === 204) return undefined as T;
  const json = await response.json().catch(() => null);
  if (response.status === 401 && typeof window !== "undefined") {
    // The proxy already tried the refresh token and cleared the cookies: the session is over, so leave the screen.
    window.location.assign("/login?reason=unauthorized");
  }
  if (!response.ok) {
    const fallback = response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : "internal_server_error";
    throw new ApiError(String(json?.message ?? fallback), response.status);
  }
  if (!json || json.success !== true || json.data == null) {
    throw new ApiError("invalid_response", response.status);
  }
  return json.data as T;
}
