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
    // 在移动端检查是否为有效点击
    if ('ontouchstart' in window && isTouchMoving) {
        return;
    }
    
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
    // 在移动端检查是否为有效点击
    if ('ontouchstart' in window && isTouchMoving) {
        return;
    }
    
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
    // 在移动端检查是否为有效点击
    if ('ontouchstart' in window && isTouchMoving) {
        return;
    }
    
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

// 智能触摸处理 - 区分点击和滑动
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isTouchMoving = false;

document.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    isTouchMoving = false;
}, {passive: true});

document.addEventListener('touchmove', function(e) {
    if (!touchStartTime) return;
    
    const touchCurrentX = e.touches[0].clientX;
    const touchCurrentY = e.touches[0].clientY;
    const deltaX = Math.abs(touchCurrentX - touchStartX);
    const deltaY = Math.abs(touchCurrentY - touchStartY);
    const moveThreshold = 10; // 移动阈值，超过这个值认为是滑动
    
    // 如果移动距离超过阈值，标记为滑动
    if (deltaX > moveThreshold || deltaY > moveThreshold) {
        isTouchMoving = true;
    }
}, {passive: true});

document.addEventListener('touchend', function(e) {
    const touchEndTime = Date.now();
    const touchDuration = touchEndTime - touchStartTime;
    const maxClickDuration = 300; // 最大点击时长（毫秒）
    
    // 重置触摸状态
    setTimeout(() => {
        isTouchMoving = false;
        touchStartTime = 0;
    }, 50);
}, {passive: true});

// 重写装饰品点击处理
function handleDecorationTouch(element, originalHandler) {
    return function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // 如果是滑动手势，不触发点击
        if (isTouchMoving) {
            return false;
        }
        
        // 检查触摸时长，短时间触摸才认为是点击
        const touchDuration = Date.now() - touchStartTime;
        if (touchDuration > 300) {
            return false;
        }
        
        // 执行原始点击处理
        originalHandler.call(this, e);
        return false;
    };
}

// 页面加载完成后添加触摸事件监听
window.addEventListener('DOMContentLoaded', () => {
    // 为所有可点击元素添加触摸优化
    const clickableElements = document.querySelectorAll('.decoration-item, .language-item, #generateButton');
    
    clickableElements.forEach(element => {
        // 添加触摸反馈
        element.addEventListener('touchstart', function() {
            this.style.opacity = '0.8';
        }, {passive: true});
        
        element.addEventListener('touchend', function() {
            setTimeout(() => {
                this.style.opacity = '';
            }, 150);
        }, {passive: true});
        
        // 添加触摸取消事件
        element.addEventListener('touchcancel', function() {
            this.style.opacity = '';
        }, {passive: true});
    });
    
    // 为容器添加滑动区域指示
    const container = document.querySelector('.container');
    if (container && 'ontouchstart' in window) {
        // 在空白区域添加滑动提示（仅在移动端）
        const scrollHint = document.createElement('div');
        scrollHint.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 12px;
            z-index: 1000;
            opacity: 0.8;
            pointer-events: none;
            backdrop-filter: blur(10px);
        `;
        scrollHint.textContent = '💡 在装饰品上滑动即可滚动页面';
        document.body.appendChild(scrollHint);
        
        // 3秒后隐藏提示
        setTimeout(() => {
            scrollHint.style.transition = 'opacity 1s';
            scrollHint.style.opacity = '0';
            setTimeout(() => {
                scrollHint.remove();
            }, 1000);
        }, 3000);
    }
});

// 添加键盘快捷键支持
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        generateBlessing();
    }
});