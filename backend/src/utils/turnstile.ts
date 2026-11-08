export interface TurnstileVerifyResult {
  success: boolean;
  error?: string;
}

export async function verifyTurnstileToken(
  token?: string | null,
  remoteIp?: string | null
): Promise<TurnstileVerifyResult> {
  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY?.trim();

  // If Turnstile is not configured in the environment, bypass in development/testing
  if (!secretKey) {
    return { success: true };
  }

  if (!token) {
    return {
      success: false,
      error: 'Cloudflare Turnstile verification token is required',
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Turnstile verification request failed with status ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      success: boolean;
      'error-codes'?: string[];
      hostname?: string;
    };

    if (!data.success) {
      const errorCodes = data['error-codes']?.join(', ') || 'Verification failed';
      return {
        success: false,
        error: `Captcha challenge failed: ${errorCodes}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return {
      success: false,
      error: `Turnstile service error: ${(error as Error).message}`,
    };
  }
}

