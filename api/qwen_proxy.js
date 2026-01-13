// =================================================================
// 文件名: api/qwen_proxy.js
// 目的: 最终版本（更新CORS以支持新域名/子域名）
// =================================================================

// 1. 配置
const API_KEY = process.env.ALIYUN_QWEN_API_KEY;
// 使用兼容模式的 Base URL，并加上 /chat/completions 路径
const QWEN_MODEL_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

// ✅ 允许的来源（把你的新域名加进来）
// 你也可以继续添加本地调试域名
const ALLOWED_ORIGINS = new Set([
  'https://zbyblq.xin',
  'https://greeting.zbyblq.xin',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
]);

// 导出 Serverless 函数的主处理器
export default async function handler(req, res) {
  // =========================
  // ✅ CORS（动态回显）
  // =========================
  const origin = req.headers.origin || '';

  // 只对允许的 origin 回显，否则不返回 Allow-Origin（浏览器会拦截）
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // ✅ 关键：避免 CDN/浏览器缓存把一个 origin 的结果复用到另一个 origin
  res.setHeader('Vary', 'Origin');

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // 让预检缓存一会儿，减少 OPTIONS 次数（单位秒）
  res.setHeader('Access-Control-Max-Age', '86400');

  // 预检请求直接放行
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  if (!API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: ALIYUN_QWEN_API_KEY is missing.' });
  }

  try {
    // =========================
    // ✅ 更稳健地读取 message
    // =========================
    let body = req.body;

    // 某些运行时/配置下 req.body 可能是字符串
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON body.' });
      }
    }

    const message = body && body.message;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Request body must contain a valid "message" string.' });
    }

    // 2. 构造通义千问的请求体 (兼容模式结构，模型：qwen-plus)
    const payload = {
      model: 'qwen-plus',
      messages: [{ role: 'user', content: message }],
      temperature: 0.8,
    };

    // 3. 发起 API 调用
    const modelResponse = await fetch(QWEN_MODEL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const modelData = await modelResponse.json();

    // 4. 健壮性检查 (捕获阿里云返回的错误)
    if (modelData && modelData.code) {
      console.error('Aliyun API returned error:', modelData);
      const errorMessage = `Aliyun API Error: ${modelData.message} (Code: ${modelData.code})`;
      throw new Error(errorMessage);
    }

    // 5. 安全地提取回复内容
    const choices = modelData?.choices && modelData.choices.length > 0 ? modelData.choices : null;

    if (!choices || !choices[0]?.message?.content) {
      console.error('Model did not return valid choices or response:', modelData);
      throw new Error('Model response structure is invalid or response is empty.');
    }

    const reply = choices[0].message.content;

    // 6. 返回成功结果
    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Backend Runtime Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error (Check Vercel Logs)' });
  }
}
