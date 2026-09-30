export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { message } = req.body;
    const openRouterApiKey = process.env.OPENROUTER_API_KEY;
    const tavilyApiKey = process.env.TAVILY_API_KEY; // API Key buat cari data di internet

    if (!openRouterApiKey) {
        return res.status(500).json({ error: 'OpenRouter API Key belum diset di Vercel.' });
    }

    let webContext = "";

    // 1. Cari data real-time ke internet lewat Tavily API (jika API key-nya dipasang)
    if (tavilyApiKey) {
        try {
            const searchResponse = await fetch("https://api.tavily.com/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: tavilyApiKey,
                    query: message,
                    max_results: 3 // Mengambil 3 referensi teratas dari internet
                })
            });

            const searchData = await searchResponse.json();
            if (searchData.results && searchData.results.length > 0) {
                webContext = "Berikut adalah informasi real-time dari internet:\n" + 
                    searchData.results.map(r => `- Sumber (${r.url}): ${r.content}`).join("\n");
            }
        } catch (searchError) {
            console.error("Gagal melakukan pencarian internet:", searchError);
        }
    }

    // 2. Susun pesan untuk dikirim ke OpenRouter (AI)
    try {
        const systemPrompt = "Kamu adalah Zeno, asisten AI pribadi yang cerdas dan informatif. " + 
            (webContext ? "Gunakan informasi internet berikut jika relevan untuk menjawab:\n" + webContext : "");

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openRouterApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "openai/gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ]
            })
        });

        const data = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            const reply = data.choices[0].message.content;
            return res.status(200).json({ reply });
        } else {
            return res.status(500).json({ error: 'Gagal mendapatkan respons dari AI.' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Terjadi kesalahan pada server backend.' });
    }
}
