// =================================================================
// 文件名: api/qwen_proxy.js
// 目的: 最终版本，解决模型权限/额度问题，并使用兼容模式 URL
// =================================================================

// 1. 配置
const API_KEY = process.env.ALIYUN_QWEN_API_KEY; 
// 使用兼容模式的 Base URL，并加上 /chat/completions 路径
const QWEN_MODEL_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'; 
// 您的自定义域名
const ALLOWED_ORIGIN = 'https://zbyblq.xin'; 

// 导出 Serverless 函数的主处理器
export default async function handler(req, res) {
    // CORS 设置
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }
    if (!API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: ALIYUN_QWEN_API_KEY is missing.' });
    }

    try {
        let message;
        
        try {
            message = req.body.message;
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON body.' });
        }

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Request body must contain a valid "message" string.' });
        }

        // 2. 构造通义千问的请求体 (兼容模式结构，模型切换为 qwen-plus)
        const payload = {
            model: "qwen-plus", // <<< 已切换为您截图上推荐的模型
            messages: [
                { role: "user", content: message }
            ],
            temperature: 0.8
        };

        // 3. 发起 API 调用
        const modelResponse = await fetch(QWEN_MODEL_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const modelData = await modelResponse.json();

        // 4. 健壮性检查 (捕获阿里云返回的错误)
        if (modelData.code) {
             console.error("Aliyun API returned error:", modelData);
             const errorMessage = `Aliyun API Error: ${modelData.message} (Code: ${modelData.code})`;
             throw new Error(errorMessage);
        }
        
        // 5. 安全地提取回复内容 (解决 undefined 错误)
        const choices = modelData.choices && modelData.choices.length > 0 ? modelData.choices : null;
        
        if (!choices || !choices[0].message || !choices[0].message.content) {
             console.error("Model did not return valid choices or response:", modelData);
             throw new Error("Model response structure is invalid or response is empty.");
        }

        const reply = choices[0].message.content;

        // 6. 返回成功结果
        res.status(200).json({ reply: reply });

    } catch (error) {
        console.error("Backend Runtime Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error (Check Vercel Logs)' });
    }
}
