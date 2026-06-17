/**
 * Standard Fetch Wrapper (As required by the specification)
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
 * Search anime titles by keyword
 * Output: JSON-stringified AnimeSearchResult[]
 */
async function searchResults(keyword) {
    try {
        const cleanKeyword = encodeURIComponent(keyword);
        const targetUrl = `https://animetsu.live/search?keyword=${cleanKeyword}`;
        const response = await soraFetch(targetUrl);
        if (!response) return JSON.stringify([]);

        const htmlText = await response.text();
        const results = [];

        // Parsing layout with Regular Expressions (Non-DOM approach)
        // Matches typical card wrappers: <a href="..." title="..."><img src="..." .../>
        const regex = /<div[^>]*class="[^"]*anime-card[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*title="([^"]+)"[^>]*>\s*<img[^>]*src="([^"]+)"/gi;
        let match;

        while ((match = regex.exec(htmlText)) !== null) {
            let href = match[1];
            if (href.startsWith('/')) {
                href = 'https://animetsu.live' + href;
            }
            results.push({
                title: match[2].trim(),
                image: match[3],
                href: href
            });
        }

        // Fallback broad matching pattern if layout classes differ
        if (results.length === 0) {
            const fallbackRegex = /<a[^>]*href="([^"]+)"[^>]*>\s*<img[^>]*src="([^"]+)"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/gi;
            while ((match = fallbackRegex.exec(htmlText)) !== null) {
                let href = match[1];
                if (href.startsWith('/')) href = 'https://animetsu.live' + href;
                results.push({
                    title: match[3].trim(),
                    image: match[2],
                    href: href
                });
            }
        }

        return JSON.stringify(results);
    } catch (error) {
        return JSON.stringify([]);
    }
}

/**
 * Extract metadata details of a given anime
 * Output: JSON-stringified Array containing exactly one object
 */
async function extractDetails(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);

        const htmlText = await response.text();

        // Extract description
        let description = "";
        const descMatch = htmlText.match(/<div[^>]*class="[^"]*synopsis[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        if (descMatch) {
            description = descMatch[1].replace(/<[^>]*>/g, '').trim();
        }

        // Extract alternative titles/aliases
        let aliases = "";
        const aliasMatch = htmlText.match(/(?:Alternative|Synonyms|English):\s*<\/span>\s*<span>([^<]+)/i);
        if (aliasMatch) {
            aliases = aliasMatch[1].trim();
        }

        // Extract airdate
        let airdate = "Unknown";
        const airMatch = htmlText.match(/(?:Aired|Released):\s*<\/span>\s*<span>([^<]+)/i);
        if (airMatch) {
            airdate = airMatch[1].trim();
        }

        return JSON.stringify([
            {
                description: description || "No description available.",
                aliases: aliases,
                airdate: airdate
            }
        ]);
    } catch (error) {
        return JSON.stringify([{ description: "", aliases: "", airdate: "" }]);
    }
}

/**
 * Extract episodes for a given anime
 * Output: JSON-stringified AnimeEpisode[]
 */
async function extractEpisodes(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify([]);

        const htmlText = await response.text();
        const episodes = [];

        // Global regex look for episode links (e.g., href="/watch/anime-slug/episode-1")
        const regex = /<a[^>]*href="([^"]*\/watch\/[^"]+)"[^>]*>[\s\S]*?(?:Ep|Episode)\s*(\d+(\.\d+)?)/gi;
        let match;

        while ((match = regex.exec(htmlText)) !== null) {
            let href = match[1];
            if (href.startsWith('/')) {
                href = 'https://animetsu.live' + href;
            }
            episodes.push({
                href: href,
                number: parseFloat(match[2])
            });
        }

        // Sort episodes numerically ascending
        episodes.sort((a, b) => a.number - b.number);

        return JSON.stringify(episodes);
    } catch (error) {
        return JSON.stringify([]);
    }
}

/**
 * Extract streaming options and subtitles
 * Output: JSON-stringified AnimeStreamDetails
 */
async function extractStreamUrl(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify({ streams: [] });

        const htmlText = await response.text();
        const streams = [];

        // Parse standard iframe / embed sources
        const iframeMatch = htmlText.match(/<iframe[^>]*src="([^"]+)"/i);
        let playerUrl = iframeMatch ? iframeMatch[1] : null;

        // Alternative: Look for data-embed attribute configurations
        if (!playerUrl) {
            const dataEmbedMatch = htmlText.match(/data-status="[^"]*"[^>]*data-embed="([^"]+)"/i);
            if (dataEmbedMatch) playerUrl = dataEmbedMatch[1];
        }

        if (playerUrl) {
            if (playerUrl.startsWith('//')) playerUrl = 'https:' + playerUrl;
            
            // Map common streaming providers found on these layouts
            streams.push({
                title: "Auto Stream (1080p)",
                streamUrl: playerUrl,
                headers: {
                    "Referer": "https://animetsu.live/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                }
            });
        }

        // Inline direct playlist source catcher (.m3u8 parsing) inside <script> blocks
        const m3u8Match = htmlText.match(/file["']?\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i) || 
                          htmlText.match(/src["']?\s*:\s*["']([^"']+\.m3u8[^"']*)["']/i);
        
        if (m3u8Match) {
            streams.push({
                title: "HLS High Speed Native",
                streamUrl: m3u8Match[1],
                headers: {
                    "Referer": "https://animetsu.live/"
                }
            });
        }

        return JSON.stringify({
            streams: streams
        });
    } catch (error) {
        return JSON.stringify({ streams: [] });
    }
}
