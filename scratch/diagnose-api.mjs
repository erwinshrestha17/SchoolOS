import { resolve } from 'node:path';

const apiBaseUrl = 'http://localhost:4000/api/v1';

function parseSetCookie(setCookieHeader) {
  if (!setCookieHeader) return '';
  // setCookieHeader can be a string or array (if node-fetch or multiple headers)
  const headers = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const cookies = [];
  for (const h of headers) {
    // split by comma if multiple cookies are in one header (standard fetch behavior in some envs)
    const parts = h.split(/,(?=\s*[a-zA-Z0-9_]+=[^;]+)/);
    for (const part of parts) {
      const cookieVal = part.trim().split(';')[0];
      if (cookieVal) cookies.push(cookieVal);
    }
  }
  return cookies.join('; ');
}

async function diagnose() {
  console.log('Logging in...');
  const loginRes = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantSlug: 'default-school',
      email: 'principal@schoolos.com',
      password: 'principal123',
    }),
  });

  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    return;
  }

  // Node fetch or standard fetch might return set-cookie as an array or comma-separated string
  // Let's get all set-cookie headers using res.headers.getSetCookie if available, or res.headers.get
  const setCookie = loginRes.headers.getSetCookie 
    ? loginRes.headers.getSetCookie() 
    : loginRes.headers.get('set-cookie');

  const cookieHeader = parseSetCookie(setCookie);
  console.log('Parsed Cookie Header:', cookieHeader);

  const endpoints = [
    '/academic-years',
    '/classes',
    '/sections',
    '/students',
    '/admissions?limit=100',
    '/me/entitlements',
    '/students/duplicates/candidates',
    '/academics/report-cards',
    '/timetable/versions',
    '/notices',
    '/canteen/meal-plans',
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${apiBaseUrl}${endpoint}`, {
        headers: {
          Cookie: cookieHeader,
        },
      });
      console.log(`Endpoint: ${endpoint} -> Status: ${res.status}`);
      if (!res.ok) {
        console.error(`  Error Response:`, await res.text());
      } else {
        const json = await res.json();
        const data = json.data ?? json;
        if (endpoint === '/me/entitlements') {
          console.log(`  Entitlements Data:`, JSON.stringify(data, null, 2));
        }
        if (Array.isArray(data)) {
          console.log(`  Data (Array) Length:`, data.length);
        } else if (data && typeof data === 'object') {
          console.log(`  Data (Object) Keys:`, Object.keys(data));
          if (Array.isArray(data.items)) {
            console.log(`    items length:`, data.items.length);
          }
        } else {
          console.log(`  Data:`, data);
        }
      }
    } catch (err) {
      console.error(`  Fetch failed for ${endpoint}:`, err);
    }
  }
}

diagnose();
