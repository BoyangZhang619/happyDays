// API代理URL
const PROXY_URL = "https://happy-days-rho.vercel.app/api/qwen_proxy";

// 选中的装饰品（背包统计）
const selectedDecorations = {};
let selectedLanguage = 'zh';

// 语言配置（保留你原来的）
const languageConfig = {
  zh: { name: '中文', prompt: '用中文回复，语调要亲切温馨，富有中国传统文化韵味' },
  en: { name: 'English', prompt: 'Please reply in English with a warm and friendly tone, celebrating Chinese New Year' },
  ja: { name: '日本語', prompt: '日本語で温かく親しみやすい口調で、中国の春節をお祝いする内容で回答してください' },
  ko: { name: '한국어', prompt: '한국어로 따뜻하고 친근한 어조로 중국 설날을 축하하는 내용으로 답변해 주세요' }
};

// 春节元素名称映射（保留你原来的）
const decorationNames = {
  redEnvelope: '红包',
  lantern: '灯笼',
  firecracker: '鞭炮',
  firework: '烟花',
  horse: '马年吉祥',
  dragon: '神龙',
  dumpling: '饺子',
  tangyuan: '汤圆',
  fish: '年年有鱼',
  gold: '金元宝',
  fortune: '福字',
  couplet: '春联',
  plumBlossom: '梅花',
  peach: '桃花',
  tea: '茶香',
  family: '阖家团圆'
};

// 元素对应 emoji（用于场景散落 + 背包 pill）
const decorationEmoji = {
  redEnvelope: '🧧',
  lantern: '🏮',
  firecracker: '🧨',
  firework: '🎆',
  horse: '🐴',
  dragon: '🐉',
  dumpling: '🥟',
  tangyuan: '🍡',
  fish: '🐟',
  gold: '🏆',
  fortune: '🎊',
  couplet: '📜',
  plumBlossom: '🌸',
  peach: '🍑',
  tea: '🍵',
  family: '👨‍👩‍👧‍👦'
};

// 你想“散落若干数量”的配置（可按喜好调）
const spawnPlan = {
  redEnvelope: 10,
  lantern: 7,
  firecracker: 7,
  firework: 6,
  horse: 4,
  dragon: 4,
  dumpling: 6,
  tangyuan: 5,
  fish: 5,
  gold: 4,
  fortune: 4,
  couplet: 4,
  plumBlossom: 4,
  peach: 4,
  tea: 4,
  family: 4
};

// 拾取历史（撤销用）
const pickupHistory = [];

// DOM refs
let playgroundEl, bagPillsEl, bagIconEl;
let undoBtn, clearBtn, respawnBtn;

// ========== 语言选择（保持 HTML onclick 调用） ==========
function selectLanguage(element) {
  document.querySelectorAll('.language-item').forEach(item => item.classList.remove('selected'));
  element.classList.add('selected');
  selectedLanguage = element.dataset.language;
}

// ========== 背包 UI ==========
function buildBagPills() {
  bagPillsEl.innerHTML = '';
  Object.keys(decorationNames).forEach(type => {
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.dataset.type = type;
    pill.innerHTML = `
      <span class="pEm">${decorationEmoji[type] || '✨'}</span>
      <span class="pName">${decorationNames[type]}</span>
      <span class="pCount">0</span>
    `;
    bagPillsEl.appendChild(pill);
  });
}

function updateBagPills() {
  const pills = bagPillsEl.querySelectorAll('.pill');
  pills.forEach(p => {
    const type = p.dataset.type;
    const count = selectedDecorations[type] || 0;
    p.querySelector('.pCount').textContent = String(count);
  });
}

// ========== 场景撒物件 ==========
function rand(min, max) { return Math.random() * (max - min) + min; }

function isFarEnough(x, y, points, minDist) {
  for (const pt of points) {
    const dx = pt.x - x, dy = pt.y - y;
    if (dx * dx + dy * dy < minDist * minDist) return false;
  }
  return true;
}

function createPickItem(type, x, y) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pickItem float';
  btn.dataset.type = type;

  // 视觉随机
  const size = Math.round(rand(22, 40)) + 'px';
  const rot = Math.round(rand(-18, 18)) + 'deg';
  const scale = rand(0.9, 1.25).toFixed(2);

  btn.style.left = x + 'px';
  btn.style.top = y + 'px';
  btn.style.setProperty('--size', size);
  btn.style.setProperty('--rot', rot);
  btn.style.setProperty('--scale', scale);

  btn.innerHTML = `<span class="emoji">${decorationEmoji[type] || '✨'}</span>`;
  btn.setAttribute('aria-label', decorationNames[type] || type);

  return btn;
}

function spawnItems() {
  playgroundEl.innerHTML = '';

  const rect = playgroundEl.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  // 边距：避免贴边
  const pad = 18;
  // 简易防重叠：每个点至少距离
  const minDist = 44;

  const points = [];

  Object.entries(spawnPlan).forEach(([type, count]) => {
    for (let i = 0; i < count; i++) {
      let tries = 0;
      let x, y;

      do {
        x = rand(pad, w - pad);
        y = rand(pad, h - pad);
        tries++;
        // 尝试多次仍不行就放弃防重叠
        if (tries > 40) break;
      } while (!isFarEnough(x, y, points, minDist));

      points.push({ x, y });
      const item = createPickItem(type, x, y);
      playgroundEl.appendChild(item);
    }
  });
}

// ========== 拾取：点一个捡一个 + 飞入背包动画 ==========
function flyToBagAnimation(sourceEl) {
  const src = sourceEl.getBoundingClientRect();
  const dst = bagIconEl.getBoundingClientRect();

  const clone = sourceEl.cloneNode(true);
  clone.classList.remove('float');
  clone.style.position = 'fixed';
  clone.style.left = src.left + 'px';
  clone.style.top = src.top + 'px';
  clone.style.zIndex = 9999;
  clone.style.margin = '0';
  clone.style.pointerEvents = 'none';

  document.body.appendChild(clone);

  const dx = (dst.left + dst.width / 2) - (src.left + src.width / 2);
  const dy = (dst.top + dst.height / 2) - (src.top + src.height / 2);

  requestAnimationFrame(() => {
    clone.style.transition = 'transform 420ms cubic-bezier(.2,.9,.2,1), opacity 420ms ease';
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.2) rotate(18deg)`;
    clone.style.opacity = '0.15';
  });

  setTimeout(() => clone.remove(), 460);
}

function pickUpItem(itemEl) {
  const type = itemEl.dataset.type;

  // 更新背包数据
  selectedDecorations[type] = (selectedDecorations[type] || 0) + 1;
  pickupHistory.push({ type });

  // 动画 + 移除
  flyToBagAnimation(itemEl);
  itemEl.remove();

  // 更新 HUD
  updateBagPills();
}

// 事件委托：点到 pickItem 就拾取
function bindPlaygroundClick() {
  playgroundEl.addEventListener('click', (e) => {
    const item = e.target.closest('.pickItem');
    if (!item) return;
    pickUpItem(item);
  }, { passive: true });
}

// ========== 撤销/清空/重撒 ==========
function undoPickup() {
  const last = pickupHistory.pop();
  if (!last) return;

  const { type } = last;
  if (selectedDecorations[type]) {
    selectedDecorations[type]--;
    if (selectedDecorations[type] <= 0) delete selectedDecorations[type];
  }

  // 把一个物件“放回场景”
  const rect = playgroundEl.getBoundingClientRect();
  const x = rand(18, rect.width - 18);
  const y = rand(18, rect.height - 18);
  playgroundEl.appendChild(createPickItem(type, x, y));

  updateBagPills();
}

function clearBag() {
  Object.keys(selectedDecorations).forEach(k => delete selectedDecorations[k]);
  pickupHistory.length = 0;
  updateBagPills();
}

function respawnAll() {
  clearBag();
  spawnItems();
}

// ========== 生成春节祝福语（保留你的核心逻辑） ==========
async function generateBlessing() {
  const outputDiv = document.getElementById("modelOutput");
  const generateButton = document.getElementById("generateButton");

  const selectedItems = Object.keys(selectedDecorations);
  if (selectedItems.length === 0) {
    outputDiv.innerHTML = "🧧 你的背包还是空的！先去场景里捡几个元素再来生成吧～";
    return;
  }

  generateButton.disabled = true;
  outputDiv.innerHTML = "🧧 财神爷正在为你精心准备专属新年祝福... ✨🎊";

  try {
    const decorationsList = Object.keys(selectedDecorations).map(type =>
      `${selectedDecorations[type]}个${decorationNames[type]}`
    ).join('、');

    const prompt = `你是一个充满中国春节气氛的AI助手。请根据用户选择的春节元素，生成一段温馨、有创意的新年祝福语。

用户选择的春节元素：${decorationsList}
用户选择的语言：${languageConfig[selectedLanguage].name}
当前年份：2026年（马年）

请你：
1. 创作一段包含这些春节元素的新年祝福语
2. 语言要温暖、富有诗意，充满中国传统文化的美好氛围
3. 可以融入这些元素的象征意义（比如红包代表财运，灯笼代表光明，饺子代表团圆，鱼代表年年有余等）
4. 可以适当加入马年相关的吉祥话（如马到成功、龙马精神等）
5. 控制在100-200字左右
6. ${languageConfig[selectedLanguage].prompt}

请开始创作这段专属的春节祝福语：`;

    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt }),
    });

    const data = await response.json();

    if (response.ok && data.reply) {
      outputDiv.innerHTML = `🧧 ${data.reply} 🐴`;
    } else {
      outputDiv.innerHTML = "🐴 抱歉，财神爷暂时忙碌中，请稍后再试... 🧧";
    }
  } catch (error) {
    console.error("生成祝福语时出错:", error);
    outputDiv.innerHTML = "🎆 网络连接似乎有些问题，祝福传递被烟花阻挡了... 请稍后重试！ 🐴";
  } finally {
    generateButton.disabled = false;
  }
}

// ========== 你原来的节日特效（保留） ==========
function createFallingElement() {
  const container = document.getElementById('fireworkContainer');
  const element = document.createElement('div');
  element.classList.add('falling-element');

  const festiveChars = ['🧧', '🏮', '✨', '💰', '🎊', '🎉', '⭐', '🌟', '💫', '🔴'];
  element.innerHTML = festiveChars[Math.floor(Math.random() * festiveChars.length)];

  element.style.left = Math.random() * 100 + '%';
  element.style.fontSize = (Math.random() * 20 + 15) + 'px';
  element.style.opacity = Math.random() * 0.6 + 0.4;
  element.style.zIndex = 200;
  const duration = Math.random() * 4000 + 3000;
  element.style.animationDuration = duration + 'ms';

  container.appendChild(element);

  setTimeout(() => {
    if (element.parentNode) element.parentNode.removeChild(element);
  }, duration);
}

function createFirework(x, y) {
  const container = document.getElementById('fireworkContainer');
  const colors = ['#FFD700', '#FF6347', '#FF69B4', '#00CED1', '#32CD32', '#FF4500', '#FFFF00'];

  for (let i = 0; i < 12; i++) {
    const particle = document.createElement('div');
    particle.classList.add('firework');
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    particle.style.boxShadow = `0 0 6px ${particle.style.backgroundColor}`;
    particle.style.zIndex = 200;

    const angle = (i / 12) * Math.PI * 2;
    const velocity = 50 + Math.random() * 50;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;

    particle.style.setProperty('--tx', tx + 'px');
    particle.style.setProperty('--ty', ty + 'px');

    container.appendChild(particle);

    setTimeout(() => {
      if (particle.parentNode) particle.parentNode.removeChild(particle);
    }, 1500);
  }
}

function randomFirework() {
  const x = Math.random() * window.innerWidth;
  const y = Math.random() * (window.innerHeight * 0.55);
  createFirework(x, y);
}

function startFestiveEffects() {
  const isMobile = window.innerWidth <= 768;
  const elementInterval = isMobile ? Math.random() * 700 + 320 : Math.random() * 450 + 160;
  createFallingElement();
  setTimeout(startFestiveEffects, elementInterval);
}

// ========== 初始化 ==========
window.addEventListener('DOMContentLoaded', () => {
  playgroundEl = document.getElementById('playground');
  bagPillsEl = document.getElementById('bagPills');
  bagIconEl = document.getElementById('bagIcon');

  undoBtn = document.getElementById('undoBtn');
  clearBtn = document.getElementById('clearBtn');
  respawnBtn = document.getElementById('respawnBtn');

  buildBagPills();
  updateBagPills();

  spawnItems();
  bindPlaygroundClick();

  undoBtn.addEventListener('click', undoPickup);
  clearBtn.addEventListener('click', clearBag);
  respawnBtn.addEventListener('click', respawnAll);

  // 节日效果
  startFestiveEffects();
  const isMobile = window.innerWidth <= 768;
  setInterval(randomFirework, isMobile ? 8500 : 5200);
});

// 窗口变化时重撒（避免尺寸改变导致物件跑出边界）
window.addEventListener('resize', () => {
  // 轻量：只重撒场景，不清空背包（更符合直觉）
  if (!playgroundEl) return;
  spawnItems();
});

// 键盘快捷键：Ctrl + Enter 生成
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) generateBlessing();
});
