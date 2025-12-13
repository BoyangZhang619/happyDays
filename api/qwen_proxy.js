// 注意：此代码适用于 Serverless 函数环境（如 Vercel, Netlify）
// 它将密钥安全地隐藏在环境变量中。

// 假设您在部署平台中设置了此环境变量
const API_KEY = process.env.ALIYUN_QWEN_API_KEY; 
const QWEN_MODEL_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const ALLOWED_ORIGIN = 'https://zbyblq.xin'; // 生产环境请替换为您的 GitHub Pages 域名，例如: 'https://username.github.io'

// 导出 Serverless 函数的主处理器
export default async function handler(req, res) {
    // 1. 设置 CORS 头部：允许前端跨域访问
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN); 
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理浏览器的预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    if (!API_KEY) {
        // 如果环境变量未设置，返回明确的 500 错误
        return res.status(500).json({ error: 'Server configuration error: ALIYUN_QWEN_API_KEY is missing.' });
    }

    try {
        let message;
        
        // 尝试解析请求体
        try {
            message = req.body.message;
        } catch (e) {
            return res.status(400).json({ error: 'Invalid JSON body.' });
        }

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Request body must contain a valid "message" string.' });
        }

        // 2. 构造通义千问的请求体
        const payload = {
            model: "qwen-turbo", // 推荐使用免费额度较高的模型
            input: {
                messages: [{ role: "user", content: message }]
            },
            parameters: {
                temperature: 0.8
            }
        };

        // 3. 发起 API 调用
        const modelResponse = await fetch(QWEN_MODEL_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}` // 密钥在此处安全使用
            },
            body: JSON.stringify(payload)
        });

        const modelData = await modelResponse.json();

        // 4. 【关键纠错】检查阿里云 API 是否返回了错误代码
        if (modelData.code) {
             // 如果 API 返回错误，可能是密钥错误、额度问题等
             console.error("Aliyun API returned error:", modelData);
             const errorMessage = `Aliyun API Error: ${modelData.message} (Code: ${modelData.code})`;
             throw new Error(errorMessage);
        }
        
        // 5. 【关键纠错】安全地提取回复内容 (解决 undefined 错误)
        const choices = modelData.output && 
                        modelData.output.choices && 
                        modelData.output.choices.length > 0
                        ? modelData.output.choices 
                        : null;

        if (!choices) {
             // 数据结构不符合预期或回复为空
             console.error("Model did not return valid choices:", modelData);
             throw new Error("Model response structure is invalid or response is empty.");
        }

        // 提取回复文本
        const reply = choices[0].message.content;

        // 6. 返回成功结果给前端
        res.status(200).json({ reply: reply });

    } catch (error) {
        // 捕获所有运行时错误，返回友好的 500 错误信息
        console.error("Backend Runtime Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error (Check Vercel Logs)' });
    }
}
