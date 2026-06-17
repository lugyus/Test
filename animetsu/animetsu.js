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

/** Search anime titles by keyword using the correct API endpoint from HAR file */
async function searchResults(keyword) {
    try {
        const url = `https://animetsu.net/v2/api/anime/search?page=1&per_page=12&q=${encodeURIComponent(keyword)}`;
        const response = await soraFetch(url);
        if (!response) return JSON.stringify([]);
        const data = await response.json();

        // Check if data.results exists
        if (data && data.results) {
            const results = data.results.map(anime => ({
                title: anime.title.english || anime.title.romaji || anime.title.native,
                image: anime.cover_image?.large,
                href: `https://animetsu.net/anime/${anime.id}`,
                description: anime.description,
                total_eps: anime.total_eps,
                start_date: anime.start_date,
                end_date: anime.end_date,
                score: anime.average_score,
                genres: anime.genres,
                trailer: anime.trailer,
                season: anime.season
            }));
            return JSON.stringify(results);
        } else {
            return JSON.stringify([]);
        }
    } catch (e) {
        return JSON.stringify([]);
    }
}

/** Extract metadata details of a given anime */
async function extractDetails(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return JSON.stringify([{}]);
        const html = await response.text();

        // Example extraction, adjust based on actual site structure
        const descriptionMatch = html.match(/<div class="description">([\s\S]*?)<\/div>/);
        const description = descriptionMatch ? descriptionMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        const aliasesMatch = html.match(/<div class="aliases">([\s\S]*?)<\/div>/);
        const aliases = aliasesMatch ? aliasesMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        const airdateMatch = html.match(/<div class="airdate">([^<]+)<\/div>/);
        const airdate = airdateMatch ? airdateMatch[1].trim() : '';

        const result = {
            description,
            aliases,
            airdate
        };
        return JSON.stringify([result]);
    } catch (e) {
        return JSON.stringify([{}]);
    }
}

/** Extract episodes for a given anime */
async function extractEpisodes(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return [];
        const html = await response.text();

        // Example pattern, adjust as needed
        const episodes = [];
        const regex = /<a href="([^"]+)" class="episode-link">Episode (\d+)<\/a>/gi;
        let match;
        while ((match = regex.exec(html)) !== null) {
            episodes.push({
                href: match[1],
                number: parseInt(match[2], 10)
            });
        }
        return episodes;
    } catch (e) {
        return [];
    }
}

/** Extract streaming options and subtitles */
async function extractStreamUrl(url) {
    try {
        const response = await soraFetch(url);
        if (!response) return { streams: [] };
        const html = await response.text();

        // Example: find HLS stream URL in a script or data attribute
        const streamMatch = html.match(/"streamUrl":"(https:\/\/[^"]+\.m3u8)"/);
        const streamUrl = streamMatch ? streamMatch[1] : null;

        // Optional subtitles
        const subtitleMatch = html.match(/"subtitles":"(https:\/\/[^"]+\.vtt)"/);
        const subtitles = subtitleMatch ? subtitleMatch[1] : null;

        const streams = streamUrl ? [{
            title: "Main Stream",
            streamUrl: streamUrl
        }] : [];

        return { streams, subtitles };
    } catch (e) {
        return { streams: [] };
    }
}
