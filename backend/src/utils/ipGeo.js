/**
 * IP Extraction and Geolocation Utility
 * Determines client IP address, detects local/LAN subnets,
 * and performs geolocation lookups with in-memory caching and failover.
 */

const ipCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 1000;

/**
 * Extracts real client IP address from Express request headers & socket.
 * Handles reverse proxies, Cloudflare, Nginx, and IPv4-mapped IPv6 addresses.
 *
 * @param {import('express').Request} req
 * @returns {string} Clean client IP address
 */
function extractClientIp(req) {
  if (!req) return '127.0.0.1';

  let rawIp = '';

  if (req.headers) {
    // Cloudflare connecting IP
    if (req.headers['cf-connecting-ip']) {
      rawIp = req.headers['cf-connecting-ip'];
    }
    // Nginx real IP
    else if (req.headers['x-real-ip']) {
      rawIp = req.headers['x-real-ip'];
    }
    // Standard X-Forwarded-For header (comma-separated list of proxies)
    else if (req.headers['x-forwarded-for']) {
      const forwarded = req.headers['x-forwarded-for'];
      rawIp = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
    }
  }

  if (!rawIp) {
    rawIp = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';
  }

  // Strip IPv6-mapped IPv4 prefix (e.g. ::ffff:192.168.1.1 -> 192.168.1.1)
  if (typeof rawIp === 'string' && rawIp.startsWith('::ffff:')) {
    rawIp = rawIp.replace('::ffff:', '');
  }

  // Normalize IPv6 localhost
  if (rawIp === '::1' || rawIp === 'localhost') {
    rawIp = '127.0.0.1';
  }

  return (rawIp || '127.0.0.1').trim();
}

/**
 * Checks if an IP is within private / loopback / link-local subnets (RFC 1918 / RFC 4193).
 *
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateOrLocalIp(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === 'localhost' || ip === '::1') return true;

  // IPv4 Private & Link-local ranges:
  // 10.0.0.0 - 10.255.255.255
  if (/^10\./.test(ip)) return true;
  // 172.16.0.0 - 172.31.255.255
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  // 192.168.0.0 - 192.168.255.255
  if (/^192\.168\./.test(ip)) return true;
  // 169.254.0.0 - 169.254.255.255 (link-local)
  if (/^169\.254\./.test(ip)) return true;

  // IPv6 Unique Local Address & Link-local
  if (/^(fc|fd|fe80)/i.test(ip)) return true;

  return false;
}

/**
 * Fetches JSON with a strict timeout using native fetch and AbortController.
 *
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<any>}
 */
async function fetchWithTimeout(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GroceryStore-POS-Geolocation/1.0',
        'Accept': 'application/json'
      }
    });
    clearTimeout(timer);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Resolves geolocation details for a given IP address.
 * Employs in-memory cache, private IP short-circuit, and dual provider failover.
 *
 * @param {string} ip
 * @returns {Promise<{
 *   ip: string,
 *   isLocal: boolean,
 *   region: string,
 *   city: string,
 *   country: string,
 *   locationText: string,
 *   flag: string,
 *   details: object
 * }>}
 */
async function lookupIpLocation(ip) {
  const cleanIp = (ip || '127.0.0.1').trim();

  // 1. Check local / LAN short-circuit
  if (isPrivateOrLocalIp(cleanIp)) {
    return {
      ip: cleanIp,
      isLocal: true,
      region: 'Khu vực nội bộ',
      city: 'Cửa hàng (LAN)',
      country: 'Việt Nam',
      locationText: 'Nội bộ cửa hàng (Localhost / LAN)',
      flag: '🏠',
      details: {
        type: 'LAN',
        ip: cleanIp,
        provider: 'Mạng cục bộ POS',
        note: 'Máy trạm bán hàng nội bộ'
      }
    };
  }

  // 2. Check in-memory cache
  const cached = ipCache.get(cleanIp);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // 3. Primary provider: ipwho.is (No API key needed, high accuracy, HTTPS)
  try {
    const data = await fetchWithTimeout(`https://ipwho.is/${encodeURIComponent(cleanIp)}`, 2500);
    if (data && data.success) {
      const city = data.city || '';
      const region = data.region || '';
      const country = data.country || 'Việt Nam';
      const flag = data.flag?.emoji || '📍';

      const parts = [city, region, country].filter(Boolean);
      const locationText = parts.length > 0 ? parts.join(', ') : 'Việt Nam';

      const result = {
        ip: cleanIp,
        isLocal: false,
        region: region || 'Không xác định',
        city: city || 'Không rõ',
        country: country || 'Việt Nam',
        locationText,
        flag,
        details: {
          isp: data.connection?.isp || null,
          org: data.connection?.org || null,
          timezone: data.timezone?.id || null,
          flag,
          latitude: data.latitude || null,
          longitude: data.longitude || null
        }
      };

      // Save to cache
      if (ipCache.size >= MAX_CACHE_SIZE) {
        const firstKey = ipCache.keys().next().value;
        ipCache.delete(firstKey);
      }
      ipCache.set(cleanIp, { timestamp: Date.now(), data: result });

      return result;
    }
  } catch (err) {
    // Primary failed, continue to fallback
  }

  // 4. Secondary provider fallback: ip-api.com
  try {
    const fallbackData = await fetchWithTimeout(
      `http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=status,message,country,regionName,city,lat,lon,isp,org`,
      2500
    );

    if (fallbackData && fallbackData.status === 'success') {
      const city = fallbackData.city || '';
      const region = fallbackData.regionName || '';
      const country = fallbackData.country || 'Việt Nam';
      const parts = [city, region, country].filter(Boolean);
      const locationText = parts.length > 0 ? parts.join(', ') : 'Việt Nam';

      const result = {
        ip: cleanIp,
        isLocal: false,
        region: region || 'Không xác định',
        city: city || 'Không rõ',
        country: country || 'Việt Nam',
        locationText,
        flag: '📍',
        details: {
          isp: fallbackData.isp || null,
          org: fallbackData.org || null,
          latitude: fallbackData.lat || null,
          longitude: fallbackData.lon || null
        }
      };

      ipCache.set(cleanIp, { timestamp: Date.now(), data: result });
      return result;
    }
  } catch (err) {
    // Both providers failed or offline
  }

  // 5. Safe Fallback
  return {
    ip: cleanIp,
    isLocal: false,
    region: 'Chưa xác định',
    city: 'Không rõ',
    country: 'Chưa xác định',
    locationText: 'Địa chỉ IP ngoại mạng (Chưa định vị)',
    flag: '🌐',
    details: {
      ip: cleanIp,
      status: 'offline_or_rate_limit'
    }
  };
}

module.exports = {
  extractClientIp,
  isPrivateOrLocalIp,
  lookupIpLocation
};
