import Redis from "ioredis";

export default async (req, context) => {
    // Nur POST Requests erlauben
    if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        const body = await req.json();
        const { name, score } = body;

        if (!name || typeof score !== 'number') {
            return new Response("Invalid data", { status: 400 });
        }

        const client = new Redis(process.env.REDIS_URL);
        const memberId = `${name}:::${Date.now()}`;

        await client.zadd("neon_leaderboard", score, memberId);
        
        client.quit();

        return new Response(JSON.stringify({ success: true }), { status: 200 });

    } catch (error) {
        console.error("Redis Error:", error);
        return new Response(error.toString(), { status: 500 });
    }
};