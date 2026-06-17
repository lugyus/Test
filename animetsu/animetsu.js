/**
 * ============================================================================
 * SORA/LUNA NATIVE NETWORK BRIDGE BOILERPLATE
 * ============================================================================
 */
async function soraFetch(url, options = { headers: {}, method: 'GET', body: null }) {
    const headers = options.headers || {};
    if (!headers["User-Agent"]) {
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    }
    try {
        return await fetchv2(url, headers, options.method || 'GET', options.body || null);
    } catch (e) {
        try { 
            return await fetch(url, options); 
        } catch (error) { 
            return null; 
        }
    }
}

/**
 * Helper to ensure relative URLs map accurately to animetsu.net
 */
function fixUrl(href) {
    if (!href) return "";
    if (href.startsWith('//')) return 'https:' + href;
    if (href.startsWith('/')) return 'https://animetsu.net' + href;
    return href;
}

/**
 * ============================================================================
 * CORE IMPLEMENTATION (Global Scope)
 * ============================================================================
 */

/** Search anime titles by keyword */
async function searchResults(keyword) {
    try {
        const searchUrl = `https://animetsu-net.translate.goog/search?keyword=${encodeURIComponent(keyword)}`;
        const response = await soraFetch(searchUrl);
        if (!response) return JSON.stringify([]);

        const htmlText = await response.text();
        const results = [];

        // Matches common card formats: href, image source, and title textual markers
        const regex = /<a\s+[^>]*href="([^"]+)"[^>]*>[\s\S]*?<img\s+[^>]*src="([^"]+)"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/gi;
        let match;

        while ((match = regex.exec(htmlText)) !== null) {
            const titleStr = match[3].replace(/<[^>]*>/g, '').trim();
            // Skip layout components or empty noise
            if (!titleStr || match[1].includes('/search')) continue; 

            results.push({
                title: titleStr,
                image: fixUrl(match[2]),
                href: fixUrl(match[1])
            });
        }

        return JSON.stringify(results);
    } catch (error) {
        return JSON.stringify([]);
    }
}

/** Extract metadata details of a given anime */
async function extractDetails(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);

        const htmlText = await response.text();

        // 1. Description parsing layer
        let description = "";
        const descMatch = /<div\s+class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(htmlText);
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]*>/g, '').trim();
        }

        // 2. Alternate Titles / Aliases layer
        let aliases = "";
        const aliasMatch = /<span\s+class="[^"]*synonyms[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(htmlText) || 
                           /Alternative:[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i.exec(htmlText);
        if (aliasMatch) {
            aliases = aliasMatch[1].replace(/<[^>]*>/g, '').trim();
        }

        // 3. Airing Date layer
        let airdate = "Unknown";
        const airdateMatch = /Aired:[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i.exec(htmlText) ||
                             /<span\s+class="[^"]*aired[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(htmlText);
        if (airdateMatch) {
            airdate = airdateMatch[1].replace(/<[^>]*>/g, '').trim();
        }

        return JSON.stringify([{
            description: description,
            aliases: aliases,
            airdate: airdate
        }]);
    } catch (error) {
        return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
    }
}

/** Extract episodes for a given anime */
async function extractEpisodes(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify([]);

        const htmlText = await response.text();
        const episodes = [];

        // Catch tags representing stream links or episode lists elements
        const regex = /<a\s+[^>]*href="([^"]+)"[^>]*>[\s\S]*?Episode\s*(\d+)/gi;
        let match;

        while ((match = regex.exec(htmlText)) !== null) {
            episodes.push({
                href: fixUrl(match[1]),
                number: parseInt(match[2], 10)
            });
        }

        // De-duplicate if items repeat in layout
        const uniqueEpisodes = Array.from(new Map(episodes.map(item => [item.number, item])).values());
        uniqueEpisodes.sort((a, b) => a.number - b.number);

        return JSON.stringify(uniqueEpisodes);
    } catch (error) {
        return JSON.stringify([]);
    }
}

/** Extract streaming options and subtitles */
async function extractStreamUrl(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify({ streams: [] });

        const htmlText = await response.text();
        const streamDetails = {
            streams: [],
            subtitles: ""
        };

        // Looks for embedded player endpoints (.m3u8, video configurations or iframe parameters)
        const streamRegex = /(?:file|src|url)\s*:\s*"([^"]+\.m3u8[^"]*)"/i;
        const match = streamRegex.exec(htmlText);

        if (match) {
            streamDetails.streams.push({
                title: "Animetsu Native • Multi-Res",
                streamUrl: match[1],
                headers: {
                    "Referer": "https://animetsu.net/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                }
            });
        }

        // Fallback: Check if an iframe path is hidden inside the player layout instead
        if (streamDetails.streams.length === 0) {
            const iframeRegex = /<iframe\s+[^>]*src="([^"]+)"/i;
            const iframeMatch = iframeRegex.exec(htmlText);
            if (iframeMatch) {
                streamDetails.streams.push({
                    title: "Mirror External Player",
                    streamUrl: fixUrl(iframeMatch[1]),
                    headers: { "Referer": "https://animetsu.net/" }
                });
            }
        }

        return JSON.stringify(streamDetails);
    } catch (error) {
        return JSON.stringify({ streams: [] });
    }
}
