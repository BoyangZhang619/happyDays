// API代理URL
const PROXY_URL = "https://happy-days-rho.vercel.app/api/qwen_proxy";

// 选中的装饰品状态 - 使用计数器跟踪点击次数
const selectedDecorations = {};
let clickCounters = {}; // 用于跟踪每个装饰品被点击的次数
let selectedLanguage = 'zh'; // 默认选择中文

// 语言配置
const languageConfig = {
    zh: {
        name: '中文',
        prompt: '用中文回复，语调要亲切温馨'
    },
    en: {
        name: 'English', 
        prompt: 'Please reply in English with a warm and friendly tone'
    },
    fr: {
        name: 'Français',
        prompt: 'Veuillez répondre en français avec un ton chaleureux et amical'
    },
    ja: {
        name: '日本語',
        prompt: '日本語で温かく親しみやすい口調で回答してください'
    }
};

// 装饰品名称映射
const decorationNames = {
    tree: '圣诞树',
    gift: '礼品盒',
    candy: '拐杖糖',
    sock: '圣诞袜',
    hat: '圣诞帽',
    bell: '铃铛',
    star: '星星',
    snowman: '雪人',
    angel: '天使',
    candle: '蜡烛',
    wreath: '花环',
    cookie: '姜饼',
    reindeer: '驯鹿',
    sledge: '雪橇',
    mittens: '手套',
    scarf: '围巾'
};

// 选择语言
function selectLanguage(element) {
    // 移除所有语言项的选中状态
    document.querySelectorAll('.language-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // 添加当前选中的语言项
    element.classList.add('selected');
    selectedLanguage = element.dataset.language;
}

// 根据点击次数计算数量的规则：第n次对应的数量是1,0,2,0,3,0...
function getQuantityByClickCount(clickCount) {
    if (clickCount % 2 === 1) {
        // 奇数次点击：1, 2, 3, 4...
        return Math.ceil(clickCount / 2);
    } else {
        // 偶数次点击：0
        return 0;
    }
}

// 切换装饰品选择状态
function toggleDecoration(element) {
    const type = element.dataset.type;
    const countElement = element.querySelector('.count');
    
    // 初始化点击计数器
    if (!clickCounters[type]) {
        clickCounters[type] = 0;
    }
    
    // 增加点击次数
    clickCounters[type]++;
    
    // 根据点击次数计算数量
    const quantity = getQuantityByClickCount(clickCounters[type]);
    
    if (quantity === 0) {
        // 数量为0，取消选择
        if (selectedDecorations[type]) {
            delete selectedDecorations[type];
        }
        element.classList.remove('selected');
        countElement.textContent = '已选: 0';
    } else {
        // 数量大于0，设置选择
        selectedDecorations[type] = quantity;
        element.classList.add('selected');
        countElement.textContent = `已选: ${quantity}`;
    }
}

// 生成圣诞祝福语
async function generateBlessing() {
    const outputDiv = document.getElementById("modelOutput");
    const generateButton = document.getElementById("generateButton");
    
    // 检查是否选择了装饰品
    const selectedItems = Object.keys(selectedDecorations);
    if (selectedItems.length === 0) {
        outputDiv.innerHTML = "🎁 请至少选择一个圣诞装饰品，然后再生成祝福语哦！ 🎄";
        return;
    }

    // 如果选择的装饰品太少，随机添加一些
    if (selectedItems.length < 3) {
        const allTypes = ['tree', 'gift', 'candy', 'sock', 'hat', 'bell', 'star', 'snowman', 'angel', 'candle', 'wreath', 'cookie', 'reindeer', 'sledge', 'mittens', 'scarf'];
        const unselected = allTypes.filter(type => !selectedDecorations[type]);
        
        // 随机选择2-3个未选择的装饰品
        const additionalCount = Math.min(3 - selectedItems.length, unselected.length);
        for (let i = 0; i < additionalCount; i++) {
            const randomIndex = Math.floor(Math.random() * unselected.length);
            const type = unselected.splice(randomIndex, 1)[0];
            selectedDecorations[type] = Math.floor(Math.random() * 3) + 1;
            
            // 更新UI
            const element = document.querySelector(`[data-type="${type}"]`);
            if (element) {
                element.classList.add('selected');
                element.querySelector('.count').textContent = `已选: ${selectedDecorations[type]}`;
            }
        }
    }

    generateButton.disabled = true;
    outputDiv.innerHTML = "🎅 圣诞老人正在为您精心准备专属祝福语... ✨❄️";

    try {
        // 构建装饰品描述
        const decorationsList = Object.keys(selectedDecorations).map(type => 
            `${selectedDecorations[type]}个${decorationNames[type]}`
        ).join('、');

        const prompt = `你是一个充满圣诞节气氛的AI助手。请根据用户选择的圣诞装饰品，生成一段温馨、有创意的圣诞祝福语。

用户选择的装饰品：${decorationsList}
用户选择的语言：${languageConfig[selectedLanguage].name}

请你：
1. 创作一段包含这些装饰品元素的圣诞祝福语
2. 语言要温暖、富有诗意，充满圣诞节的美好氛围
3. 可以融入这些装饰品的象征意义（比如圣诞树代表希望，礼品盒代表惊喜等）
4. 控制在100-200字左右
5. ${languageConfig[selectedLanguage].prompt}

请开始创作这段专属的圣诞祝福语：`;

        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                message: prompt
            }),
        });
        
        const data = await response.json();

        if (response.ok && data.reply) {
            outputDiv.innerHTML = `🎄 ${data.reply} 🎅`;
        } else {
            outputDiv.innerHTML = "🎁 抱歉，圣诞老人暂时忙碌中，请稍后再试... ❄️";
        }

    } catch (error) {
        console.error("生成祝福语时出错:", error);
        outputDiv.innerHTML = "❄️ 网络连接似乎有些问题，圣诞老人的信息传输被雪花阻挡了... 请稍后重试！ 🎄";
    } finally {
        generateButton.disabled = false;
    }
}

// 创建雪花
function createSnowflake() {
    const snowContainer = document.getElementById('snowContainer');
    const snowflake = document.createElement('div');
    snowflake.classList.add('snowflake');
    
    // 随机雪花样式
    const snowflakeChars = ['❄', '❅', '❆', '✻', '✼', '❋', '❊', '⛄', '❉', '❈'];
    snowflake.innerHTML = snowflakeChars[Math.floor(Math.random() * snowflakeChars.length)];
    
    // 随机位置和大小
    snowflake.style.left = Math.random() * 100 + '%';
    snowflake.style.fontSize = (Math.random() * 20 + 10) + 'px';
    snowflake.style.opacity = Math.random() * 0.6 + 0.4;
    
    // 随机动画时间
    const duration = Math.random() * 3000 + 2000;
    snowflake.style.animationDuration = duration + 'ms';
    
    snowContainer.appendChild(snowflake);
    
    // 动画结束后移除元素，防止内存泄漏
    setTimeout(() => {
        if (snowflake.parentNode) {
            snowflake.parentNode.removeChild(snowflake);
        }
    }, duration);
}

// 持续创建雪花
function startSnowing() {
    // 检测是否为移动设备
    const isMobile = window.innerWidth <= 768;
    const snowInterval = isMobile ? Math.random() * 500 + 200 : Math.random() * 300 + 100;
    
    createSnowflake();
    setTimeout(startSnowing, snowInterval);
}

// 页面加载完成后开始下雪
window.addEventListener('DOMContentLoaded', () => {
    startSnowing();
    
    // 移动端优化：减少动画频率
    const isMobile = window.innerWidth <= 768;
    const animationInterval = isMobile ? 8000 : 5000;
    
    // 添加一些节日气氛的随机事件
    setInterval(() => {
        const decorations = document.querySelectorAll('.decoration-item');
        decorations.forEach((decoration, index) => {
            setTimeout(() => {
                decoration.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    decoration.style.transform = 'scale(1)';
                }, 300);
            }, index * 100);
        });
    }, animationInterval);
});

// 添加移动端触摸优化
document.addEventListener('touchstart', function() {}, {passive: true});
document.addEventListener('touchmove', function(e) {
    // 防止页面滚动时的意外操作
    if (e.target.closest('.decoration-item') || e.target.closest('.language-item')) {
        e.preventDefault();
    }
}, {passive: false});

// 添加键盘快捷键支持
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        generateBlessing();
    }
});
//                 let position;
//                 do {
//                     position = {
//                         left: Math.random() * 85, // 留边距
//                         top: Math.random() * 75 + 10 // 留上下边距
//                     };
//                     attempts++;
//                 } while (attempts < 20 && isOverlapping(position, container));
                
//                 element.style.left = position.left + '%';
//                 element.style.top = position.top + '%';
//                 element.style.animationDelay = (index * 0.2) + 's';
                
//                 element.innerHTML = `
//                     <span class="icon">${decoration.icon}</span>
//                     <div class="name">${decoration.name}</div>
//                     <div class="count">0</div>
//                 `;
                
//                 container.appendChild(element);
//             });
//         }

//         // 检查位置是否重叠
//         function isOverlapping(newPos, container) {
//             const existingItems = container.querySelectorAll('.decoration-item');
//             for (let item of existingItems) {
//                 const rect = item.getBoundingClientRect();
//                 const containerRect = container.getBoundingClientRect();
//                 const itemLeft = ((rect.left - containerRect.left) / containerRect.width) * 100;
//                 const itemTop = ((rect.top - containerRect.top) / containerRect.height) * 100;
                
//                 const distance = Math.sqrt(
//                     Math.pow(newPos.left - itemLeft, 2) + 
//                     Math.pow(newPos.top - itemTop, 2)
//                 );
                
//                 if (distance < 15) return true; // 最小距离15%
//             }
//             return false;
//         }

//         // 切换装饰品选择状态
//         function toggleDecoration(element) {
//             const type = element.dataset.type;
//             const countElement = element.querySelector('.count');
            
//             if (!selectedDecorations[type]) {
//                 selectedDecorations[type] = 0;
//             }
            
//             if (element.classList.contains('selected')) {
//                 // 如果已选中，则取消选择
//                 delete selectedDecorations[type];
//                 element.classList.remove('selected');
//                 countElement.textContent = '0';
//             } else {
//                 // 如果未选中，则选择并随机设置数量
//                 selectedDecorations[type] = Math.floor(Math.random() * 5) + 1;
//                 element.classList.add('selected');
//                 countElement.textContent = selectedDecorations[type];
                
//                 // 添加收集音效（视觉效果）
//                 createCollectionEffect(element);
//             }
//         }

//         // 创建收集特效
//         function createCollectionEffect(element) {
//             const sparkles = ['✨', '💫', '⭐', '🌟'];
//             for (let i = 0; i < 5; i++) {
//                 setTimeout(() => {
//                     const sparkle = document.createElement('div');
//                     sparkle.textContent = sparkles[Math.floor(Math.random() * sparkles.length)];
//                     sparkle.style.cssText = `
//                         position: absolute;
//                         left: ${Math.random() * 100}%;
//                         top: ${Math.random() * 100}%;
//                         font-size: 1.2em;
//                         pointer-events: none;
//                         animation: sparkleEffect 1s ease-out forwards;
//                         z-index: 1000;
//                     `;
                    
//                     element.appendChild(sparkle);
                    
//                     setTimeout(() => sparkle.remove(), 1000);
//                 }, i * 100);
//             }
//         }

//         // 添加闪烁效果的CSS
//         function addSparkleEffect() {
//             if (!document.getElementById('sparkleStyle')) {
//                 const style = document.createElement('style');
//                 style.id = 'sparkleStyle';
//                 style.textContent = `
//                     @keyframes sparkleEffect {
//                         0% { 
//                             transform: scale(0) rotate(0deg); 
//                             opacity: 1; 
//                         }
//                         100% { 
//                             transform: scale(1.5) rotate(360deg); 
//                             opacity: 0; 
//                         }
//                     }
//                 `;
//                 document.head.appendChild(style);
//             }
//         }

//         // 生成圣诞祝福语
//         async function generateBlessing() {
//             const outputDiv = document.getElementById("modelOutput");
//             const generateButton = document.getElementById("generateButton");
            
//             // 检查是否选择了装饰品
//             const selectedItems = Object.keys(selectedDecorations);
//             if (selectedItems.length === 0) {
//                 outputDiv.innerHTML = "🎁 请先收集一些圣诞装饰品，然后再生成祝福语哦！点击散落在页面上的装饰品来收集它们吧~ 🎄✨";
//                 return;
//             }

//             generateButton.disabled = true;
//             outputDiv.innerHTML = "🎅 圣诞老人正在根据您收集的装饰品，精心编织专属祝福语... ✨❄️🎄";

//             try {
//                 // 构建装饰品描述
//                 const decorationsList = Object.keys(selectedDecorations).map(type => 
//                     `${selectedDecorations[type]}个${decorationNames[type]}`
//                 ).join('、');

//                 const prompt = `你是一个充满圣诞节魔力的AI精灵。用户在圣诞装饰收集游戏中收集了以下装饰品，请根据这些装饰品创作一段温馨、富有创意的圣诞祝福语。

// 用户收集的圣诞装饰品：${decorationsList}

// 请你：
// 1. 创作一段融入这些装饰品元素的温馨圣诞祝福语
// 2. 语言要富有诗意和童话感，充满圣诞节的奇幻氛围
// 3. 将每个装饰品的美好寓意编织进祝福中（如圣诞树代表希望与成长，礼品盒代表惊喜与关爱等）
// 4. 营造温暖、治愈的感觉，让人感受到圣诞节的美好
// 5. 控制在120-250字左右
// 6. 用中文回复，语调要温馨如童话故事

// 请开始创作这段充满魔力的圣诞祝福语：`;

//                 const response = await fetch(PROXY_URL, {
//                     method: 'POST',
//                     headers: { 
//                         'Content-Type': 'application/json' 
//                     },
//                     body: JSON.stringify({
//                         message: prompt
//                     }),
//                 });
                
//                 const data = await response.json();

//                 if (response.ok && data.reply) {
//                     outputDiv.innerHTML = `✨ ${data.reply} ✨`;
//                 } else {
//                     outputDiv.innerHTML = "🎁 圣诞老人的工坊暂时忙碌中，小精灵们正在加班制作祝福语... 请稍后再试哦！ ❄️🎄";
//                 }

//             } catch (error) {
//                 console.error("生成祝福语时出错:", error);
//                 outputDiv.innerHTML = "❄️ 圣诞雪花似乎阻挡了魔法信号... 请检查网络连接后重试！北极的网络有时会不太稳定呢~ 🎄⛄";
//             } finally {
//                 generateButton.disabled = false;
//             }
//         }

//         // 创建雪花
//         function createSnowflake() {
//             const snowContainer = document.getElementById('snowContainer');
//             const snowflake = document.createElement('div');
//             snowflake.classList.add('snowflake');
            
//             // 随机雪花样式
//             const snowflakeChars = ['❄', '❅', '❆', '✻', '✼', '❋', '❊', '⛄', '❉', '❈'];
//             snowflake.innerHTML = snowflakeChars[Math.floor(Math.random() * snowflakeChars.length)];
            
//             // 随机位置和大小
//             snowflake.style.left = Math.random() * 100 + '%';
//             snowflake.style.fontSize = (Math.random() * 25 + 8) + 'px';
//             snowflake.style.opacity = Math.random() * 0.8 + 0.2;
            
//             // 随机动画时间和飘落方向
//             const duration = Math.random() * 5000 + 3000;
//             const horizontalDrift = (Math.random() - 0.5) * 200; // 左右摇摆
            
//             snowflake.style.animationDuration = duration + 'ms';
//             snowflake.style.setProperty('--drift', horizontalDrift + 'px');
            
//             // 添加随机旋转
//             const rotation = Math.random() * 360;
//             snowflake.style.transform = `rotate(${rotation}deg)`;
            
//             snowContainer.appendChild(snowflake);
            
//             // 动画结束后移除元素，防止内存泄漏
//             setTimeout(() => {
//                 if (snowflake.parentNode) {
//                     snowflake.parentNode.removeChild(snowflake);
//                 }
//             }, duration);
//         }

//         // 开始下雪
//         function startSnowing() {
//             // 创建初始雪花
//             for (let i = 0; i < 10; i++) {
//                 setTimeout(createSnowflake, i * 200);
//             }
            
//             // 持续创建新雪花
//             setInterval(() => {
//                 createSnowflake();
                
//                 // 随机创建额外雪花（营造雪花密度变化）
//                 if (Math.random() < 0.3) {
//                     setTimeout(createSnowflake, Math.random() * 1000);
//                 }
//             }, 800);
//         }

//         // 生成散落在页面上的装饰品
//         function generateScatteredDecorations() {
//             const body = document.body;
//             const existingScattered = document.querySelectorAll('.scattered-decoration');
//             existingScattered.forEach(item => item.remove());
            
//             // 在页面上随机散落15-25个装饰品
//             const decorationCount = Math.floor(Math.random() * 11) + 15;
            
//             for (let i = 0; i < decorationCount; i++) {
//                 const decoration = decorations[Math.floor(Math.random() * decorations.length)];
//                 const element = document.createElement('div');
//                 element.className = 'scattered-decoration';
//                 element.dataset.type = decoration.type;
//                 element.onclick = () => collectScatteredDecoration(element);
                
//                 // 随机位置（避开主内容区域）
//                 const x = Math.random() * (window.innerWidth - 60);
//                 const y = Math.random() * (window.innerHeight - 60);
                
//                 element.style.cssText = `
//                     position: fixed;
//                     left: ${x}px;
//                     top: ${y}px;
//                     width: 50px;
//                     height: 50px;
//                     background: radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.6) 100%);
//                     border: 2px solid rgba(255, 215, 0, 0.5);
//                     border-radius: 50%;
//                     display: flex;
//                     align-items: center;
//                     justify-content: center;
//                     font-size: 1.8em;
//                     cursor: pointer;
//                     z-index: 5;
//                     transition: all 0.3s ease;
//                     backdrop-filter: blur(5px);
//                     box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
//                     animation: scatteredFloat ${3 + Math.random() * 2}s ease-in-out infinite;
//                     animation-delay: ${Math.random() * 2}s;
//                 `;
                
//                 element.innerHTML = decoration.icon;
                
//                 // 避免覆盖主要内容
//                 const container = document.querySelector('.container');
//                 if (container) {
//                     const containerRect = container.getBoundingClientRect();
//                     if (x > containerRect.left - 60 && x < containerRect.right + 60 &&
//                         y > containerRect.top - 60 && y < containerRect.bottom + 60) {
//                         continue; // 跳过这个位置
//                     }
//                 }
                
//                 body.appendChild(element);
//             }
//         }

//         // 收集散落的装饰品
//         function collectScatteredDecoration(element) {
//             const type = element.dataset.type;
            
//             if (!selectedDecorations[type]) {
//                 selectedDecorations[type] = 0;
//             }
//             selectedDecorations[type]++;
            
//             // 创建收集特效
//             createFloatingEffect(element);
            
//             // 移除元素
//             setTimeout(() => {
//                 element.remove();
//             }, 500);
            
//             // 更新主容器中对应装饰品的显示
//             updateMainDecorationDisplay();
//         }

//         // 创建漂浮收集特效
//         function createFloatingEffect(element) {
//             const rect = element.getBoundingClientRect();
            
//             // 创建+1效果
//             const floatingText = document.createElement('div');
//             floatingText.innerHTML = '+1 ✨';
//             floatingText.style.cssText = `
//                 position: fixed;
//                 left: ${rect.left + rect.width / 2}px;
//                 top: ${rect.top}px;
//                 color: #FFD700;
//                 font-weight: bold;
//                 font-size: 1.2em;
//                 pointer-events: none;
//                 z-index: 9999;
//                 text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
//                 animation: floatUp 1s ease-out forwards;
//             `;
            
//             document.body.appendChild(floatingText);
            
//             // 元素收集动画
//             element.style.transform = 'scale(1.5) rotate(360deg)';
//             element.style.opacity = '0';
            
//             setTimeout(() => {
//                 floatingText.remove();
//             }, 1000);
//         }

//         // 更新主容器装饰品显示
//         function updateMainDecorationDisplay() {
//             const container = document.getElementById('decorationsContainer');
//             const items = container.querySelectorAll('.decoration-item');
            
//             items.forEach(item => {
//                 const type = item.dataset.type;
//                 if (selectedDecorations[type]) {
//                     item.classList.add('selected');
//                     const countElement = item.querySelector('.count');
//                     if (countElement) {
//                         countElement.textContent = selectedDecorations[type];
//                     }
//                 } else {
//                     item.classList.remove('selected');
//                     const countElement = item.querySelector('.count');
//                     if (countElement) {
//                         countElement.textContent = '0';
//                     }
//                 }
//             });
//         }

//         // 页面加载完成后初始化
//         window.addEventListener('DOMContentLoaded', () => {
//             addSparkleEffect();
//             generateRandomDecorations();
//             generateScatteredDecorations();
//             startSnowing();
            
//             // 添加装饰品入场动画
//             setTimeout(() => {
//                 const decorations = document.querySelectorAll('.decoration-item');
//                 decorations.forEach((decoration, index) => {
//                     setTimeout(() => {
//                         decoration.style.transform = 'scale(1.2)';
//                         setTimeout(() => {
//                             decoration.style.transform = 'scale(1)';
//                         }, 300);
//                     }, index * 150);
//                 });
//             }, 500);
            
//             // 定期重新排列装饰品位置和散落装饰品
//             setInterval(() => {
//                 generateScatteredDecorations();
//             }, 45000); // 45秒重新散落一次
            
//             setInterval(() => {
//                 if (Object.keys(selectedDecorations).length === 0) {
//                     generateRandomDecorations();
//                 }
//             }, 30000); // 30秒重新排列一次主容器装饰品
//         });

//         // 添加键盘快捷键支持
//         document.addEventListener('keydown', (e) => {
//             if (e.key === 'Enter' && e.ctrlKey) {
//                 generateBlessing();
//             }
//             if (e.key === 'r' && e.ctrlKey) {
//                 e.preventDefault();
//                 generateRandomDecorations();
//                 generateScatteredDecorations();
//                 // 清空选择
//                 Object.keys(selectedDecorations).forEach(key => delete selectedDecorations[key]);
//                 updateMainDecorationDisplay();
//             }
//         });