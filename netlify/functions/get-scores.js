import Redis from "ioredis";

export default async (req, context) => {
    try {
        const client = new Redis(process.env.REDIS_URL);

        // ZREVRANGE: Hole Top 10
        const rawData = await client.zrevrange("neon_leaderboard", 0, 9, "WITHSCORES");
        
        client.quit();

        // Formatierung
        const formattedScores = [];
        for (let i = 0; i < rawData.length; i += 2) {
            const memberId = rawData[i];
            const score = parseInt(rawData[i+1]);
            const cleanName = memberId.split(':::')[0];

            formattedScores.push({ name: cleanName, score: score });
        }

        return new Response(JSON.stringify(formattedScores), {
            headers: { "Content-Type": "application/json" },
            status: 200
        });

    } catch (error) {
        console.error("Redis Error:", error);
        return new Response(JSON.stringify([]), { status: 500 });
    }
};