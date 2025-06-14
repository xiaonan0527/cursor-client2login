// 账户切换调试脚本
// 在浏览器控制台中运行此脚本来调试账户切换问题

console.log('🔍 开始账户切换调试...');

// 调试函数：检查当前Cookie状态
async function debugCookieStatus() {
    console.log('📊 === Cookie状态调试 ===');
    
    try {
        // 获取所有cursor相关的Cookie
        const allCookies = await chrome.cookies.getAll({});
        const cursorCookies = allCookies.filter(cookie => 
            cookie.domain.includes('cursor') || 
            cookie.name.toLowerCase().includes('session') ||
            cookie.name.toLowerCase().includes('token')
        );
        
        console.log('🍪 找到的Cursor相关Cookie:', cursorCookies.length);
        cursorCookies.forEach(cookie => {
            console.log(`  - ${cookie.name}: ${cookie.domain}${cookie.path} (${cookie.value ? cookie.value.length : 0}字符)`);
        });
        
        // 专门查找WorkosCursorSessionToken
        const sessionCookies = await chrome.cookies.getAll({
            name: 'WorkosCursorSessionToken'
        });
        
        console.log('🎯 WorkosCursorSessionToken Cookie:', sessionCookies.length);
        sessionCookies.forEach(cookie => {
            console.log(`  详情:`, {
                domain: cookie.domain,
                path: cookie.path,
                value: cookie.value ? cookie.value.substring(0, 50) + '...' : 'null',
                valueLength: cookie.value ? cookie.value.length : 0,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                expirationDate: cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toISOString() : 'session'
            });
            
            // 解析Cookie值
            if (cookie.value && cookie.value.includes('%3A%3A')) {
                const parts = cookie.value.split('%3A%3A');
                console.log(`  解析结果:`, {
                    userid: parts[0],
                    accessTokenLength: parts[1] ? parts[1].length : 0
                });
            }
        });
        
    } catch (error) {
        console.error('❌ Cookie调试失败:', error);
    }
}

// 调试函数：检查Storage状态
async function debugStorageStatus() {
    console.log('📊 === Storage状态调试 ===');
    
    try {
        const result = await chrome.storage.local.get(['currentAccount', 'accountList']);
        
        console.log('💾 当前账户 (currentAccount):', result.currentAccount);
        console.log('📋 账户列表 (accountList):', result.accountList ? result.accountList.length : 0, '个账户');
        
        if (result.accountList) {
            result.accountList.forEach((account, index) => {
                console.log(`  ${index}: ${account.email} (${account.userid})`);
            });
        }
        
    } catch (error) {
        console.error('❌ Storage调试失败:', error);
    }
}

// 调试函数：验证账户状态一致性
async function debugAccountConsistency() {
    console.log('📊 === 账户一致性调试 ===');
    
    try {
        // 发送验证请求
        const result = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'validateCurrentAccountStatus' }, resolve);
        });
        
        console.log('🔍 验证结果:', result);
        
        if (result.success) {
            const status = result.status;
            console.log(`  一致性: ${status.isConsistent ? '✅ 一致' : '❌ 不一致'}`);
            console.log(`  建议: ${status.recommendation}`);
            
            if (status.storageAccount) {
                console.log(`  Storage账户: ${status.storageAccount.email} (${status.storageAccount.userid})`);
            }
            
            if (status.cookieStatus && status.cookieStatus.cookieData) {
                console.log(`  Cookie账户: ${status.cookieStatus.cookieData.userid}`);
                console.log(`  Cookie过期: ${status.cookieStatus.cookieData.isExpired ? '是' : '否'}`);
            }
        }
        
    } catch (error) {
        console.error('❌ 一致性验证失败:', error);
    }
}

// 调试函数：模拟账户切换
async function debugAccountSwitch(targetEmail) {
    console.log('📊 === 账户切换调试 ===');
    console.log('🎯 目标账户:', targetEmail);
    
    try {
        // 获取账户列表
        const storageResult = await chrome.storage.local.get(['accountList']);
        const accountList = storageResult.accountList || [];
        
        // 查找目标账户
        const targetAccount = accountList.find(account => account.email === targetEmail);
        if (!targetAccount) {
            console.error('❌ 未找到目标账户:', targetEmail);
            return;
        }
        
        console.log('✅ 找到目标账户:', {
            email: targetAccount.email,
            userid: targetAccount.userid,
            accessTokenLength: targetAccount.accessToken ? targetAccount.accessToken.length : 0
        });
        
        // 切换前状态
        console.log('📸 切换前状态:');
        await debugCookieStatus();
        await debugStorageStatus();
        
        // 执行切换
        console.log('🔄 开始切换...');
        const switchResult = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
                action: 'setCookie',
                data: {
                    userid: targetAccount.userid,
                    accessToken: targetAccount.accessToken
                }
            }, resolve);
        });
        
        console.log('🍪 Cookie设置结果:', switchResult);
        
        if (switchResult.success) {
            // 更新Storage
            await chrome.storage.local.set({ currentAccount: targetAccount });
            console.log('💾 Storage已更新');
            
            // 等待一下
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 切换后状态
            console.log('📸 切换后状态:');
            await debugCookieStatus();
            await debugAccountConsistency();
        }
        
    } catch (error) {
        console.error('❌ 账户切换调试失败:', error);
    }
}

// 主调试函数
async function runFullDebug() {
    console.log('🚀 === 完整调试开始 ===');
    
    await debugStorageStatus();
    await debugCookieStatus();
    await debugAccountConsistency();
    
    console.log('✅ === 完整调试结束 ===');
}

// 导出调试函数到全局
window.debugAccountSwitch = {
    cookie: debugCookieStatus,
    storage: debugStorageStatus,
    consistency: debugAccountConsistency,
    switchTo: debugAccountSwitch,
    full: runFullDebug
};

console.log('🛠️ 调试工具已加载！使用方法:');
console.log('  debugAccountSwitch.full() - 运行完整调试');
console.log('  debugAccountSwitch.cookie() - 检查Cookie状态');
console.log('  debugAccountSwitch.storage() - 检查Storage状态');
console.log('  debugAccountSwitch.consistency() - 检查一致性');
console.log('  debugAccountSwitch.switchTo("email@example.com") - 调试切换到指定账户');

// 自动运行一次完整调试
runFullDebug();
