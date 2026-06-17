const BASE_URL = "https://animetsu.net";
const API_URL = `${BASE_URL}/v2/api/anime`;
const PROXY = "https://swiftstream.top/proxy";

async function soraFetch(url, options = {}) {
    const headers = options.headers || {};

    headers["User-Agent"] =
        headers["User-Agent"] ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

    headers["Accept"] = "application/json";
    headers["Referer"] = BASE_URL;

    const fn = typeof fetchv2 === "function" ? fetchv2 : fetch;

    return fn(url, {
        method: options.method || "GET",
        headers,
        body: options.body || null
    });
}

/* IMPORTANT: NO JSON STRINGIFY */
async function searchResults(query) {
    try {
        const res = await soraFetch(
            `${API_URL}/search/?query=${encodeURIComponent(query)}`
        );

        const json = await res.json();

        const list = Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json?.results)
            ? json.results
            : [];

        return list.map(a => ({
            title: a.title || a.name || "",
            image: a.poster || a.image || "",
            href: `${BASE_URL}/anime/${a.id}`
        }));
    } catch {
        return [];
    }
}

async function extractDetails(url) {
    try {
        const id = url.split("/").filter(Boolean).pop();

        const res = await soraFetch(`${API_URL}/info/${id}`);
        const json = await res.json();

        return {
            description: json.description || json.synopsis || "",
            aliases: json.alternativeTitles?.join(", ") || "",
            airdate: json.releaseDate || json.year || ""
        };
    } catch {
        return {};
    }
}

async function extractEpisodes(url) {
    try {
        const id = url.split("/").filter(Boolean).pop();

        const res = await soraFetch(`${API_URL}/eps/${id}`);
        const json = await res.json();

        const list = json.episodes || json.data || [];

        return list.map(ep => {
            const n = ep.number ?? ep.episodeNumber ?? 0;
            return {
                href: `${id}/${n}`,
                number: Number(n)
            };
        });
    } catch {
        return [];
    }
}

async function extractStreamUrl(url) {
    try {
        const parts = url.split("/").filter(Boolean);

        const episode = parts.pop();
        const animeId = parts.pop();

        const res = await soraFetch(
            `${API_URL}/oppai/${animeId}/${episode}?server=default&source_type=sub`
        );

        const json = await res.json();

        const streams = (json.sources || []).map(s => ({
            title: s.quality || "Auto",
            streamUrl: s.url.startsWith("/")
                ? `${PROXY}${s.url}`
                : s.url,
            headers: {
                Referer: BASE_URL
            }
        }));

        const subtitles = (json.subs || []).map(s => ({
            url: s.url,
            lang: s.lang || "unknown"
        }));

        return { streams, subtitles };
    } catch {
        return { streams: [], subtitles: [] };
    }
}

/* CRITICAL PART */
module.exports = {
    searchResults,
    extractDetails,
    extractEpisodes,
    extractStreamUrl
};
