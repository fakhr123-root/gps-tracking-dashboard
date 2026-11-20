/**
 * Unified Professional Excel (.xlsx) Export Formatter for GeoRadar 3D Studio
 * Shared across User Interface (public/index.html) and Admin Command Center (public/admin.html)
 */
(function (global) {
  'use strict';

  function normArText(str) {
    return String(str || '')
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');
  }

  /**
   * Smart Arabic Category Resolver — Never returns blank!
   * Maps structured OSM/Google tags AND infers from Arabic/English name keywords.
   */
  function resolveArabicPlaceCategory(place) {
    if (!place || typeof place !== 'object') return 'منشأة / معلم عام';

    const rawTags = [];
    if (place.categoryAr) rawTags.push(place.categoryAr);
    if (place.category) rawTags.push(place.category);
    if (place.type) rawTags.push(place.type);
    if (Array.isArray(place.c)) rawTags.push(...place.c);
    if (Array.isArray(place.categories)) rawTags.push(...place.categories);
    if (place.tags && typeof place.tags === 'object') {
      const t = place.tags;
      [
        t.amenity, t.shop, t.healthcare, t.office, t.craft,
        t.tourism, t.leisure, t.historic, t.industrial, t.building, t.place
      ].forEach(v => { if (v) rawTags.push(v); });
    }

    const cleanExplicitArabic = rawTags.find(t => {
      const s = String(t || '').trim();
      return s && /[\u0600-\u06FF]/.test(s) && s !== 'منشأة' && s !== 'عام' && s !== 'الكل';
    });

    const tagJoined = normArText(rawTags.join(' '));
    const nameStr = normArText(place.name || place.n || '');
    const combined = `${nameStr} ${tagJoined}`.trim();

    // 1. Pharmacies & Medical Supplies
    if (/(صيدليه|صيدليات|فارما|دواء|ادويه|مستلزمات طبيه|pharmacy|chemist|drugstore)/i.test(combined)) {
      return 'صيدلية / مستلزمات طبية';
    }
    // 2. Hospitals & Medical Centers
    if (/(مستشفي|مستشفيات|طوارئ|مجمع طبي|مدينه طبيه|hospital|medical_center)/i.test(combined)) {
      return 'مستشفى / مجمع طبي';
    }
    // 3. Clinics, Labs & Doctors
    if (/(عياده|عيادات|مستوصف|مركز طبي|اسنان|مختبر|تحاليل|اشعه|دكتور|طبيب|علاج طبيعي|clinic|doctors|dentist|healthcare|laboratory)/i.test(combined)) {
      return 'عيادة / مركز طبي';
    }
    // 4. Banks, Exchange & Financial Services
    if (/(بنك|بنوك|مصرف|صرافه|صراف الي|تحويلات|كريمي|امتياز|سويد|النجم|bank|atm|bureau_de_change|exchange|finance)/i.test(combined)) {
      return 'بنك / شركة صرافة';
    }
    // 5. Supermarkets, Groceries & Mini-Markets
    if (/(بقاله|بقالات|سوبرماركت|سوبر ماركت|تموينات|ميني ماركت|هايبر|ماركت|supermarket|convenience|grocery)/i.test(combined)) {
      return 'سوبرماركت / بقالة';
    }
    // 6. Restaurants, Cafes, Bakeries & Sweets
    if (/(مطعم|مطاعم|مطبخ|مطابخ|مندي|بروست|شوايه|مشويات|شاورما|فطائر|بيتزا|برجر|بوفيه|كافتيريا|فوال|كافيه|مقهي|قهوه|مرطبات|عصائر|مخبز|مخابز|فرن|افران|حلويات|restaurant|fast_food|cafe|bakery|confectionery|food)/i.test(combined)) {
      if (/(مخبز|مخابز|فرن|افران|حلويات|bakery|confectionery)/i.test(combined)) {
        return 'مخبز / حلويات';
      }
      if (/(كافيه|مقهي|قهوه|عصائر|cafe|coffee)/i.test(combined)) {
        return 'كافيه / مقهى';
      }
      return 'مطعم / وجبات';
    }
    // 7. Hotels, Resorts & Furnished Apartments
    if (/(فندق|فنادق|اجنحه|شقق مفروشه|شقق فندقيه|لوكنده|لوكاندة|منتجع|استراحه|دار ضيافه|نزل|hotel|motel|guest_house|hostel|apartments|resort)/i.test(combined)) {
      return 'فندق / إقامة وسياحة';
    }
    // 8. Education (Schools, Universities, Institutes)
    if (/(مدرسه|مدارس|جامعه|كليه|معهد|روضه|حضانه|اكاديميه|مركز تعليمي|تدريب|school|university|college|kindergarten|education|training)/i.test(combined)) {
      return 'تعليم / مدرسة أو جامعة';
    }
    // 9. Telecom, Mobile Phones & Electronics
    if (/(تلفون|تلفونات|جوال|جوالات|هاتف|هواتف|موبايل|اتصالات|الكترونيات|كمبيوتر|لابتوب|برمجه|mobile_phone|electronics|computer|telecom)/i.test(combined)) {
      return 'اتصالات / هواتف وإلكترونيات';
    }
    // 10. Shopping Malls, Commercial Centers & Retail Stores
    if (/(مول|مركز تجاري|مجمع تجاري|سيتي مارت|سوق|معرض|متجر|محل|بوتيك|ملابس|ازياء|عبايات|احذيه|عطور|مفروشات|اثاث|mall|department_store|clothes|shoes|furniture|jewelry|shop|store)/i.test(combined)) {
      if (/(مول|مركز تجاري|مجمع تجاري|سوق|mall|department_store|marketplace)/i.test(combined)) {
        return 'مركز تجاري / مول';
      }
      return 'متجر / معرض تجاري';
    }
    // 11. Courts, Ministries, Police & Government Institutions
    if (/(محكمه|محاكم|نيابه|قضاء|وزاره|هيئه|مؤسسه عامه|مصلحه|بلديه|امانه|شرطه|امن|مرور|دفاع مدني|جوازات|احوال مدنيه|ضرائب|اوقاف|سفاره|قنصليه|courthouse|government|ministry|police|townhall|embassy|public_building)/i.test(combined)) {
      return 'جهة حكومية / قضائية';
    }
    // 12. Border Crossings, Customs, Ports, Airports & Transport Stations
    if (/(منفذ|منافذ|جمرك|جمارك|معبر|ميناء|مطار|فرزه|محطه نقل|مسافرين|شحن|customs|airport|aerodrome|ferry_terminal|bus_station|transport)/i.test(combined)) {
      return 'منفذ / جمارك ونقل';
    }
    // 13. Event Halls, Pools, Sports & Leisure
    if (/(صاله|صالات|قاعه|قاعات|افراح|مناسبات|مسبح|مسابح|نادي|حمام بخار|ساونا|حديقه|منتزه|ملعب|swimming_pool|sports_centre|stadium|park|events_venue|cinema|theatre)/i.test(combined)) {
      return 'صالات / مسابح وترفيه';
    }
    // 14. Automotive, Fuel Stations & Workshops
    if (/(سيارات|قطع غيار|ورشه|بنشر|زيوت|اطارات|محطه وقود|محطه بترول|غاز|ديزل| مغسله سيارات|fuel|car_repair|car_wash|car_parts|car)/i.test(combined)) {
      return 'خدمات سيارات / محطة وقود';
    }
    // 15. Factories, Industrial & Crafts
    if (/(مصنع|مصانع|معمل|صناعي|منطقه صناعيه|مقاولات|خرسانه|حديد|بلاستيك|نجاره|حداده|المنيوم|industrial|factory|craft|workshop|construction)/i.test(combined)) {
      return 'مصنع / منشأة صناعية وحرفية';
    }
    // 16. Mosques & Religious Landmarks
    if (/(مسجد|مساجد|جامع|مصلي|دار قران|مركز اسلامي|mosque|place_of_worship)/i.test(combined)) {
      return 'مسجد / جامع';
    }
    // 17. Companies, Foundations & Offices
    if (/(شركه|شركات|مؤسسه|مكتب|وكاله|مجموعه|استيراد|تصدير|تجاره|خدمات|عقارات|محاماه|استشارات|هندسيه|تقنيه|office|company|agency|lawyer|accountant|estate_agent)/i.test(combined)) {
      return 'شركة / مؤسسة ومكتب';
    }

    if (cleanExplicitArabic) {
      return String(cleanExplicitArabic).trim();
    }

    return 'منشأة / معلم عام';
  }

  /**
   * Extracts Plus Code (e.g. "8GP6+2R", "7HG5+9X") if present in address/district/city,
   * and returns a clean city/district label without raw Plus Codes prepended.
   */
  function extractPlusCodeAndCleanCityDistrict(place) {
    if (!place || typeof place !== 'object') {
      return { cityDistrict: 'صنعاء', plusCode: '—' };
    }

    const plusCodeRegex = /\b([23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,5})\b/i;
    let extractedPlus = '';

    const candidateFields = [
      place.plusCode,
      place.plus_code,
      place.address,
      place.a,
      place.district,
      place.d,
      place.city,
      place.ci
    ];

    for (const val of candidateFields) {
      if (!val) continue;
      const m = String(val).match(plusCodeRegex);
      if (m && m[1]) {
        extractedPlus = m[1].toUpperCase();
        break;
      }
    }

    const stripPlus = (str) => String(str || '')
      .replace(/\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,5}\b/gi, '')
      .replace(/^[\s,،\-–—/]+|[\s,،\-–—/]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const cleanCity = stripPlus(place.city || place.ci || '');
    let cleanDistrict = stripPlus(place.district || place.d || '');
    const cleanAddr = stripPlus(place.address || place.a || '');

    if (cleanDistrict && cleanCity && normArText(cleanDistrict) === normArText(cleanCity)) {
      cleanDistrict = '';
    }

    let cityDistrict = '';
    if (cleanCity && cleanDistrict) {
      cityDistrict = cleanDistrict.includes(cleanCity)
        ? cleanDistrict
        : `${cleanCity} - ${cleanDistrict}`;
    } else if (cleanCity && cleanAddr && cleanAddr !== cleanCity) {
      cityDistrict = cleanAddr.includes(cleanCity)
        ? cleanAddr
        : `${cleanCity} - ${cleanAddr}`;
    } else {
      cityDistrict = cleanCity || cleanDistrict || cleanAddr || 'صنعاء';
    }

    return {
      cityDistrict: cityDistrict.slice(0, 110) || 'صنعاء',
      plusCode: extractedPlus || '—'
    };
  }

  /**
   * Cleans phone number string so Excel never converts it to E+ scientific notation.
   */
  function formatCleanTextPhone(place) {
    if (!place || typeof place !== 'object') return 'غير متوفر';
    let rawPhone = '';
    if (Array.isArray(place.phones) && place.phones.length > 0) {
      rawPhone = place.phones.filter(Boolean).join(' | ');
    } else if (place.phone && String(place.phone).trim() !== '' && String(place.phone).trim() !== 'غير متوفر') {
      rawPhone = String(place.phone).trim();
    } else if (place.ph && String(place.ph).trim() !== '') {
      rawPhone = String(place.ph).trim();
    }
    if (!rawPhone) return 'غير متوفر';
    return String(rawPhone).trim();
  }

  /**
   * Builds the standardized 9-column RTL rows for Places (User Search, Comprehensive Scan, Saved Projects, Admin Cached Searches & DB Export)
   */
  function formatPlaceRowsForExcel(placesArray) {
    const list = Array.isArray(placesArray) ? placesArray : [];
    return list.map((p, idx) => {
      const rawLat = Number(p.lat ?? p.la ?? 0);
      const rawLon = Number(p.lng ?? p.lon ?? p.ln ?? 0);
      const latNum = Number((isNaN(rawLat) ? 0 : rawLat).toFixed(6));
      const lonNum = Number((isNaN(rawLon) ? 0 : rawLon).toFixed(6));
      const { cityDistrict, plusCode } = extractPlusCodeAndCleanCityDistrict(p);
      const phoneStr = formatCleanTextPhone(p);
      const gmapsUrl = `https://www.google.com/maps?q=${latNum.toFixed(6)},${lonNum.toFixed(6)}`;

      return {
        'م': idx + 1,
        'اسم المنشأة': String(p.name || p.n || 'منشأة').trim(),
        'التصنيف': resolveArabicPlaceCategory(p),
        'المدينة / الحي': cityDistrict,
        'الرمز البريدي (Plus Code)': plusCode,
        'رقم الهاتف': phoneStr,
        'خط العرض (Latitude)': latNum,
        'خط الطول (Longitude)': lonNum,
        'رابط خرائط جوجل': gmapsUrl
      };
    });
  }

  /**
   * Builds the standardized 12-column RTL rows for Admin Users & Visitors Log Export
   */
  function formatVisitorRowsForAdminExcel(visitorsArray, allSearchesArray) {
    const list = Array.isArray(visitorsArray) ? visitorsArray : [];
    const searches = Array.isArray(allSearchesArray) ? allSearchesArray : [];

    return list.map((v, idx) => {
      const cleanU = String(v.username || v.visitorName || '').trim().replace(/^@+/, '');
      const userLabel = cleanU ? `@${cleanU}` : (v.visitorName || 'زائر');
      const cityLabel = [v.city || 'صنعاء', v.country || 'اليمن'].filter(Boolean).join(' — ');
      const rawLat = Number(v.lat ?? 15.3538);
      const rawLon = Number(v.lng ?? v.lon ?? 44.2058);
      const latNum = Number((isNaN(rawLat) ? 15.3538 : rawLat).toFixed(6));
      const lonNum = Number((isNaN(rawLon) ? 44.2058 : rawLon).toFixed(6));
      const gmapsUrl = `https://www.google.com/maps?q=${latNum.toFixed(6)},${lonNum.toFixed(6)}`;

      const userSearchesCount = typeof v.searchesCount === 'number'
        ? v.searchesCount
        : (Array.isArray(v.sessionSearches) && v.sessionSearches.length > 0
            ? v.sessionSearches.length
            : searches.filter(s => s && (s.visitorId === v.id || s.visitorName === v.visitorName)).length);

      const quotaTotal = typeof v.searchQuota === 'number' ? v.searchQuota : 1000;
      const remainingQuota = Math.max(0, quotaTotal - userSearchesCount);
      const isBanned = Boolean(v.isBanned ?? v.suspended);
      const statusLabel = isBanned ? 'محظور' : 'نشط';
      const netAndDevice = [v.isp || 'يمن نت', v.device || 'متصفح ويب'].filter(Boolean).join(' | ');
      const loginTime = (v.lastSeen || v.firstSeen)
        ? new Date(v.lastSeen || v.firstSeen).toLocaleString('ar-SA', { hour12: true })
        : '—';
      const trailPointsCount = Array.isArray(v.movementHistory) && v.movementHistory.length > 0
        ? v.movementHistory.length
        : (Array.isArray(v.previousLogs) ? v.previousLogs.length + 1 : 1);

      return {
        'م': idx + 1,
        'اليوزر': userLabel,
        'المدينة': cityLabel,
        'خط العرض (Latitude)': latNum,
        'خط الطول (Longitude)': lonNum,
        'رابط خرائط جوجل': gmapsUrl,
        'IP': String(v.ip || '—'),
        'الشبكة والجهاز': netAndDevice,
        'عدد نقاط المسار': Number(trailPointsCount),
        'عدد عمليات البحث': Number(userSearchesCount || 0),
        'الرصيد المتبقي': Number(remainingQuota),
        'حالة الحساب': statusLabel,
        'وقت الدخول': loginTime
      };
    });
  }

  /**
   * Builds standardized RTL rows for User Movement Trail / Route History Export (Single User or All Users)
   */
  function formatMovementTrailRowsForAdminExcel(visitorsArray) {
    const list = Array.isArray(visitorsArray) ? visitorsArray : [];
    const rows = [];
    let counter = 1;

    for (const v of list) {
      if (!v) continue;
      const cleanU = String(v.username || v.visitorName || '').trim().replace(/^@+/, '');
      const userLabel = (cleanU && !v.isDeviceIpAutoAuth && !cleanU.includes('•')) ? `@${cleanU}` : (v.visitorName || 'زائر');
      const deviceLabel = [v.isp || 'يمن نت', v.device || 'هاتف ذكي'].filter(Boolean).join(' | ');
      const ipStr = String(v.ip || '—');

      const points = [];
      if (Array.isArray(v.movementHistory) && v.movementHistory.length > 0) {
        v.movementHistory.forEach(pt => {
          if (pt && pt.lat && pt.lng) {
            points.push({
              lat: Number(pt.lat),
              lng: Number(pt.lng),
              city: pt.city || v.city || 'صنعاء',
              region: pt.region || v.region || '',
              status: pt.status || v.connectionStatus || 'live',
              distanceMeters: Number(pt.distanceMeters || 0),
              speedKmh: Number(pt.speedKmh || 0),
              timestamp: pt.timestamp || v.lastSeen || v.firstSeen
            });
          }
        });
      } else {
        if (Array.isArray(v.previousLogs)) {
          [...v.previousLogs].reverse().forEach(snap => {
            if (snap && snap.lat && snap.lng) {
              points.push({
                lat: Number(snap.lat),
                lng: Number(snap.lng),
                city: snap.city || v.city || 'صنعاء',
                region: snap.region || '',
                status: 'archived',
                distanceMeters: 0,
                speedKmh: 0,
                timestamp: snap.previousLastSeen || snap.archivedAt
              });
            }
          });
        }
        if (v.lat && v.lng) {
          points.push({
            lat: Number(v.lat),
            lng: Number(v.lng),
            city: v.city || 'صنعاء',
            region: v.region || '',
            status: v.connectionStatus || 'live',
            distanceMeters: 0,
            speedKmh: 0,
            timestamp: v.lastHeartbeatAt || v.lastSeen || v.firstSeen
          });
        }
      }

      points.forEach((pt, idx) => {
        const latNum = Number(Number(pt.lat || 0).toFixed(6));
        const lonNum = Number(Number(pt.lng || 0).toFixed(6));
        const gmapsUrl = `https://www.google.com/maps?q=${latNum.toFixed(6)},${lonNum.toFixed(6)}`;
        const timeStr = pt.timestamp
          ? new Date(pt.timestamp).toLocaleString('ar-SA', { hour12: true })
          : '—';
        const statusAr = pt.status === 'gps_off'
          ? '🔴 أقفل الموقع'
          : (pt.status === 'background_live' ? '🟢 متصل (في الخلفية)' : (pt.status === 'exited' ? '🟡 خارج التطبيق' : '🟢 متصل (Live)'));

        rows.push({
          'م': counter++,
          'اليوزر': userLabel,
          'رقم النقطة في المسار': `#${idx + 1}`,
          'المدينة / المنطقة': [pt.city || 'صنعاء', pt.region || ''].filter(Boolean).join(' - '),
          'خط العرض (Latitude)': latNum,
          'خط الطول (Longitude)': lonNum,
          'المسافة المقطوعة (متر)': Number(pt.distanceMeters || 0),
          'السرعة التقديرية (كم/س)': Number(pt.speedKmh || 0),
          'حالة الاتصال': statusAr,
          'وقت النقطة': timeStr,
          'IP': ipStr,
          'الشبكة والجهاز': deviceLabel,
          'رابط خرائط جوجل': gmapsUrl
        });
      });
    }

    return rows;
  }

  /**
   * Builds the standardized RTL rows for Admin Search Logs Summary Export
   */
  function formatSearchLogRowsForAdminExcel(searchesArray) {
    const list = Array.isArray(searchesArray) ? searchesArray : [];
    return list.map((s, idx) => {
      const cleanU = String(s.visitorName || '').trim().replace(/^@+/, '');
      const userLabel = cleanU ? `@${cleanU}` : 'زائر';
      const timeStr = s.timestamp
        ? new Date(s.timestamp).toLocaleString('ar-SA', { hour12: true })
        : '—';
      return {
        'م': idx + 1,
        'النشاط المطلوب': String(s.query || 'مسح شامل (جميع الأنشطة)'),
        'التصنيف': resolveArabicPlaceCategory({ name: s.query || '', categoryAr: s.query || '' }),
        'المدينة / النطاق': `${s.targetLocation || 'صنعاء'} - ${s.targetNeighborhood || 'الكل'}`,
        'نصف القطر (كم)': Number(s.radius || 10),
        'عدد المنشآت المستخرجة': Number(s.resultsCount || 0),
        'اليوزر': userLabel,
        'IP': String(s.ip || '—'),
        'وقت البحث': timeStr
      };
    });
  }

  /**
   * Core Unified Excel Sheet Exporter
   * Enforces:
   * - Native RTL Workbook & Worksheet View
   * - Explicit String type (t: 's') on Phone & IP columns (No E+ scientific notation)
   * - Explicit Numeric type (t: 'n', 6 decimals) on Latitude & Longitude columns
   * - Active Clickable Hyperlinks on Google Maps URL cells
   * - Dynamic Auto-Fit Column Widths (maxLen * 1.3 + 6 padding)
   * - Full-table Header AutoFilter
   */
  function exportFormattedExcelSheet(options) {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة التصدير إلى Excel قيد التحميل، يرجى المحاولة بعد لحظة.');
      return;
    }

    const opts = options || {};
    const rows = Array.isArray(opts.rows) ? opts.rows : [];
    if (rows.length === 0) {
      alert('لا توجد بيانات لتصديرها!');
      return;
    }

    const headers = Array.isArray(opts.explicitHeaders) && opts.explicitHeaders.length > 0
      ? opts.explicitHeaders
      : Object.keys(rows[0]);

    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

    // Force Native RTL View at Worksheet level
    ws['!views'] = [{ rightToLeft: true, RTL: true }];

    // Enforce cell types (Text phones, 6-decimal numeric Lat/Lon, clickable Google Maps hyperlinks)
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
    const colMaxChars = new Array(headers.length).fill(10);

    for (let c = 0; c < headers.length; c++) {
      colMaxChars[c] = Math.max(colMaxChars[c], String(headers[c] || '').length);
    }

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const colName = headers[C] || '';
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        let cell = ws[cellRef];
        if (!cell) continue;

        // 1. Phone Number & IP columns -> strictly string (t: 's') so Excel NEVER shows scientific notation E+
        if (colName === 'رقم الهاتف' || colName === 'IP' || colName === 'الرمز البريدي (Plus Code)') {
          const strVal = String(cell.v ?? '—').trim() || '—';
          cell.t = 's';
          cell.v = strVal;
          cell.w = strVal;
          cell.z = '@';
          colMaxChars[C] = Math.max(colMaxChars[C], strVal.length);
          continue;
        }

        // 2. Latitude & Longitude columns -> strictly numeric rounded to 6 decimal places
        if (colName === 'خط العرض (Latitude)' || colName === 'خط الطول (Longitude)') {
          const numVal = Number(Number(cell.v || 0).toFixed(6));
          cell.t = 'n';
          cell.v = numVal;
          cell.z = '0.000000';
          const formattedCoord = numVal.toFixed(6);
          colMaxChars[C] = Math.max(colMaxChars[C], formattedCoord.length);
          continue;
        }

        // 3. Google Maps URL column -> active clickable hyperlink
        if (colName === 'رابط خرائط جوجل') {
          const urlStr = String(cell.v || '').trim();
          cell.t = 's';
          cell.v = urlStr;
          if (urlStr.startsWith('http')) {
            cell.l = {
              Target: urlStr,
              Tooltip: 'فتح الموقع في خرائط جوجل'
            };
          }
          colMaxChars[C] = Math.max(colMaxChars[C], urlStr.length);
          continue;
        }

        const valStr = String(cell.v ?? '');
        colMaxChars[C] = Math.max(colMaxChars[C], valStr.length);
      }
    }

    // Dynamic Auto-Fit Column Widths: max character length * 1.3 + 6 padding characters
    ws['!cols'] = colMaxChars.map((maxLen) => ({
      wch: Math.min(72, Math.max(12, Math.ceil(maxLen * 1.3) + 6))
    }));

    // Enable Header AutoFilter across the full table range
    if (ws['!ref']) {
      ws['!autofilter'] = { ref: ws['!ref'] };
    }

    const wb = XLSX.utils.book_new();
    // Force Native RTL View at Workbook level
    wb.Workbook = {
      Views: [{ RTL: true }]
    };

    const safeSheetName = String(opts.sheetName || 'بيانات خرائط جوجل').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

    let outFile = String(opts.filename || `GeoRadar_Export_${Date.now()}.xlsx`).trim();
    if (!outFile.toLowerCase().endsWith('.xlsx')) {
      outFile += '.xlsx';
    }
    XLSX.writeFile(wb, outFile);
  }

  /**
   * Convenience helper to directly export an array of places using the unified 9-column RTL format
   */
  function exportPlacesArrayToExcel(placesArray, filename, sheetName) {
    const rows = formatPlaceRowsForExcel(placesArray);
    exportFormattedExcelSheet({
      filename: filename || `GeoRadar_Places_${Date.now()}.xlsx`,
      sheetName: sheetName || 'نتائج ومواقع خرائط جوجل',
      rows
    });
  }

  global.resolveArabicPlaceCategory = resolveArabicPlaceCategory;
  global.extractPlusCodeAndCleanCityDistrict = extractPlusCodeAndCleanCityDistrict;
  global.formatPlaceRowsForExcel = formatPlaceRowsForExcel;
  global.formatVisitorRowsForAdminExcel = formatVisitorRowsForAdminExcel;
  global.formatMovementTrailRowsForAdminExcel = formatMovementTrailRowsForAdminExcel;
  global.formatSearchLogRowsForAdminExcel = formatSearchLogRowsForAdminExcel;
  global.exportFormattedExcelSheet = exportFormattedExcelSheet;
  global.exportPlacesArrayToExcel = exportPlacesArrayToExcel;
})(window);
