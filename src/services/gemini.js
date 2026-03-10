import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let genAI = null;
let model = null;

export const initGemini = (apiKey = null) => {
    const key = apiKey ? apiKey.trim() : (API_KEY ? API_KEY.trim() : null);
    if (!key) {
        throw new Error("API Key no configurada");
    }
    // Always re-init if key provided to support temporary keys
    if (apiKey || !genAI) {
        genAI = new GoogleGenerativeAI(key);
        model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    }
    return model;
};

export const generateContent = async (prompt, imagePart = null, apiKey = null) => {
    try {
        const aiModel = initGemini(apiKey);

        let result;
        if (imagePart) {
            result = await aiModel.generateContent([prompt, imagePart]);
        } else {
            result = await aiModel.generateContent(prompt);
        }

        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Error, falling back to Mock:", error);
        return `⚠️ **AVISO: Modo Simulación Activado** (La API de Gemini falló)\n\nBase en los datos proporcionados:\n- Se observa una tendencia estable en los tiempos de atención.\n- Hay oportunidades de mejora en la asignación de recursos para los procesos críticos.\n- Se recomienda revisar los casos fuera de ANS individualmente.\n\n(Error original: ${error.message || "Desconocido"})`;
    }
};

// Helper parea convertir File object a GenerativePart
export const fileToGenerativePart = async (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = reader.result.split(',')[1];
            resolve({
                inlineData: {
                    data: base64Data,
                    mimeType: file.type,
                },
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const checkAvailableModels = async (apiKey = null) => {
    const key = apiKey || API_KEY;
    if (!key) return ["Error: No API Key"];
    const genAI = new GoogleGenerativeAI(key);
    const candidates = [
        "gemini-1.5-flash",
        "gemini-pro"
    ];
    let results = [];

    for (const m of candidates) {
        try {
            const model = genAI.getGenerativeModel({ model: m });
            // countTokens is lighter than generateContent to check availability
            await model.countTokens("Test");
            results.push(`✅ ${m}: OK`);
        } catch (e) {
            results.push(`❌ ${m}: ${e.message.split(']')[1] || e.message}`);
        }
    }
    return results;
};
