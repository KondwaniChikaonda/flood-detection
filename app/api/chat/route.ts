import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not set in environment variables." },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { messages, context } = body;

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json(
                { error: "Invalid messages format." },
                { status: 400 }
            );
        }

   
        const systemInstruction = `
You are an intelligent flood risk assistant for Malawi.
You have access to real-time data about flood risks and rainfall.

Current System Data:
- High Risk Areas: ${JSON.stringify(context?.scanResults || [])}
- Rainfall Updates: ${JSON.stringify(context?.rainfallUpdates || [])}
- Selected Location Risk: ${JSON.stringify(context?.riskInfo || "None selected")}

Your goal is to help users understand this data.
- If they ask about high risk areas, list the ones from the data.
- If they ask about rainfall, mention the areas with high rainfall intensity.
- Be concise, helpful, and urgent if the risk is high.
- Do not make up data. Only use what is provided in the context.
`;

   
        const userMessage = messages[messages.length - 1]?.content || "";

    
        const prompt = `${systemInstruction}

User Question: ${userMessage}`;

   
        const geminiPayload = {
            contents: [{ parts: [{ text: prompt }] }],
        };

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(geminiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(geminiPayload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "Failed to fetch from Gemini API");
        }

        const data = await response.json();

  
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";

        return NextResponse.json({ role: "assistant", content: text });
    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return NextResponse.json(
            { error: "Failed to process chat request.", details: error.message },
            { status: 500 }
        );
    }
}
