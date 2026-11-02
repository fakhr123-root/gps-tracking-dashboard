async function test() {
  const query = 'مخبز شارع المقالح صنعاء';
  const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=ar`;
  console.log('Fetching:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'ar,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('Length:', html.length);
    // Google Maps embeds initial data in window.APP_INITIALIZATION_STATE or strings like: [null,null,15.27,44.25]
    const titleMatch = html.match(/<title>(.*?)<\/title>/);
    console.log('Title:', titleMatch ? titleMatch[1] : 'No title');
    
    // Look for place names and phone numbers
    const phoneRegex = /(?:\+?967[\s-]?)?(?:0?[1-7][\s-]?[0-9]{6,7}|7[01378][0-9]{7})/g;
    const phones = html.match(phoneRegex);
    console.log('Found phones:', phones?.slice(0, 10));

    // Look for coords in Google Maps format
    const coordMatches = [...html.matchAll(/@([0-9]+\.[0-9]+),([0-9]+\.[0-9]+)/g)];
    console.log('Coord matches @:', coordMatches.map(m => [m[1], m[2]]).slice(0, 5));
    
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
