const fs = require('fs');

async function inspectGoogleData() {
  const query = 'مخبز شارع المقالح صنعاء';
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=ar`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept-Language': 'ar,en;q=0.9',
    }
  });
  const html = await res.text();
  
  // Check for window.APP_INITIALIZATION_STATE
  const appStateMatch = html.match(/window\.APP_INITIALIZATION_STATE\s*=\s*(.*?);window\./s);
  if (appStateMatch) {
    console.log('Found APP_INITIALIZATION_STATE!');
    try {
      const parsed = JSON.parse(appStateMatch[1]);
      console.log('Parsed keys:', Object.keys(parsed));
      fs.writeFileSync('app_state.json', JSON.stringify(parsed, null, 2));
    } catch(e) {
      console.log('JSON parse error:', e.message);
    }
  }

  // Also check for AF_initDataCallback
  const callbackMatches = [...html.matchAll(/AF_initDataCallback\s*\(\s*\{key:\s*'([^']+)',\s*hash:\s*'[0-9]+',\s*data:(.*?)\}\s*\);/gs)];
  console.log('AF_initDataCallback count:', callbackMatches.length);
  for (const m of callbackMatches) {
    console.log('Callback key:', m[1], 'Length:', m[2]?.length);
    if (m[2].includes('المقالح') || m[2].includes('مخبز')) {
      console.log('Found keyword in key:', m[1]);
      fs.writeFileSync(`callback_${m[1]}.json`, m[2]);
    }
  }
}

inspectGoogleData();
