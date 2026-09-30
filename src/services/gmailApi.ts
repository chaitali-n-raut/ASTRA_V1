export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
  snippet?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  labelIds?: string[];
}

export interface GmailMessageDetail extends GmailMessageSummary {
  bodyText?: string;
  bodyHtml?: string;
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

/**
 * Encodes string to base64url format for RFC 2822 email payload.
 */
function base64UrlEncode(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Decodes base64url string from Gmail message payload.
 */
function base64UrlDecode(base64Url: string): string {
  try {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (err) {
    return '';
  }
}

export async function fetchGmailProfile(accessToken: string): Promise<GmailProfile> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to load Gmail profile: ${res.status} ${errorText}`);
  }
  return res.json();
}

export async function fetchGmailMessages(
  accessToken: string,
  options: { query?: string; maxResults?: number; pageToken?: string } = {}
): Promise<{ messages: GmailMessageSummary[]; nextPageToken?: string; resultSizeEstimate: number }> {
  const params = new URLSearchParams();
  if (options.query) params.set('q', options.query);
  params.set('maxResults', String(options.maxResults || 15));
  if (options.pageToken) params.set('pageToken', options.pageToken);

  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch Gmail messages: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const rawList: Array<{ id: string; threadId: string }> = data.messages || [];

  // Fetch summaries in parallel (limit to 10 for performance)
  const summaries = await Promise.all(
    rawList.slice(0, 10).map(async (item) => {
      try {
        const detailRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!detailRes.ok) return { id: item.id, threadId: item.threadId };
        const detailData = await detailRes.json();
        const headers: GmailMessageHeader[] = detailData.payload?.headers || [];

        const getHeader = (name: string) =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        return {
          id: item.id,
          threadId: item.threadId,
          snippet: detailData.snippet,
          subject: getHeader('Subject') || '(No Subject)',
          from: getHeader('From'),
          to: getHeader('To'),
          date: getHeader('Date'),
          labelIds: detailData.labelIds || [],
        };
      } catch {
        return { id: item.id, threadId: item.threadId };
      }
    })
  );

  return {
    messages: summaries,
    nextPageToken: data.nextPageToken,
    resultSizeEstimate: data.resultSizeEstimate || 0,
  };
}

export async function fetchGmailMessageDetail(accessToken: string, messageId: string): Promise<GmailMessageDetail> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch message details: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  const headers: GmailMessageHeader[] = data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  let bodyText = '';
  let bodyHtml = '';

  const extractParts = (part: any) => {
    if (!part) return;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      bodyText += base64UrlDecode(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      bodyHtml += base64UrlDecode(part.body.data);
    }
    if (part.parts && Array.isArray(part.parts)) {
      part.parts.forEach(extractParts);
    }
  };

  extractParts(data.payload);
  if (!bodyText && data.payload?.body?.data) {
    bodyText = base64UrlDecode(data.payload.body.data);
  }

  return {
    id: data.id,
    threadId: data.threadId,
    snippet: data.snippet,
    subject: getHeader('Subject') || '(No Subject)',
    from: getHeader('From'),
    to: getHeader('To'),
    date: getHeader('Date'),
    labelIds: data.labelIds || [],
    bodyText: bodyText || data.snippet,
    bodyHtml,
  };
}

export async function sendGmailMessage(
  accessToken: string,
  options: {
    to: string;
    subject: string;
    bodyText: string;
    htmlBody?: string;
  }
): Promise<{ id: string; threadId: string; labelIds: string[] }> {
  const { to, subject, bodyText, htmlBody } = options;
  const boundary = `astra_boundary_${Date.now()}`;

  const messageLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    bodyText,
    '',
  ];

  if (htmlBody) {
    messageLines.push(
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      htmlBody,
      ''
    );
  }

  messageLines.push(`--${boundary}--`);

  const rawString = messageLines.join('\r\n');
  const rawEncoded = base64UrlEncode(rawString);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: rawEncoded }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to send email via Gmail: ${res.status} ${errorText}`);
  }

  return res.json();
}
