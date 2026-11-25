/**
 * Robust API Client with Safe JSON Deserialization & Informative Diagnostics
 * Prevents Safari "The string did not match the expected pattern" DOMExceptions.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export async function safePostJson<T = any>(endpoint: string, payload: any): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let json: any = null;

    try {
      json = JSON.parse(text);
    } catch {
      // If server returned HTML (e.g. 503 or 404 from Hostinger / Nginx)
      if (res.status === 503) {
        return {
          success: false,
          status: 503,
          error: 'Hostinger backend is starting or offline (HTTP 503).'
        };
      }
      if (res.status === 404) {
        return {
          success: false,
          status: 404,
          error: 'API endpoint not found (HTTP 404).'
        };
      }
      return {
        success: false,
        status: res.status,
        error: `Server returned non-JSON response (HTTP ${res.status}).`
      };
    }

    if (res.ok && json && (json.success !== false)) {
      return {
        success: true,
        data: json,
        status: res.status
      };
    } else {
      const errObj = json?.error;
      const msg = typeof errObj === 'string'
        ? errObj
        : (errObj?.message || (typeof errObj === 'object' ? JSON.stringify(errObj) : `Submission failed (HTTP ${res.status})`));
      return {
        success: false,
        error: msg,
        status: res.status,
        data: json
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network connection failed. Please check internet connection.'
    };
  }
}
