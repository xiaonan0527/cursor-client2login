// Cursor.com 页面内容脚本
// 用于在Cursor网站上提供额外的功能

console.log('Cursor Client2Login - Content Script 已加载');

// 添加CSS动画样式
function addFloatingButtonStyles() {
    if (document.getElementById('cursor-auth-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'cursor-auth-styles';
    style.textContent = `
        @keyframes cursorAuthPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
}

// 创建一个浮动按钮用于快速账户切换
function createFloatingButton() {
    // 检查是否已经存在按钮
    if (document.getElementById('cursor-auth-floating-btn')) {
        return;
    }
    
    // 添加样式
    addFloatingButtonStyles();
    
    const floatingBtn = document.createElement('div');
    floatingBtn.id = 'cursor-auth-floating-btn';
    floatingBtn.innerHTML = '🔄';
    floatingBtn.title = '快速切换Cursor账户';
    
    // 样式设置 - 移动到右下角
    Object.assign(floatingBtn.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '50px',
        height: '50px',
        backgroundColor: '#667eea',
        color: 'white',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        cursor: 'pointer',
        zIndex: '10000',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        transition: 'all 0.3s ease',
        userSelect: 'none',
        animation: 'cursorAuthPulse 2s infinite'
    });
    
    // 悬停效果
    floatingBtn.addEventListener('mouseenter', () => {
        floatingBtn.style.transform = 'scale(1.1) translateY(-2px)';
        floatingBtn.style.backgroundColor = '#764ba2';
        floatingBtn.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
    });
    
    floatingBtn.addEventListener('mouseleave', () => {
        floatingBtn.style.transform = 'scale(1) translateY(0)';
        floatingBtn.style.backgroundColor = '#667eea';
        floatingBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });
    
    // 点击事件
    floatingBtn.addEventListener('click', showAccountSwitcher);
    
    document.body.appendChild(floatingBtn);
}

// 显示账户切换器
async function showAccountSwitcher() {
    // 移除现有的切换器
    const existing = document.getElementById('cursor-account-switcher');
    if (existing) {
        existing.remove();
        return;
    }
    
    // 获取账户列表和当前账户
    const response = await chrome.runtime.sendMessage({ action: 'getAccountList' });
    const currentResponse = await chrome.runtime.sendMessage({ action: 'getCurrentAccount' });
    const accounts = response.accountList || [];
    const currentAccount = currentResponse.currentAccount;
    
    if (accounts.length === 0) {
        alert('暂无保存的账户，请先在插件中添加账户');
        return;
    }
    
    // 创建切换器弹窗
    const switcher = document.createElement('div');
    switcher.id = 'cursor-account-switcher';
    
    Object.assign(switcher.style, {
        position: 'fixed',
        bottom: '80px',
        right: '20px',
        width: '300px',
        maxHeight: '400px',
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        zIndex: '10001',
        padding: '20px',
        overflowY: 'auto'
    });
    
    // 标题
    const title = document.createElement('h3');
    title.textContent = '切换账户';
    title.style.margin = '0 0 15px 0';
    title.style.color = '#333';
    title.style.fontSize = '16px';
    switcher.appendChild(title);
    
    // 账户列表
    accounts.forEach((account, index) => {
        // 检查是否为当前账户
        const isCurrentAccount = currentAccount && 
                                currentAccount.email === account.email && 
                                currentAccount.userid === account.userid;
        
        const accountItem = document.createElement('div');
        
        // 根据是否为当前账户设置不同样式
        const baseStyle = {
            padding: '12px',
            margin: '8px 0',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            position: 'relative',
            overflow: 'hidden'
        };
        
        if (isCurrentAccount) {
            // 当前账户的特殊样式
            Object.assign(baseStyle, {
                background: 'linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%)',
                border: '2px solid #4CAF50',
                cursor: 'default',
                boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)'
            });
        } else {
            // 其他账户的普通样式
            Object.assign(baseStyle, {
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                cursor: 'pointer'
            });
        }
        
        Object.assign(accountItem.style, baseStyle);
        
        // 构建HTML内容
        let badgeHtml = '';
        if (isCurrentAccount) {
            badgeHtml = `
                <div style="
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: linear-gradient(135deg, #4CAF50, #66BB6A);
                    color: white;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 10px;
                    font-weight: bold;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                ">正在使用</div>
            `;
        }
        
        accountItem.innerHTML = `
            ${badgeHtml}
            <div style="font-weight: 600; color: ${isCurrentAccount ? '#2e7d32' : '#333'}; margin-bottom: 4px; margin-right: ${isCurrentAccount ? '60px' : '0'};">${account.email}</div>
            <div style="font-size: 12px; color: ${isCurrentAccount ? '#388e3c' : '#666'}; margin-right: ${isCurrentAccount ? '60px' : '0'};">User ID: ${account.userid}</div>
        `;
        
        // 只为非当前账户添加悬停效果和点击事件
        if (!isCurrentAccount) {
            accountItem.addEventListener('mouseenter', () => {
                accountItem.style.backgroundColor = '#e3f2fd';
                accountItem.style.borderColor = '#2196F3';
            });
            
            accountItem.addEventListener('mouseleave', () => {
                accountItem.style.backgroundColor = '#f8f9fa';
                accountItem.style.borderColor = '#e9ecef';
            });
        } else {
            // 当前账户的特殊悬停效果
            accountItem.addEventListener('mouseenter', () => {
                accountItem.style.boxShadow = '0 4px 12px rgba(76, 175, 80, 0.4)';
            });
            
            accountItem.addEventListener('mouseleave', () => {
                accountItem.style.boxShadow = '0 2px 8px rgba(76, 175, 80, 0.3)';
            });
        }
        
        // 只为非当前账户添加点击切换功能
        if (!isCurrentAccount) {
            accountItem.addEventListener('click', async () => {
                try {
                    const result = await chrome.runtime.sendMessage({
                        action: 'switchAccount',
                        accountData: account
                    });
                    
                    if (result.success) {
                        // 显示成功消息
                        showNotification(`已切换到账户: ${account.email}`, 'success');
                        
                        // 关闭切换器
                        switcher.remove();
                        
                        // 刷新页面
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    } else {
                        showNotification(`切换失败: ${result.error}`, 'error');
                    }
                } catch (error) {
                    showNotification(`切换失败: ${error.message}`, 'error');
                }
            });
        }
        
        switcher.appendChild(accountItem);
    });
    
    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭';
    Object.assign(closeBtn.style, {
        width: '100%',
        padding: '10px',
        marginTop: '15px',
        backgroundColor: '#6c757d',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer'
    });
    
    closeBtn.addEventListener('click', () => {
        switcher.remove();
    });
    
    switcher.appendChild(closeBtn);
    
    // 点击外部关闭
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.1)',
        zIndex: '10000'
    });
    
    overlay.addEventListener('click', () => {
        switcher.remove();
        overlay.remove();
    });
    
    document.body.appendChild(overlay);
    document.body.appendChild(switcher);
}

// 显示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    
    const bgColor = type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3';
    
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: bgColor,
        color: 'white',
        padding: '12px 24px',
        borderRadius: '8px',
        zIndex: '10002',
        fontSize: '14px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease'
    });
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// 页面加载完成后创建浮动按钮
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingButton);
} else {
    createFloatingButton();
}

// 监听页面变化（SPA应用）
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        // 页面变化时重新创建按钮
        setTimeout(createFloatingButton, 1000);
    }
}).observe(document, { subtree: true, childList: true }); 