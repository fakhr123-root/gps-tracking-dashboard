const test = async () => {
  // Test Photon geocoding for Al-Maqaleh Sana'a
  const geoUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent('صنعاء شارع المقالح')}&limit=3`;
  try {
    const res = await fetch(geoUrl);
    const data = await res.json();
    console.log('Photon features count:', data.features?.length);
    if (data.features?.length > 0) {
      const feat = data.features[0];
      console.log('Coordinates:', feat.geometry.coordinates);
      console.log('Properties:', feat.properties);
    }
  } catch (e) {
    console.log('Photon error:', e.message);
  }

  // Test Overpass with mirror
  const query = `
    [out:json][timeout:15];
    (
      node["shop"="bakery"](around:5000,15.2712,44.2538);
      node["amenity"="fast_food"](around:5000,15.2712,44.2538);
      node["amenity"="restaurant"](around:5000,15.2712,44.2538);
      node["shop"](around:3000,15.2712,44.2538);
    );
    out center 20;
  `;
  const mirrors = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];
  for (const m of mirrors) {
    try {
      console.log('Testing Overpass mirror:', m);
      const res = await fetch(`${m}?data=${encodeURIComponent(query)}`, {
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        const d = await res.json();
        console.log(`Found ${d.elements?.length} elements on ${m}`);
        for (const el of d.elements.slice(0, 5)) {
          console.log('- Place:', el.tags?.name || el.tags?.['name:ar'], 'Lat:', el.lat, 'Lon:', el.lon, 'Phone:', el.tags?.phone);
        }
        break;
      }
    } catch (e) {
      console.log(`Mirror ${m} failed:`, e.message);
    }
  }
};
test();
