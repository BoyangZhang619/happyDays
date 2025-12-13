// 注意：此代码适用于 Serverless 函数环境（如 Vercel, Netlify）
// 它将密钥安全地隐藏在环境变量中。

// 假设您在部署平台中设置了此环境变量
const API_KEY = process.env.ALIYUN_QWEN_API_KEY; 
const QWEN_MODEL_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

// Serverless 导出函数
export default async function handler(req, res) {
    // 关键配置 A: 设置 CORS 头部，允许您的静态网页访问
    // 生产环境请将 '*' 替换为您的 GitHub Pages 域名，例如: 'https://yourusername.github.io'
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理浏览器发送的预检请求 (OPTIONS)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    if (!API_KEY) {
        return res.status(500).json({ error: 'API Key not configured on the server.' });
    }

    try {
        // 1. 从前端请求中解析出用户输入的文本
        const { message } = req.body; 
        if (!message) {
            return res.status(400).json({ error: 'Missing message in request body' });
        }

        // 2. 构造通义千问的请求体
        const payload = {
            model: "qwen-turbo", // 使用免费额度较高的模型
            input: {
                messages: [{ role: "user", content: message }]
            },
            parameters: {
                 // 可选：设置模型的创造性，0-1.0，越低越保守
                temperature: 0.8
            }
        };

        // 3. 发起 API 调用 (注意：密钥放在 Authorization 头部，这是安全做法)
        const modelResponse = await fetch(QWEN_MODEL_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}` // 密钥在此处安全使用
            },
            body: JSON.stringify(payload)
        });

        const modelData = await modelResponse.json();

        // 4. 检查 API 自身是否报错
        if (modelData.code) {
             throw new Error(`Aliyun API Error: ${modelData.message}`);
        }

        // 5. 提取回复并返回给前端
        // 提取路径：output.choices[0].message.content
        const reply = modelData.output.choices[0].message.content;
        res.status(200).json({ reply: reply });

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
}
