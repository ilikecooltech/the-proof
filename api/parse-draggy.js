// Vercel serverless function — proxies Draggy screenshot OCR requests to Anthropic

export const config = {
  maxDuration: 30, // vision calls can take 15-20s
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable is not set' });
  }

  if (!req.body) {
    return res.status(400).json({ error: 'Request body is missing or too large' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();

    // Always forward the status so the client can detect errors
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Anthropic proxy error:', error);
    return res.status(500).json({
      error: { message: `Proxy failed: ${error.message}` },
    });
  }
}
