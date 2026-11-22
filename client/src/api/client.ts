const BASE_URL = '/api/v1';

export class ApiError extends Error {
  code: string;
  fieldErrors?: Record<string, string>;
  requestId?: string;

  constructor(message: string, code: string = 'ERROR', fieldErrors?: Record<string, string>, requestId?: string) {
    super(message);
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.requestId = requestId;
  }
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('codrix_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = json.error || {};
    throw new ApiError(err.message || 'Request failed', err.code, err.field_errors, err.request_id);
  }

  return json.data !== undefined ? json.data : json;
}
