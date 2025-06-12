// 调试信息
console.log('🔍 插件调试信息:');
console.log('扩展ID:', chrome.runtime.id);
console.log('Chrome版本:', navigator.userAgent);

// DOM元素引用 - 将在DOMContentLoaded后初始化
let messageArea, emailInput, useridInput, accessTokenInput, accessTokenFile;
let importDataBtn, autoReadBtn, processFilesBtn, accountList, refreshAccountsBtn;
let openDashboardBtn, clearDataBtn, jsonDropZone, jsonFileInput, nativeHostInfo, showInstallGuide, currentStatus;

// 文件数据存储
let uploadedJsonData = null;

// 测试原生消息传递函数
function testNativeMessaging() {
  const NATIVE_HOST_NAME = 'com.cursor.get.account';
  
  console.log('🧪 测试原生消息传递...');
  console.log('扩展ID:', chrome.runtime.id);
  console.log('原生主机名称:', NATIVE_HOST_NAME);
  
  chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, { action: 'getAllData' }, (response) => {
    const lastError = chrome.runtime.lastError;
    
    if (lastError) {
      console.error('❌ 原生消息错误:', lastError.message || '未知错误');
      console.error('错误对象:', lastError);
      console.error('原生主机名:', NATIVE_HOST_NAME);
      console.error('扩展ID:', chrome.runtime.id);
      
      // 显示详细错误信息到页面
      const errorInfo = `
🔍 原生消息连接诊断:
• 错误: ${lastError.message || '未知错误'}
• 原生主机: ${NATIVE_HOST_NAME}
• 扩展ID: ${chrome.runtime.id}
• 配置模式: 通配符 (chrome-extension://*)

📋 可能的解决方案:
1. 确保已安装原生主机: python3 install-native-host.py
2. 重启Chrome浏览器
3. 尝试具体扩展ID: python3 update-native-host.py ${chrome.runtime.id}
      `;
      
      showMessage(errorInfo, 'error');
    } else {
      console.log('✅ 原生消息成功:', response);
      showMessage('✅ 原生消息传递测试成功！', 'success');
    }
  });
}

// 暴露到全局作用域用于调试
window.testNativeMessaging = testNativeMessaging;
window.getExtensionId = () => chrome.runtime.id;

// 初始化DOM元素引用
function initializeDOMElements() {
    messageArea = document.getElementById('messageArea');
    emailInput = document.getElementById('emailInput');
    useridInput = document.getElementById('useridInput');
    accessTokenInput = document.getElementById('accessTokenInput');
    accessTokenFile = document.getElementById('accessTokenFile');
    importDataBtn = document.getElementById('importDataBtn');
    autoReadBtn = document.getElementById('autoReadBtn');
    processFilesBtn = document.getElementById('processFilesBtn');
    accountList = document.getElementById('accountList');
    refreshAccountsBtn = document.getElementById('refreshAccountsBtn');
    openDashboardBtn = document.getElementById('openDashboardBtn');
    clearDataBtn = document.getElementById('clearDataBtn');
    jsonDropZone = document.getElementById('jsonDropZone');
    jsonFileInput = document.getElementById('jsonFileInput');
    nativeHostInfo = document.getElementById('nativeHostInfo');
    showInstallGuide = document.getElementById('showInstallGuide');
    currentStatus = document.getElementById('currentStatus');
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 页面加载完成，开始初始化...');
    
    // 首先初始化DOM元素
    initializeDOMElements();
    
    // 然后执行其他初始化
    await updateCurrentStatus();
    await loadAccountList();
    setupEventListeners();
    setupMethodTabs();
    setupFileUpload();
    
    // 自动测试原生消息传递
    console.log('开始自动测试原生消息传递...');
    setTimeout(testNativeMessaging, 1000);
});

// 设置方法切换标签
function setupMethodTabs() {
    const tabs = document.querySelectorAll('.method-tab');
    const contents = document.querySelectorAll('.method-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const method = tab.dataset.method;
            
            // 切换标签激活状态
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // 切换内容显示
            contents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${method}Method`) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// 设置文件上传功能
function setupFileUpload() {
    // 点击上传
    jsonDropZone.addEventListener('click', () => {
        jsonFileInput.click();
    });
    
    // 文件选择
    jsonFileInput.addEventListener('change', handleFileSelect);
    
    // 拖拽上传
    jsonDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        jsonDropZone.classList.add('dragover');
    });
    
    jsonDropZone.addEventListener('dragleave', () => {
        jsonDropZone.classList.remove('dragover');
    });
    
    jsonDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        jsonDropZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect({ target: { files } });
        }
    });
}

// 处理文件选择
async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        showMessage('请选择JSON文件', 'error');
        return;
    }
    
    try {
        const content = await readFile(file);
        const result = await sendMessage('parseFileContent', { content, fileType: 'json' });
        
        if (result.success) {
            uploadedJsonData = result.data;
            jsonDropZone.innerHTML = `
                <p>✅ 文件已上传: ${file.name}</p>
                <p>Email: ${result.data.email}</p>
                <p>User ID: ${result.data.userid}</p>
            `;
            showMessage('JSON文件解析成功', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showMessage(`文件处理失败: ${error.message}`, 'error');
    }
}

// 读取文件内容
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('文件读取失败'));
        reader.readAsText(file);
    });
}

// 设置事件监听器
function setupEventListeners() {
    console.log('🔧 开始设置事件监听器...');
    
    // 基本按钮事件
    if (importDataBtn) importDataBtn.addEventListener('click', handleImportData);
    if (autoReadBtn) autoReadBtn.addEventListener('click', handleAutoRead);
    if (processFilesBtn) processFilesBtn.addEventListener('click', handleProcessFiles);
    if (refreshAccountsBtn) refreshAccountsBtn.addEventListener('click', loadAccountList);
    if (openDashboardBtn) openDashboardBtn.addEventListener('click', handleOpenDashboard);
    if (clearDataBtn) clearDataBtn.addEventListener('click', handleClearData);
    if (showInstallGuide) showInstallGuide.addEventListener('click', handleShowInstallGuide);
    
    // 为账户列表设置事件代理，处理动态生成的按钮
    if (accountList) {
        accountList.addEventListener('click', handleAccountListClick);
        console.log('✅ 账户列表事件监听器已设置');
    } else {
        console.error('❌ accountList DOM元素未找到，无法设置事件监听器');
    }
    
    console.log('✅ 事件监听器设置完成');
}

// 更新当前账户状态显示
async function updateCurrentStatus() {
    if (!currentStatus) {
        console.error('❌ currentStatus DOM元素未找到');
        return;
    }
    
    try {
        const result = await chrome.storage.local.get(['currentAccount']);
        const account = result.currentAccount;
        
        if (account && account.email && account.userid) {
            // 有当前账户
            currentStatus.className = 'current-status';
            currentStatus.innerHTML = `
                <span class="status-icon">✅</span>
                <div class="status-title">当前账户</div>
                <div class="status-email">${account.email}</div>
                <div class="status-userid">${account.userid}</div>
            `;
        } else {
            // 没有当前账户
            currentStatus.className = 'current-status no-account';
            currentStatus.innerHTML = `
                <span class="status-icon">👤</span>
                <div class="status-title">当前账户</div>
                <div class="status-email">未登录</div>
                <div class="status-userid">请先导入账户</div>
            `;
        }
    } catch (error) {
        console.error('❌ 更新当前状态时发生错误:', error);
        currentStatus.className = 'current-status no-account';
        currentStatus.innerHTML = `
            <span class="status-icon">❌</span>
            <div class="status-title">状态错误</div>
            <div class="status-email">加载失败</div>
            <div class="status-userid">请重试</div>
        `;
    }
}

// 处理账户列表中的点击事件
function handleAccountListClick(event) {
    console.log('🖱️ 账户列表点击事件:', event.target);
    
    const target = event.target;
    if (!target.classList.contains('btn-small')) {
        console.log('❌ 点击的不是按钮，忽略');
        return;
    }
    
    const action = target.getAttribute('data-action');
    const index = target.getAttribute('data-index');
    
    console.log('🎯 按钮操作:', action, '索引:', index);
    
    if (!action || index === null) {
        console.error('❌ 按钮缺少必要的data属性');
        return;
    }
    
    const accountIndex = parseInt(index);
    if (isNaN(accountIndex)) {
        console.error('❌ 无效的账户索引:', index);
        return;
    }
    
    try {
        if (action === 'switch') {
            console.log('🔄 执行切换账户，索引:', accountIndex);
            switchToAccount(accountIndex);
        } else if (action === 'delete') {
            console.log('🗑️ 执行删除账户，索引:', accountIndex);
            deleteAccount(accountIndex);
        } else {
            console.error('❌ 未知的操作类型:', action);
        }
    } catch (error) {
        console.error('❌ 执行按钮点击事件时出错:', error);
        console.error('错误堆栈:', error.stack);
    }
}

// 处理自动读取
async function handleAutoRead() {
    autoReadBtn.disabled = true;
    autoReadBtn.textContent = '🔍 正在读取...';
    
    try {
        const result = await sendMessage('autoReadCursorData');
        
        if (result.success) {
            showMessage('自动读取成功！', 'success');
            
            // 自动导入数据
            const accountData = {
                email: result.data.email,
                userid: result.data.userid,
                accessToken: result.data.accessToken,
                WorkosCursorSessionToken: `${result.data.userid}%3A%3A${result.data.accessToken}`,
                createTime: new Date().toISOString()
            };
            
            await processAccountData(accountData);
        } else {
            if (result.needFileSelection) {
                // 构建详细的错误信息
                let errorMsg = result.error || '自动读取失败';
                
                // 如果有故障排除建议，显示它们
                if (result.troubleshooting && result.troubleshooting.length > 0) {
                    errorMsg += '\n\n📋 故障排除建议：\n' + 
                               result.troubleshooting.map(item => `• ${item}`).join('\n');
                } else if (result.details) {
                    errorMsg += `\n\n🔍 详细信息: ${result.details}`;
                }
                
                showMessage(errorMsg, 'error');
                nativeHostInfo.classList.remove('hidden');
            } else {
                throw new Error(result.error);
            }
        }
    } catch (error) {
        showMessage(`自动读取失败: ${error.message}`, 'error');
        nativeHostInfo.classList.remove('hidden');
    } finally {
        autoReadBtn.disabled = false;
        autoReadBtn.textContent = '🔍 自动读取Cursor数据';
    }
}

// 处理文件数据
async function handleProcessFiles() {
    if (!uploadedJsonData) {
        showMessage('请先上传scope_v3.json文件', 'error');
        return;
    }
    
    const accessToken = accessTokenFile.value.trim();
    if (!accessToken) {
        showMessage('请输入Access Token', 'error');
        return;
    }
    
    processFilesBtn.disabled = true;
    processFilesBtn.textContent = '📋 处理中...';
    
    try {
        const accountData = {
            email: uploadedJsonData.email,
            userid: uploadedJsonData.userid,
            accessToken: accessToken,
            WorkosCursorSessionToken: `${uploadedJsonData.userid}%3A%3A${accessToken}`,
            createTime: new Date().toISOString()
        };
        
        await processAccountData(accountData);
        
        // 清空文件输入
        accessTokenFile.value = '';
        uploadedJsonData = null;
        jsonDropZone.innerHTML = `
            <p>📄 拖拽 scope_v3.json 文件到这里<br>或点击选择文件</p>
        `;
        
    } catch (error) {
        showMessage(`处理失败: ${error.message}`, 'error');
    } finally {
        processFilesBtn.disabled = false;
        processFilesBtn.textContent = '📋 处理文件数据';
    }
}

// 处理账户数据（通用方法）
async function processAccountData(accountData) {
    // 保存到localStorage
    const saveResult = await sendMessage('saveToLocalStorage', accountData);
    if (!saveResult.success) {
        throw new Error(saveResult.error);
    }
    
    // 设置Cookie
    const cookieResult = await sendMessage('setCookie', { 
        userid: accountData.userid, 
        accessToken: accountData.accessToken 
    });
    if (!cookieResult.success) {
        throw new Error(cookieResult.error);
    }
    
    showMessage('认证数据导入成功！', 'success');
    
    // 刷新账户列表和状态
    await updateCurrentStatus();
    await loadAccountList();
    
    // 自动打开Dashboard
    setTimeout(async () => {
        await handleOpenDashboard();
    }, 1000);
}

// 显示消息
function showMessage(message, type = 'info') {
    console.log(`📝 显示消息 [${type}]:`, message);
    
    // 检查messageArea是否存在
    if (!messageArea) {
        console.error('❌ messageArea DOM元素未找到，尝试重新获取...');
        const tempMessageArea = document.getElementById('messageArea');
        if (tempMessageArea) {
            // 如果找到了，更新全局变量
            messageArea = tempMessageArea;
            console.log('✅ messageArea已重新获取');
        } else {
            console.error('❌ 无法找到messageArea元素，消息将只在控制台显示');
            return;
        }
    }
    
    try {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.whiteSpace = 'pre-line'; // 支持换行显示
        
        messageArea.innerHTML = '';
        messageArea.appendChild(messageDiv);
        
        // 根据消息类型调整自动清除时间
        const clearTime = type === 'error' ? 8000 : 3000; // 错误消息显示更长时间
        setTimeout(() => {
            if (messageDiv && messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, clearTime);
        
        console.log('✅ 消息已显示到页面');
    } catch (error) {
        console.error('❌ 显示消息时发生错误:', error);
        console.error('错误堆栈:', error.stack);
    }
}

// 处理手动导入数据
async function handleImportData() {
    const email = emailInput.value.trim();
    const userid = useridInput.value.trim();
    const accessToken = accessTokenInput.value.trim();
    
    if (!email || !userid || !accessToken) {
        showMessage('请填写所有必需字段', 'error');
        return;
    }
    
    // 验证email格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('请输入有效的email地址', 'error');
        return;
    }
    
    importDataBtn.disabled = true;
    importDataBtn.textContent = '处理中...';
    
    try {
        const accountData = {
            email: email,
            userid: userid,
            accessToken: accessToken,
            WorkosCursorSessionToken: `${userid}%3A%3A${accessToken}`,
            createTime: new Date().toISOString()
        };
        
        await processAccountData(accountData);
        
        // 清空输入框
        emailInput.value = '';
        useridInput.value = '';
        accessTokenInput.value = '';
        
    } catch (error) {
        showMessage(`导入失败: ${error.message}`, 'error');
    } finally {
        importDataBtn.disabled = false;
        importDataBtn.textContent = '💾 导入并设置认证';
    }
}

// 加载账户列表
async function loadAccountList() {
    console.log('📋 开始加载账户列表...');
    
    try {
        const result = await chrome.storage.local.get(['accountList']);
        const accounts = result.accountList || [];
        
        console.log('📋 获取到账户列表:', accounts);
        console.log('账户数量:', accounts.length);
        
        await displayAccountList(accounts);
        console.log('✅ 账户列表显示完成');
    } catch (error) {
        console.error('❌ 加载账户列表失败:', error);
        console.error('错误堆栈:', error.stack);
        
        if (accountList) {
            accountList.innerHTML = '<div class="loading">加载失败</div>';
        } else {
            console.error('❌ accountList DOM元素未找到');
        }
    }
}

// 显示账户列表
async function displayAccountList(accounts) {
    console.log('🎨 开始显示账户列表，账户数量:', accounts.length);
    
    if (!accountList) {
        console.error('❌ accountList DOM元素未找到');
        return;
    }
    
    try {
        if (accounts.length === 0) {
            accountList.innerHTML = '<div class="loading">暂无保存的账户</div>';
            console.log('📝 显示空账户列表提示');
            return;
        }
        
        // 获取当前激活的账户
        const result = await chrome.storage.local.get(['currentAccount']);
        const currentAccount = result.currentAccount;
        
        const accountsHtml = accounts.map((account, index) => {
            // 确保account对象包含必要的字段
            const email = account.email || '未知邮箱';
            const userid = account.userid || '未知用户ID';
            
            // 检查是否为当前激活账户
            const isCurrentAccount = currentAccount && 
                                   currentAccount.email === account.email && 
                                   currentAccount.userid === account.userid;
            
            console.log(`🏷️ 生成账户项 ${index}:`, email, isCurrentAccount ? '(当前账户)' : '');
            
            // 根据是否为当前账户显示不同的按钮
            let actionButtons = '';
            if (isCurrentAccount) {
                actionButtons = `
                    <span class="current-account-badge">正在使用</span>
                    <button class="btn-small btn-danger" data-action="delete" data-index="${index}">删除</button>
                `;
            } else {
                actionButtons = `
                    <button class="btn-small btn-info" data-action="switch" data-index="${index}">切换</button>
                    <button class="btn-small btn-danger" data-action="delete" data-index="${index}">删除</button>
                `;
            }
            
            return `
                <div class="account-item ${isCurrentAccount ? 'current-account' : ''}">
                    <div class="account-info">
                        <div class="account-email">${email}</div>
                        <div class="account-userid">ID: ${userid}</div>
                    </div>
                    <div class="account-actions">
                        ${actionButtons}
                    </div>
                </div>
            `;
        }).join('');
        
        accountList.innerHTML = accountsHtml;
        console.log('✅ 账户列表HTML已生成并插入DOM');
    } catch (error) {
        console.error('❌ 显示账户列表时发生错误:', error);
        console.error('错误堆栈:', error.stack);
        accountList.innerHTML = '<div class="loading error">显示账户列表失败</div>';
    }
}

// 切换到指定账户
async function switchToAccount(index) {
    try {
        const result = await chrome.storage.local.get(['accountList']);
        const accounts = result.accountList || [];
        
        if (index >= 0 && index < accounts.length) {
            const account = accounts[index];
            
            // 设置Cookie
            const cookieResult = await sendMessage('setCookie', {
                userid: account.userid,
                accessToken: account.accessToken
            });
            
            if (cookieResult.success) {
                showMessage(`已切换到账户: ${account.email}`, 'success');
                
                // 更新当前账户
                await chrome.storage.local.set({ currentAccount: account });
                
                // 刷新账户列表和状态以更新UI
                await updateCurrentStatus();
                await loadAccountList();
                
                // 自动打开Dashboard
                setTimeout(async () => {
                    await handleOpenDashboard();
                }, 1000);
            } else {
                throw new Error(cookieResult.error);
            }
        }
    } catch (error) {
        showMessage(`切换账户失败: ${error.message}`, 'error');
    }
}

// 删除账户
async function deleteAccount(index) {
    console.log('🗑️ 删除账户请求，索引:', index);
    
    if (!confirm('确定要删除这个账户吗？')) {
        console.log('用户取消删除操作');
        return;
    }
    
    try {
        console.log('开始获取账户和当前账户数据...');
        const result = await chrome.storage.local.get(['accountList', 'currentAccount']);
        const accounts = result.accountList || [];
        const currentAccount = result.currentAccount;
        
        console.log('当前账户列表:', accounts);
        console.log('当前激活账户:', currentAccount);
        console.log('要删除的索引:', index, '账户总数:', accounts.length);
        
        if (index >= 0 && index < accounts.length) {
            const deletedAccount = accounts[index];
            console.log('即将删除账户:', deletedAccount);
            
            // 检查是否删除的是当前使用的账户
            const isCurrentAccount = currentAccount && 
                                   currentAccount.email === deletedAccount.email && 
                                   currentAccount.userid === deletedAccount.userid;
            
            console.log('是否为当前账户:', isCurrentAccount);
            
            if (isCurrentAccount) {
                console.log('🧹 删除的是当前账户，开始清理相关数据...');
                
                // 清除当前账户数据
                await chrome.storage.local.remove(['currentAccount']);
                console.log('✅ currentAccount 已清除');
                
                // 清除Cookie
                try {
                    const clearCookieResult = await sendMessage('clearCookie');
                    if (clearCookieResult && clearCookieResult.success) {
                        console.log('✅ Cookie 已清除');
                    } else {
                        console.warn('⚠️ Cookie清除可能失败:', clearCookieResult?.error);
                    }
                } catch (cookieError) {
                    console.error('❌ 清除Cookie时出错:', cookieError);
                }
                
                showMessage(`已删除当前账户: ${deletedAccount.email}\n相关Cookie和数据已清理`, 'success');
            } else {
                showMessage(`已删除账户: ${deletedAccount.email}`, 'success');
            }
            
            // 从列表中移除账户
            accounts.splice(index, 1);
            console.log('删除后的账户列表:', accounts);
            
            await chrome.storage.local.set({ accountList: accounts });
            console.log('✅ 账户已从存储中删除');
            
            await updateCurrentStatus();
            await loadAccountList();
            console.log('✅ 账户列表已刷新');
        } else {
            console.error('❌ 索引超出范围:', index, '有效范围: 0-', accounts.length - 1);
            showMessage('删除失败：索引无效', 'error');
        }
    } catch (error) {
        console.error('❌ 删除账户时发生错误:', error);
        console.error('错误堆栈:', error.stack);
        showMessage(`删除账户失败: ${error.message}`, 'error');
    }
}

// 处理打开Dashboard
async function handleOpenDashboard() {
    try {
        const result = await sendMessage('openDashboard');
        if (result.success) {
            showMessage('Dashboard页面已打开', 'success');
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showMessage(`打开Dashboard失败: ${error.message}`, 'error');
    }
}

// 处理清空数据
async function handleClearData() {
    if (!confirm('确定要清空所有保存的数据吗？此操作不可恢复！')) {
        return;
    }
    
    try {
        await chrome.storage.local.clear();
        showMessage('所有数据已清空', 'success');
        await updateCurrentStatus();
        await loadAccountList();
    } catch (error) {
        showMessage(`清空数据失败: ${error.message}`, 'error');
    }
}

// 处理显示安装指南
function handleShowInstallGuide() {
    showMessage('请参考插件文件夹中的 install-guide.md 文件获取详细安装说明', 'info');
    // 可以考虑打开一个新标签页显示安装指南
    chrome.tabs.create({
        url: chrome.runtime.getURL('install-guide.md')
    });
}

// 发送消息到background script
function sendMessage(action, data = null) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action, data }, resolve);
    });
}

// 将函数暴露到全局作用域，以便HTML中的onclick能够调用
window.switchToAccount = switchToAccount;
window.deleteAccount = deleteAccount;

// 添加测试函数
window.testAccountActions = function() {
    console.log('🧪 测试账户操作功能...');
    console.log('switchToAccount 函数:', typeof switchToAccount);
    console.log('deleteAccount 函数:', typeof deleteAccount);
    console.log('accountList DOM元素:', accountList);
    
    if (accountList) {
        const buttons = accountList.querySelectorAll('.btn-small');
        console.log('找到的按钮数量:', buttons.length);
        buttons.forEach((btn, i) => {
            console.log(`按钮 ${i}:`, btn.textContent, btn.getAttribute('onclick'));
        });
    }
};

