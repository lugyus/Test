const BASE_URL = "https://animetsu.net";

async function soraFetch(url, options = { headers: {}, method: "GET", body: null }) {
    const headers = options.headers || {};

    if (!headers["User-Agent"]) {
        headers["User-Agent"] =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
    }

    try {
        return await fetchv2(
            url,
            headers,
            options.method || "GET",
            options.body || null
        );
    } catch (e) {
        try {
            return await fetch(url, options);
        } catch (_) {
            return null;
        }
    }
}

async function searchResults(keyword) {
    try {
        const res = await soraFetch(
            `${BASE_URL}/v2/api/anime/search/?query=${encodeURIComponent(keyword)}`
        );

        if (!res) return JSON.stringify([]);

        const data = await res.json();

        const results = (data.results || []).map(item => ({
            title:
                item.title?.english ||
                item.title?.romaji ||
                item.title?.native ||
                "Unknown",
            image:
                item.cover_image?.large ||
                item.cover_image?.medium ||
                "",
            href: `${BASE_URL}/anime/${item.id}`
        }));

        return JSON.stringify(results);
    } catch (e) {
        return JSON.stringify([]);
    }
}

async function extractDetails(url) {
    try {
        const animeId = url.split("/").pop();

        const res = await soraFetch(
            `${BASE_URL}/v2/api/anime/info/${animeId}`
        );

        if (!res) return JSON.stringify([]);

        const data = await res.json();

        return JSON.stringify([
            {
                description: data.description || "",
                aliases: [
                    data.title?.english,
                    data.title?.romaji,
                    data.title?.native
                ]
                    .filter(Boolean)
                    .join(", "),
                airdate:
                    data.start_date?.year?.toString() ||
                    ""
            }
        ]);
    } catch (e) {
        return JSON.stringify([]);
    }
}

async function extractEpisodes(url) {
    try {
        const animeId = url.split("/").pop();

        const res = await soraFetch(
            `${BASE_URL}/v2/api/anime/eps/${animeId}`
        );

        if (!res) return JSON.stringify([]);

        const episodes = await res.json();

        const results = episodes.map(ep => ({
            href: `${animeId}|${ep.ep_num}`,
            number: Number(ep.ep_num)
        }));

        return JSON.stringify(results);
    } catch (e) {
        return JSON.stringify([]);
    }
}

async function extractStreamUrl(url) {
    try {
        const [animeId, episode] = url.split("|");

        const serverRes = await soraFetch(
            `https://animetsu.net/v2/api/anime/servers/${animeId}/${episode}`
        );

        const servers = await serverRes.json();

        const server =
            (servers.find(x => x.default) || servers[0])?.id || "kite";

        const streamRes = await soraFetch(
            `https://animetsu.net/v2/api/anime/oppai/${animeId}/${episode}?server=${server}&source_type=sub`
        );

        const data = await streamRes.json();

        const streams = [];

        for (const source of (data.sources || [])) {

            streams.push({
                title: source.quality || "Auto",
                streamUrl:
                    source.need_proxy
                        ? "https://swiftstream.top/proxy" + source.url
                        : source.url,
                headers: {
                    Referer: "https://animetsu.net/",
                    Origin: "https://animetsu.net"
                }
            });
        }

        return JSON.stringify({
            streams,
            subtitles:
                data.subs?.[0]?.url || ""
        });

    } catch (e) {
        return JSON.stringify({
            streams: []
        });
    }
}
