// =============================================================================
// Cursor Client2Login - 模块化重构版本
// =============================================================================

// 调试信息
console.log('🔍 插件调试信息:');
console.log('扩展ID:', chrome.runtime.id);
console.log('Chrome版本:', navigator.userAgent);

// =============================================================================
// 错误处理模块
// =============================================================================
class ErrorHandler {
    static createError(message, type = 'error', details = null) {
        return {
            message,
            type,
            details,
            timestamp: new Date().toISOString()
        };
    }

    static handleError(error, context = '') {
        console.error(`❌ [${context}] 错误:`, error);

        let errorMessage = error.message || '未知错误';
        let errorType = 'error';

        // 根据错误类型提供更好的用户提示
        if (error.message?.includes('原生主机')) {
            errorType = 'warning';
            errorMessage += '\n\n💡 建议：\n1. 确保已安装原生主机程序\n2. 重启Chrome浏览器\n3. 检查安装步骤是否正确';
        } else if (error.message?.includes('Cookie')) {
            errorType = 'warning';
            errorMessage += '\n\n💡 建议：\n1. 检查cursor.com的访问权限\n2. 尝试手动访问cursor.com\n3. 清除浏览器缓存后重试';
        } else if (error.message?.includes('文件')) {
            errorType = 'warning';
            errorMessage += '\n\n💡 建议：\n1. 确保文件格式正确\n2. 检查文件是否损坏\n3. 尝试重新导出文件';
        }

        return this.createError(errorMessage, errorType, error);
    }

    static async handleAsyncError(asyncFn, context = '') {
        try {
            return await asyncFn();
        } catch (error) {
            const handledError = this.handleError(error, context);
            UIManager.showMessage(handledError.message, handledError.type);
            throw handledError;
        }
    }
}

// =============================================================================
// 加载状态管理模块
// =============================================================================
class LoadingManager {
    static activeLoaders = new Set();

    static show(elementId, loadingText = '加载中...') {
        const element = document.getElementById(elementId);
        if (!element) return;

        // 保存原始状态
        if (!element.dataset.originalText) {
            element.dataset.originalText = element.textContent;
            element.dataset.originalDisabled = element.disabled;
        }

        element.textContent = loadingText;
        element.disabled = true;
        element.classList.add('loading');
        this.activeLoaders.add(elementId);

        // 添加加载动画类
        if (!document.getElementById('loading-styles')) {
            this.addLoadingStyles();
        }
    }

    static hide(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;

        // 恢复原始状态
        if (element.dataset.originalText) {
            element.textContent = element.dataset.originalText;
            element.disabled = element.dataset.originalDisabled === 'true';
            delete element.dataset.originalText;
            delete element.dataset.originalDisabled;
        }

        element.classList.remove('loading');
        this.activeLoaders.delete(elementId);
    }

    static addLoadingStyles() {
        const style = document.createElement('style');
        style.id = 'loading-styles';
        style.textContent = `
            .loading {
                position: relative;
                pointer-events: none;
            }

            .loading::after {
                content: '';
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                width: 16px;
                height: 16px;
                border: 2px solid transparent;
                border-top: 2px solid currentColor;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                0% { transform: translateY(-50%) rotate(0deg); }
                100% { transform: translateY(-50%) rotate(360deg); }
            }

            .message.loading {
                background: linear-gradient(90deg, rgba(33, 150, 243, 0.3) 0%, rgba(33, 150, 243, 0.1) 50%, rgba(33, 150, 243, 0.3) 100%);
                background-size: 200% 100%;
                animation: shimmer 1.5s infinite;
            }

            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
        `;
        document.head.appendChild(style);
    }

    static hideAll() {
        this.activeLoaders.forEach(elementId => this.hide(elementId));
    }
}

// =============================================================================
// DOM管理模块
// =============================================================================
class DOMManager {
    static elements = {};

    static initialize() {
        this.elements = {
            messageArea: document.getElementById('messageArea'),
            emailInput: document.getElementById('emailInput'),
            useridInput: document.getElementById('useridInput'),
            accessTokenInput: document.getElementById('accessTokenInput'),
            accessTokenFile: document.getElementById('accessTokenFile'),
            importDataBtn: document.getElementById('importDataBtn'),
            autoReadBtn: document.getElementById('autoReadBtn'),
            processFilesBtn: document.getElementById('processFilesBtn'),
            accountList: document.getElementById('accountList'),
            refreshAccountsBtn: document.getElementById('refreshAccountsBtn'),
            openDashboardBtn: document.getElementById('openDashboardBtn'),
            clearDataBtn: document.getElementById('clearDataBtn'),
            jsonDropZone: document.getElementById('jsonDropZone'),
            jsonFileInput: document.getElementById('jsonFileInput'),
            nativeHostInfo: document.getElementById('nativeHostInfo'),
            showInstallGuide: document.getElementById('showInstallGuide'),
            currentStatus: document.getElementById('currentStatus')
        };

        // 验证关键元素是否存在
        const missingElements = Object.entries(this.elements)
            .filter(([, element]) => !element)
            .map(([key]) => key);

        if (missingElements.length > 0) {
            console.warn('⚠️ 以下DOM元素未找到:', missingElements);
            // 在测试环境中，这是正常的，不需要报错
        }

        return this.elements;
    }

    static get(elementId) {
        return this.elements[elementId] || document.getElementById(elementId);
    }

    static getAll() {
        return this.elements;
    }
}

// =============================================================================
// 应用状态管理
// =============================================================================
class AppState {
    static state = {
        uploadedJsonData: null,
        currentAccount: null,
        accountList: [],
        isInitialized: false
    };

    static setState(updates) {
        this.state = { ...this.state, ...updates };
        console.log('📊 状态更新:', updates);
    }

    static getState(key = null) {
        return key ? this.state[key] : this.state;
    }

    static clearUploadedData() {
        this.setState({ uploadedJsonData: null });
    }
}

// =============================================================================
// UI管理模块
// =============================================================================
class UIManager {
    static showMessage(message, type = 'info', duration = null) {
        console.log(`📝 显示消息 [${type}]:`, message);

        const messageArea = DOMManager.get('messageArea');
        if (!messageArea) {
            console.error('❌ messageArea DOM元素未找到');
            return;
        }

        try {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${type}`;
            messageDiv.textContent = message;
            messageDiv.style.whiteSpace = 'pre-line';

            // 添加加载状态样式
            if (type === 'loading') {
                messageDiv.classList.add('loading');
            }

            messageArea.innerHTML = '';
            messageArea.appendChild(messageDiv);

            // 根据消息类型调整自动清除时间
            const clearTime = duration || (type === 'error' ? 8000 : type === 'loading' ? 0 : 3000);

            if (clearTime > 0) {
                setTimeout(() => {
                    if (messageDiv && messageDiv.parentNode) {
                        messageDiv.remove();
                    }
                }, clearTime);
            }

            console.log('✅ 消息已显示到页面');
        } catch (error) {
            console.error('❌ 显示消息时发生错误:', error);
        }
    }

    static clearMessage() {
        const messageArea = DOMManager.get('messageArea');
        if (messageArea) {
            messageArea.innerHTML = '';
        }
    }

    static updateCurrentStatus(statusData) {
        const currentStatus = DOMManager.get('currentStatus');
        if (!currentStatus) {
            console.warn('⚠️ currentStatus DOM元素未找到，可能在测试环境中');
            return;
        }

        // 安全的解构赋值，提供默认值
        if (!statusData || typeof statusData !== 'object') {
            console.warn('⚠️ statusData无效，使用默认状态');
            statusData = {
                isConsistent: false,
                storageAccount: null,
                cookieStatus: { hasCookie: false },
                recommendation: '状态数据无效'
            };
        }

        const {
            isConsistent = false,
            storageAccount = null,
            cookieStatus = { hasCookie: false },
            recommendation = '未知状态'
        } = statusData;

        if (isConsistent && storageAccount) {
            // 账户状态一致且正常
            currentStatus.className = 'current-status';
            
            // 获取token信息
            const tokenType = storageAccount.tokenType || 'client';
            const validDays = storageAccount.validDays;
            let statusNote = '状态正常';
            
            // 计算剩余时间
            if (storageAccount.expiresTime) {
                const expiresDate = new Date(storageAccount.expiresTime);
                const now = new Date();
                const timeDiff = expiresDate.getTime() - now.getTime();
                const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                
                if (daysLeft > 0) {
                    if (tokenType === 'deep') {
                        const expiresDateStr = expiresDate.toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        });
                        statusNote = `🌟 深度Token (${expiresDateStr}到期，剩余${daysLeft}天)`;
                    } else {
                        statusNote = `客户端Token - 剩余${daysLeft}天`;
                    }
                } else {
                    statusNote = 'Token已过期';
                    currentStatus.className = 'current-status warning';
                }
            } else {
                const typeText = tokenType === 'deep' ? '深度Token' : '客户端Token';
                if (validDays) {
                    statusNote = `${typeText} (${validDays}天有效期)`;
                } else {
                    statusNote = `${typeText} (有效期未知)`;
                }
            }
            
            currentStatus.innerHTML = `
                <span class="status-icon">✅</span>
                <div class="status-title">当前账户</div>
                <div class="status-email">${storageAccount.email}</div>
                <div class="status-userid">${storageAccount.userid}</div>
                <div class="status-note">${statusNote}</div>
            `;
        } else if (cookieStatus.hasCookie && cookieStatus.cookieData && !cookieStatus.cookieData.isExpired) {
            // Cookie存在且有效，但与storage不一致
            this.updateStatusWithCookie(currentStatus, cookieStatus.cookieData);
        } else if (storageAccount) {
            // storage中有账户但Cookie无效
            this.updateStatusWithStorageAccount(currentStatus, storageAccount, cookieStatus);
        } else {
            // 完全没有账户信息
            currentStatus.className = 'current-status no-account';
            currentStatus.innerHTML = `
                <span class="status-icon">👤</span>
                <div class="status-title">当前账户</div>
                <div class="status-email">未登录</div>
                <div class="status-userid">请先导入账户</div>
                <div class="status-note">${recommendation}</div>
            `;
        }
    }

    static async updateStatusWithCookie(currentStatus, cookieData) {
        // 尝试从账户列表中找到匹配的账户信息
        const accountListResult = await chrome.storage.local.get(['accountList']);
        const accounts = accountListResult.accountList || [];
        const matchingAccount = accounts.find(acc => acc.userid === cookieData.userid);

        if (matchingAccount) {
            currentStatus.className = 'current-status warning';
            currentStatus.innerHTML = `
                <span class="status-icon">⚠️</span>
                <div class="status-title">当前账户</div>
                <div class="status-email">${matchingAccount.email}</div>
                <div class="status-userid">${cookieData.userid}</div>
                <div class="status-note">基于Cookie识别</div>
            `;
        } else {
            currentStatus.className = 'current-status warning';
            currentStatus.innerHTML = `
                <span class="status-icon">⚠️</span>
                <div class="status-title">当前账户</div>
                <div class="status-email">未知账户</div>
                <div class="status-userid">${cookieData.userid}</div>
                <div class="status-note">Cookie中有认证信息</div>
            `;
        }
    }

    static updateStatusWithStorageAccount(currentStatus, storageAccount, cookieStatus) {
        let statusNote = '请重新切换';
        let statusIcon = '🔄';
        let showRestoreButton = false;

        if (cookieStatus.hasCookie && cookieStatus.cookieData?.isExpired) {
            statusNote = 'Cookie已过期';
            statusIcon = '⏰';
            showRestoreButton = true;
        } else if (!cookieStatus.hasCookie) {
            statusNote = 'Cookie已清除';
            statusIcon = '🍪';
            showRestoreButton = true;
        }

        currentStatus.className = 'current-status warning';
        currentStatus.innerHTML = `
            <span class="status-icon">${statusIcon}</span>
            <div class="status-title">当前账户</div>
            <div class="status-email">${storageAccount.email}</div>
            <div class="status-userid">${storageAccount.userid}</div>
            <div class="status-note">${statusNote}</div>
            ${showRestoreButton ? `
                <button id="restoreCookieBtn" class="btn-warning" style="margin-top: 8px; padding: 6px 12px; font-size: 11px; width: auto;">
                    🔧 重新设置Cookie
                </button>
            ` : ''}
        `;

        // 如果显示了恢复按钮，添加事件监听器
        if (showRestoreButton) {
            setTimeout(() => {
                const restoreBtn = document.getElementById('restoreCookieBtn');
                if (restoreBtn) {
                    restoreBtn.addEventListener('click', () => AccountManager.handleRestoreCookie(storageAccount));
                }
            }, 100);
        }
    }

    static displayAccountList(accounts, currentAccount) {
        const accountList = DOMManager.get('accountList');
        if (!accountList) {
            console.warn('⚠️ accountList DOM元素未找到，可能在测试环境中');
            return;
        }

        if (accounts.length === 0) {
            accountList.innerHTML = '<div class="loading">暂无保存的账户</div>';
            return;
        }

        const accountsHtml = accounts.map((account, index) => {
            const email = account.email || '未知邮箱';
            const userid = account.userid || '未知用户ID';
            const tokenType = account.tokenType || 'client';
            const validDays = account.validDays;

            const isCurrentAccount = currentAccount &&
                                   currentAccount.email === account.email &&
                                   currentAccount.userid === account.userid;

            // 计算token状态
            let tokenStatusText = '';
            let tokenStatusClass = '';
            if (account.expiresTime) {
                const expiresDate = new Date(account.expiresTime);
                const now = new Date();
                const timeDiff = expiresDate.getTime() - now.getTime();
                const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                
                if (daysLeft > 0) {
                    if (tokenType === 'deep') {
                        // 深度Token显示完整过期日期
                        const expiresDateStr = expiresDate.toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        });
                        tokenStatusText = `🌟 深度Token (${expiresDateStr}到期)`;
                        tokenStatusClass = 'token-deep-highlight';
                    } else {
                        tokenStatusText = `客户端Token (${daysLeft}天)`;
                        tokenStatusClass = 'token-client';
                    }
                } else {
                    tokenStatusText = '已过期';
                    tokenStatusClass = 'token-expired';
                }
            } else {
                const typeText = tokenType === 'deep' ? '🌟 深度' : '客户端';
                if (validDays) {
                    tokenStatusText = `${typeText}Token (${validDays}天)`;
                } else {
                    tokenStatusText = `${typeText}Token`;
                }
                tokenStatusClass = tokenType === 'deep' ? 'token-deep-highlight' : 'token-client';
            }

            let actionButtons = '';
            if (isCurrentAccount) {
                actionButtons = `
                    <span class="current-account-badge">正在使用</span>
                    <button class="btn-small btn-secondary" data-action="refresh" data-index="${index}">🔄 刷新</button>
                    <button class="btn-small btn-danger" data-action="delete" data-index="${index}">删除</button>
                `;
            } else {
                actionButtons = `
                    <button class="btn-small btn-info" data-action="switch" data-index="${index}">切换</button>
                    <button class="btn-small btn-secondary" data-action="refresh" data-index="${index}">🔄 刷新</button>
                    <button class="btn-small btn-danger" data-action="delete" data-index="${index}">删除</button>
                `;
            }

            return `
                <div class="account-item ${isCurrentAccount ? 'current-account' : ''}">
                    <div class="account-info">
                        <div class="account-email">${email}</div>
                        <div class="account-userid">ID: ${userid}</div>
                        <div class="account-token-status ${tokenStatusClass}">${tokenStatusText}</div>
                    </div>
                    <div class="account-actions">
                        ${actionButtons}
                    </div>
                </div>
            `;
        }).join('');

        accountList.innerHTML = accountsHtml;
    }
}

// =============================================================================
// 原生主机通信模块
// =============================================================================
class NativeHostManager {
    static NATIVE_HOST_NAME = 'com.cursor.client.manage';

    static async testConnection() {
        console.log('🧪 测试原生消息传递...');
        console.log('扩展ID:', chrome?.runtime?.id || 'test-extension-id');
        console.log('原生主机名称:', this.NATIVE_HOST_NAME);

        // 检查Chrome API是否可用
        if (!chrome?.runtime?.sendNativeMessage) {
            console.warn('⚠️ Chrome原生消息API不可用，可能在测试环境中');
            UIManager.showMessage('⚠️ 测试环境：原生消息API不可用', 'warning');
            return false;
        }

        return new Promise((resolve) => {
            chrome.runtime.sendNativeMessage(this.NATIVE_HOST_NAME, { action: 'getClientCurrentData' }, (response) => {
                const lastError = chrome.runtime.lastError;

                if (lastError) {
                    console.error('❌ 原生消息错误:', lastError.message || '未知错误');

                    const errorInfo = `
🔍 原生消息连接诊断:
• 错误: ${lastError.message || '未知错误'}
• 原生主机: ${this.NATIVE_HOST_NAME}
• 扩展ID: ${chrome.runtime.id}

📋 可能的解决方案:
1. 确保已安装原生主机: python3 install_native_host.py
2. 重启Chrome浏览器
3. 尝试具体扩展ID: python3 update_native_host.py ${chrome.runtime.id}
                    `;

                    UIManager.showMessage(errorInfo, 'error');
                    resolve(false);
                } else {
                    console.log('✅ 原生消息成功:', response);
                    UIManager.showMessage('✅ 原生消息传递测试成功！', 'success');
                    resolve(true);
                }
            });
        });
    }
}

// 暴露到全局作用域用于调试
window.testNativeMessaging = () => NativeHostManager.testConnection();
window.getExtensionId = () => chrome.runtime.id;

// =============================================================================
// 账户管理模块
// =============================================================================
class AccountManager {
    static async loadAccountList() {
        console.log('📋 开始加载账户列表...');

        try {
            // 检查Chrome API是否可用
            if (!chrome?.storage?.local) {
                console.warn('⚠️ Chrome storage API不可用，可能在测试环境中');
                return;
            }

            const result = await chrome.storage.local.get(['accountList', 'currentAccount']);
            const accounts = result?.accountList || [];
            const currentAccount = result?.currentAccount;

            console.log('📋 获取到账户列表:', accounts);
            AppState.setState({ accountList: accounts, currentAccount });

            UIManager.displayAccountList(accounts, currentAccount);
            console.log('✅ 账户列表显示完成');
        } catch (error) {
            const handledError = ErrorHandler.handleError(error, '加载账户列表');
            UIManager.showMessage(handledError.message, handledError.type);

            const accountList = DOMManager.get('accountList');
            if (accountList) {
                accountList.innerHTML = '<div class="loading">加载失败</div>';
            }
        }
    }

    static async switchToAccount(index) {
        return ErrorHandler.handleAsyncError(async () => {
            const { accountList } = AppState.getState();

            if (index >= 0 && index < accountList.length) {
                const account = accountList[index];

                LoadingManager.show('accountList', '切换中...');

                const cookieResult = await MessageManager.sendMessage('setCookie', {
                    userid: account.userid,
                    accessToken: account.accessToken
                });

                if (cookieResult.success) {
                    UIManager.showMessage(`已切换到账户: ${account.email}`, 'success');

                    await chrome.storage.local.set({ currentAccount: account });
                    AppState.setState({ currentAccount: account });

                    await this.updateCurrentStatus();
                    await this.loadAccountList();

                    setTimeout(async () => {
                        await DashboardManager.openDashboard();
                    }, 1000);
                } else {
                    throw new Error(cookieResult.error);
                }
            }
        }, '切换账户').finally(() => {
            LoadingManager.hide('accountList');
        });
    }

    static async deleteAccount(index) {
        console.log('🗑️ 删除账户请求，索引:', index);

        if (!confirm('确定要删除这个账户吗？')) {
            return;
        }

        return ErrorHandler.handleAsyncError(async () => {
            const result = await chrome.storage.local.get(['accountList', 'currentAccount']);
            const accounts = result.accountList || [];
            const currentAccount = result.currentAccount;

            if (index >= 0 && index < accounts.length) {
                const deletedAccount = accounts[index];

                const isCurrentAccount = currentAccount &&
                                       currentAccount.email === deletedAccount.email &&
                                       currentAccount.userid === deletedAccount.userid;

                if (isCurrentAccount) {
                    await chrome.storage.local.remove(['currentAccount']);

                    try {
                        const clearCookieResult = await MessageManager.sendMessage('clearCookie');
                        if (clearCookieResult && clearCookieResult.success) {
                            console.log('✅ Cookie 已清除');
                        }
                    } catch (cookieError) {
                        console.error('❌ 清除Cookie时出错:', cookieError);
                    }

                    UIManager.showMessage(`已删除当前账户: ${deletedAccount.email}\n相关Cookie和数据已清理`, 'success');
                } else {
                    UIManager.showMessage(`已删除账户: ${deletedAccount.email}`, 'success');
                }

                accounts.splice(index, 1);
                await chrome.storage.local.set({ accountList: accounts });

                AppState.setState({
                    accountList: accounts,
                    currentAccount: isCurrentAccount ? null : currentAccount
                });

                await this.updateCurrentStatus();
                await this.loadAccountList();
            }
        }, '删除账户');
    }

    static async refreshAccountToken(index) {
        return ErrorHandler.handleAsyncError(async () => {
            const { accountList } = AppState.getState();

            if (index < 0 || index >= accountList.length) {
                throw new Error('无效的账户索引');
            }

            const account = accountList[index];
            
            if (!confirm(`确定要刷新账户 ${account.email} 的Token吗？\n\n这将使用浏览器模式获取新的深度Token（60天有效期）。`)) {
                return;
            }

            LoadingManager.show('accountList', '🔄 正在刷新Token...');

            try {
                console.log('🔄 开始刷新账户Token:', account.email);

                // 使用当前账户的Token获取深度Token
                const deepTokenResult = await MessageManager.sendMessage('getDeepToken', { 
                    mode: 'deep_browser',
                    headless: false,
                    access_token: account.accessToken,
                    userid: account.userid
                });

                if (deepTokenResult.success || (deepTokenResult.data && !deepTokenResult.error)) {
                    const responseData = deepTokenResult.data || deepTokenResult;
                    
                                        if (responseData.needBrowserAction) {
                        // 需要浏览器操作
                        UIManager.showMessage('🌐 正在打开浏览器页面，请确认登录...', 'info');
                        
                        // handleDeepTokenBrowserMode 会完成所有必要的保存和Cookie设置
                        // 我们不需要再次强制更新Cookie
                        await DataImportManager.handleDeepTokenBrowserMode(responseData);
                        
                        console.log('✅ 深度Token浏览器模式完成，账户信息已自动更新');
                        UIManager.showMessage(`✅ 账户 ${account.email} 的深度Token已刷新完成`, 'success');
                        
                        // 重新加载账户列表和更新状态
                        setTimeout(async () => {
                            await this.updateCurrentStatus();
                            await this.loadAccountList();
                            LoadingManager.hide('accountList');
                        }, 1000); // 减少等待时间，因为handleDeepTokenBrowserMode已经完成了所有工作
                    } else {
                        // 直接获取到了深度Token
                        const updatedAccount = {
                            ...account,
                            accessToken: responseData.accessToken,
                            WorkosCursorSessionToken: responseData.WorkosCursorSessionToken || `${responseData.userid}%3A%3A${responseData.accessToken}`,
                            expiresTime: responseData.expiresTime,
                            tokenType: 'deep',
                            validDays: 60,
                            updatedTime: new Date().toISOString()
                        };

                        // 使用统一的保存方法，自动处理Storage和Cookie的同步
                        console.log('🔄 使用统一保存方法更新账户Token...');
                        const saveResult = await MessageManager.sendMessage('saveToLocalStorage', updatedAccount);
                        
                        if (!saveResult.success) {
                            throw new Error(`保存更新的账户失败: ${saveResult.error}`);
                        }

                        console.log('✅ 账户Token已通过统一方法更新:', saveResult.message);
                        
                        // 处理Cookie设置结果
                        if (saveResult.cookieError) {
                            console.warn('⚠️ Cookie设置失败:', saveResult.cookieError);
                            UIManager.showMessage(`✅ 账户 ${account.email} 的Token已刷新为深度Token，但Cookie设置失败`, 'warning');
                        } else if (saveResult.cookieSet) {
                            console.log('✅ Cookie已同步更新');
                            UIManager.showMessage(`✅ 账户 ${account.email} 的Token已刷新为深度Token（60天有效期）`, 'success');
                        }

                        // 更新应用状态
                        AppState.setState({ currentAccount: updatedAccount });

                        await this.updateCurrentStatus();
                        await this.loadAccountList();
                    }
                } else {
                    throw new Error(deepTokenResult.error || '获取深度Token失败');
                }
            } catch (error) {
                console.error('❌ 刷新Token失败:', error);
                UIManager.showMessage(`❌ 刷新Token失败: ${error.message}`, 'error');
                LoadingManager.hide('accountList');
            }
        }, '刷新账户Token');
    }

    static async updateCurrentStatus() {
        const currentStatus = DOMManager.get('currentStatus');
        if (!currentStatus) {
            console.warn('⚠️ currentStatus DOM元素未找到，可能在测试环境中');
            return;
        }

        try {
            console.log('🔍 更新当前状态 - 验证账户一致性...');

            // 检查是否在测试环境中
            if (!chrome?.runtime?.sendMessage) {
                console.log('⚠️ 测试环境：使用模拟状态数据');
                const mockStatus = {
                    isConsistent: false,
                    storageAccount: null,
                    cookieStatus: { hasCookie: false },
                    recommendation: '测试环境：无法验证真实状态'
                };
                UIManager.updateCurrentStatus(mockStatus);
                return;
            }

            const validationResult = await MessageManager.sendMessage('validateCurrentAccountStatus');

            if (!validationResult || !validationResult.success) {
                console.warn('⚠️ 账户状态验证失败，使用默认状态');
                const defaultStatus = {
                    isConsistent: false,
                    storageAccount: null,
                    cookieStatus: { hasCookie: false },
                    recommendation: validationResult?.error || '无法获取账户状态'
                };
                UIManager.updateCurrentStatus(defaultStatus);
                return;
            }

            const status = validationResult.status;
            console.log('📊 账户状态验证结果:', status);

            UIManager.updateCurrentStatus(status);

            if (status?.recommendation && status.recommendation !== '当前账户状态正常') {
                console.log('💡 建议:', status.recommendation);
            }

        } catch (error) {
            const handledError = ErrorHandler.handleError(error, '更新当前状态');
            currentStatus.className = 'current-status no-account';
            currentStatus.innerHTML = `
                <span class="status-icon">❌</span>
                <div class="status-title">状态错误</div>
                <div class="status-email">加载失败</div>
                <div class="status-userid">请重试</div>
                <div class="status-note">${handledError.message}</div>
            `;
        }
    }

    static async handleRestoreCookie(storageAccount) {
        return ErrorHandler.handleAsyncError(async () => {
            console.log('🔧 开始恢复Cookie...', storageAccount);

            const restoreBtn = document.getElementById('restoreCookieBtn');
            if (restoreBtn) {
                LoadingManager.show('restoreCookieBtn', '🔄 设置中...');
            }

            let accessToken = storageAccount.accessToken;

            if (!accessToken || accessToken.length < 100) {
                console.log('💡 Storage中的token不完整，尝试从原生主机获取...');

                try {
                    const nativeResult = await MessageManager.sendMessage('autoReadCursorData');
                    if (nativeResult.success && nativeResult.data.accessToken) {
                        accessToken = nativeResult.data.accessToken;
                        console.log('✅ 从原生主机获取到accessToken');

                        const updatedAccount = { ...storageAccount, accessToken };
                        await chrome.storage.local.set({ currentAccount: updatedAccount });

                        const accountListResult = await chrome.storage.local.get(['accountList']);
                        const accounts = accountListResult.accountList || [];
                        const accountIndex = accounts.findIndex(acc =>
                            acc.email === storageAccount.email && acc.userid === storageAccount.userid
                        );

                        if (accountIndex !== -1) {
                            accounts[accountIndex].accessToken = accessToken;
                            await chrome.storage.local.set({ accountList: accounts });
                        }
                    } else {
                        throw new Error('无法从原生主机获取accessToken');
                    }
                } catch (nativeError) {
                    console.warn('⚠️ 从原生主机获取token失败:', nativeError.message);
                    if (!accessToken) {
                        throw new Error('无法获取有效的accessToken，请重新导入账户');
                    }
                }
            }

            const cookieResult = await MessageManager.sendMessage('setCookie', {
                userid: storageAccount.userid,
                accessToken: accessToken
            });

            if (!cookieResult.success) {
                throw new Error(cookieResult.error || 'Cookie设置失败');
            }

            console.log('✅ Cookie设置成功');
            UIManager.showMessage('Cookie已重新设置', 'success');

            await this.updateCurrentStatus();

        }, '恢复Cookie').finally(() => {
            LoadingManager.hide('restoreCookieBtn');
        });
    }
}

// =============================================================================
// 消息管理模块
// =============================================================================
class MessageManager {
    static sendMessage(action, data = null) {
        return new Promise((resolve) => {
            // 检查Chrome API是否可用
            if (!chrome?.runtime?.sendMessage) {
                console.warn('⚠️ Chrome runtime API不可用，可能在测试环境中');
                resolve({ success: false, error: '测试环境：Chrome API不可用' });
                return;
            }

            chrome.runtime.sendMessage({ action, data }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Chrome runtime error:', chrome.runtime.lastError);
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(response || { success: false, error: '无响应' });
                }
            });
        });
    }
}

// =============================================================================
// 仪表板管理模块
// =============================================================================
class DashboardManager {
    static async openDashboard() {
        return ErrorHandler.handleAsyncError(async () => {
            const result = await MessageManager.sendMessage('openDashboard');
            if (result.success) {
                UIManager.showMessage('Dashboard页面已打开', 'success');
            } else {
                throw new Error(result.error);
            }
        }, '打开Dashboard');
    }
}

// =============================================================================
// 应用初始化
// =============================================================================
class App {
    static async initialize() {
        console.log('🚀 页面加载完成，开始初始化...');

        try {
            // 初始化DOM元素
            DOMManager.initialize();

            // 初始化应用状态
            await AccountManager.updateCurrentStatus();
            await AccountManager.loadAccountList();

            // 设置事件监听器
            EventManager.setupEventListeners();
            EventManager.setupMethodTabs();
            FileManager.setupFileUpload();

            // 标记为已初始化
            AppState.setState({ isInitialized: true });

            // 自动测试原生消息传递（仅在Chrome扩展环境中）
            if (chrome?.runtime?.sendNativeMessage) {
                console.log('开始自动测试原生消息传递...');
                setTimeout(() => NativeHostManager.testConnection(), 1000);
            } else {
                console.log('⚠️ 非Chrome扩展环境，跳过原生消息测试');
            }

        } catch (error) {
            ErrorHandler.handleError(error, '应用初始化');
            UIManager.showMessage('应用初始化失败，请刷新页面重试', 'error');
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => App.initialize());

// =============================================================================
// 事件管理模块
// =============================================================================
class EventManager {
    static setupEventListeners() {
        console.log('🔧 开始设置事件监听器...');

        const elements = DOMManager.getAll();

        // 基本按钮事件
        if (elements.importDataBtn) elements.importDataBtn.addEventListener('click', () => DataImportManager.handleManualImport());
        if (elements.autoReadBtn) elements.autoReadBtn.addEventListener('click', () => DataImportManager.handleAutoRead());
        if (elements.processFilesBtn) elements.processFilesBtn.addEventListener('click', () => DataImportManager.handleProcessFiles());
        if (elements.refreshAccountsBtn) elements.refreshAccountsBtn.addEventListener('click', () => AccountManager.loadAccountList());
        if (elements.openDashboardBtn) elements.openDashboardBtn.addEventListener('click', () => DashboardManager.openDashboard());
        if (elements.clearDataBtn) elements.clearDataBtn.addEventListener('click', () => this.handleClearData());
        if (elements.showInstallGuide) elements.showInstallGuide.addEventListener('click', () => this.handleShowInstallGuide());

        // 为账户列表设置事件代理
        if (elements.accountList) {
            elements.accountList.addEventListener('click', this.handleAccountListClick);
            console.log('✅ 账户列表事件监听器已设置');
        } else {
            console.warn('⚠️ accountList DOM元素未找到，可能在测试环境中');
        }

        console.log('✅ 事件监听器设置完成');
    }

    static setupMethodTabs() {
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

    static handleAccountListClick(event) {
        console.log('🖱️ 账户列表点击事件:', event.target);

        const target = event.target;
        if (!target.classList.contains('btn-small')) {
            return;
        }

        const action = target.getAttribute('data-action');
        const index = target.getAttribute('data-index');

        if (!action || index === null) {
            console.error('❌ 按钮缺少必要的data属性');
            return;
        }

        const accountIndex = parseInt(index);
        if (isNaN(accountIndex)) {
            console.error('❌ 无效的账户索引:', index);
            return;
        }

        if (action === 'switch') {
            AccountManager.switchToAccount(accountIndex);
        } else if (action === 'delete') {
            AccountManager.deleteAccount(accountIndex);
        } else if (action === 'refresh') {
            AccountManager.refreshAccountToken(accountIndex);
        }
    }

    static async handleClearData() {
        if (!confirm('确定要清空所有保存的数据吗？此操作不可恢复！')) {
            return;
        }

        return ErrorHandler.handleAsyncError(async () => {
            await chrome.storage.local.clear();
            UIManager.showMessage('所有数据已清空', 'success');
            AppState.setState({ accountList: [], currentAccount: null });
            await AccountManager.updateCurrentStatus();
            await AccountManager.loadAccountList();
        }, '清空数据');
    }

    static handleShowInstallGuide() {
        UIManager.showMessage('请参考插件文件夹中的 install-guide.md 文件获取详细安装说明', 'info');
        chrome.tabs.create({
            url: chrome.runtime.getURL('install-guide.md')
        });
    }
}

// =============================================================================
// 文件管理模块
// =============================================================================
class FileManager {
    static setupFileUpload() {
        const elements = DOMManager.getAll();
        const { jsonDropZone, jsonFileInput } = elements;

        if (!jsonDropZone || !jsonFileInput) {
            console.warn('⚠️ 文件上传元素未找到，可能在测试环境中');
            return;
        }

        // 点击上传
        jsonDropZone.addEventListener('click', () => {
            jsonFileInput.click();
        });

        // 文件选择
        jsonFileInput.addEventListener('change', this.handleFileSelect);

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
                this.handleFileSelect({ target: { files } });
            }
        });
    }

    static async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        return ErrorHandler.handleAsyncError(async () => {
            if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
                throw new Error('请选择JSON文件');
            }

            UIManager.showMessage('正在处理文件...', 'loading');

            const content = await this.readFile(file);
            const result = await MessageManager.sendMessage('parseFileContent', { content, fileType: 'json' });

            if (result.success) {
                AppState.setState({ uploadedJsonData: result.data });

                const jsonDropZone = DOMManager.get('jsonDropZone');
                if (jsonDropZone) {
                    jsonDropZone.innerHTML = `
                        <p>✅ 文件已上传: ${file.name}</p>
                        <p>Email: ${result.data.email}</p>
                        <p>User ID: ${result.data.userid}</p>
                    `;
                }

                UIManager.showMessage('JSON文件解析成功', 'success');
            } else {
                throw new Error(result.error);
            }
        }, '文件处理');
    }

    static readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    }
}

// =============================================================================
// 数据导入管理模块
// =============================================================================
class DataImportManager {
    static async handleAutoRead() {
        const nativeHostInfo = DOMManager.get('nativeHostInfo');

        return ErrorHandler.handleAsyncError(async () => {
            LoadingManager.show('autoReadBtn', '🔍 正在读取...');

            // 获取用户选择的token模式
            const selectedMode = document.querySelector('input[name="tokenMode"]:checked')?.value || 'client';
            
            let result;
            
            if (selectedMode === 'client') {
                // 客户端token模式
                result = await MessageManager.sendMessage('autoReadCursorData');
            } else {
                // 深度token模式
                const isHeadless = selectedMode === 'deep_headless';
                result = await MessageManager.sendMessage('getDeepToken', { 
                    mode: selectedMode,
                    headless: isHeadless 
                });
            }

            if (result.success || (result.data && !result.error)) {
                const responseData = result.data || result;
                
                // 根据返回的数据处理
                if (responseData.needBrowserAction) {
                    // 需要浏览器操作的情况（深度token浏览器模式）
                    await this.handleDeepTokenBrowserMode(responseData);
                } else {
                    // 直接处理成功的结果
                    UIManager.showMessage(`${responseData.tokenType === 'deep' ? '深度Token' : '客户端Token'}获取成功！`, 'success');

                    const accountData = {
                        email: responseData.email,
                        userid: responseData.userid,
                        accessToken: responseData.accessToken,
                        WorkosCursorSessionToken: responseData.WorkosCursorSessionToken || `${responseData.userid}%3A%3A${responseData.accessToken}`,
                        createTime: responseData.createdTime || new Date().toISOString(),
                        expiresTime: responseData.expiresTime,
                        tokenType: responseData.tokenType || 'client',
                        validDays: responseData.validDays
                    };

                    await this.processAccountData(accountData);
                }
            } else {
                if (result.needFileSelection) {
                    let errorMsg = result.error || '自动读取失败';

                    if (result.troubleshooting && result.troubleshooting.length > 0) {
                        errorMsg += '\n\n📋 故障排除建议：\n' +
                                   result.troubleshooting.map(item => `• ${item}`).join('\n');
                    } else if (result.details) {
                        errorMsg += `\n\n🔍 详细信息: ${result.details}`;
                    }

                    UIManager.showMessage(errorMsg, 'error');
                    if (nativeHostInfo) nativeHostInfo.classList.remove('hidden');
                } else {
                    throw new Error(result.error);
                }
            }
        }, '自动读取').finally(() => {
            LoadingManager.hide('autoReadBtn');
        });
    }

    static async handleDeepTokenBrowserMode(clientData) {
        try {
            UIManager.showMessage('正在打开深度登录窗口，请在弹出窗口中确认登录...', 'info');
            
            // 先设置客户端cookie，确保登录窗口可以正常工作
            console.log('🍪 设置临时客户端Cookie以确保登录窗口正常工作...');
            await MessageManager.sendMessage('setCookie', {
                userid: clientData.userid,
                accessToken: clientData.accessToken
            });
            
            // 生成PKCE参数
            const codeVerifier = this.generateCodeVerifier();
            const codeChallenge = await this.generateCodeChallenge(codeVerifier);
            const uuid = this.generateUUID();
            
            console.log('🔑 生成PKCE参数:', { uuid, codeVerifier: codeVerifier.substring(0, 10) + '...', codeChallenge: codeChallenge.substring(0, 10) + '...' });
            
            // 构造深度登录URL
            const deepLoginUrl = `https://www.cursor.com/cn/loginDeepControl?challenge=${codeChallenge}&uuid=${uuid}&mode=login`;
            
            // 打开新的Chrome弹窗窗口
            const newWindow = await chrome.windows.create({ 
                url: deepLoginUrl,
                type: 'popup',
                width: 900,
                height: 700,
                focused: true,
                left: Math.round((screen.width - 900) / 2),
                top: Math.round((screen.height - 700) / 2)
            });
            console.log('🌐 已打开深度登录窗口，窗口ID:', newWindow.id, '窗口类型: popup');
            
            // 更新状态提示
            UIManager.showMessage('深度登录窗口已打开，等待用户确认登录...', 'info');
            
            // 直接开始轮询获取Token，不依赖标签页状态
            const deepTokenData = await this.pollForDeepToken(uuid, codeVerifier, clientData);
            
            // 关闭深度登录窗口
            try {
                await chrome.windows.remove(newWindow.id);
                console.log('✅ 深度登录窗口已关闭');
            } catch (windowError) {
                console.warn('⚠️ 关闭窗口失败:', windowError.message);
            }
            
            if (deepTokenData) {
                console.log('🎯 深度Token数据获取成功，开始保存并设置Cookie...');
                try {
                    // 保存深度Token数据并确保Cookie正确设置
                    await this.saveDeepTokenData(deepTokenData, true); // 传递强制更新Cookie的标志
                    console.log('✅ 深度Token保存完成，显示成功消息');
                    
                    // 显示成功提示并询问用户是否打开Dashboard
                    const expiresDate = new Date(deepTokenData.expiresTime);
                    const expiresDateStr = expiresDate.toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    });
                    
                    const confirmMessage = `🎉 深度Token获取成功！\n\n` +
                        `✅ 已保存到本地存储\n` +
                        `🍪 已设置到Cookie\n` +
                        `📅 有效期至：${expiresDateStr}\n\n` +
                        `是否现在打开Cursor Dashboard验证登录状态？`;
                    
                    if (confirm(confirmMessage)) {
                        console.log('🌐 用户选择打开Dashboard...');
                        try {
                            const result = await MessageManager.sendMessage('openDashboard');
                            if (result && result.success) {
                                console.log('✅ Dashboard标签页已成功打开');
                                UIManager.showMessage('Dashboard页面已打开，请检查登录状态', 'success');
                            } else {
                                console.warn('⚠️ Dashboard打开响应:', result);
                                window.open('https://www.cursor.com/cn/dashboard', '_blank');
                                UIManager.showMessage('Dashboard页面已打开（备用方法）', 'success');
                            }
                        } catch (error) {
                            console.error('❌ Dashboard打开失败:', error);
                            window.open('https://www.cursor.com/cn/dashboard', '_blank');
                            UIManager.showMessage('Dashboard页面已打开（备用方法）', 'success');
                        }
                    } else {
                        console.log('👤 用户选择稍后手动打开Dashboard');
                        UIManager.showMessage('深度Token已成功保存！您可以随时点击"打开Cursor Dashboard"按钮验证', 'success');
                    }
                    
                } catch (saveError) {
                    console.error('❌ 保存深度Token失败:', saveError);
                    UIManager.showMessage(`深度Token保存失败: ${saveError.message}`, 'error');
                    throw saveError;
                }
            } else {
                throw new Error('未能获取到深度Token');
            }
            
        } catch (error) {
            console.error('深度Token浏览器模式处理失败:', error);
            UIManager.showMessage(`深度Token获取失败: ${error.message}`, 'error');
        }
    }



    static generateCodeVerifier() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    static async generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const hash = await crypto.subtle.digest('SHA-256', data);
        const hashArray = new Uint8Array(hash);
        return btoa(String.fromCharCode.apply(null, hashArray))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    static generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    static async pollForDeepToken(uuid, verifier, clientData) {
        console.log('🔄 通过Background开始轮询深度Token...');
        
        try {
            // 每5秒更新一次用户提示
            const updateInterval = setInterval(() => {
                UIManager.showMessage('正在等待登录确认...', 'info');
            }, 5000);
            
            // 调用background script处理轮询（避免CORS问题）
            const result = await MessageManager.sendMessage('pollDeepToken', {
                uuid: uuid,
                verifier: verifier,
                maxAttempts: 30,
                pollInterval: 2000
            });
            
            clearInterval(updateInterval);
            
            console.log('📥 Background轮询结果:', result);
            
            if (result.success && result.data.accessToken) {
                console.log('🎉 成功获取深度Token！');
                
                const deepAccessToken = result.data.accessToken;
                const authId = result.data.authId || '';
                
                // 提取深度用户ID
                let deepUserId = clientData.userid;
                if (authId.includes('|')) {
                    deepUserId = authId.split('|')[1];
                }

                // 创建深度token账户数据
                const deepAccountData = {
                    email: clientData.email,
                    userid: deepUserId,
                    accessToken: deepAccessToken,
                    WorkosCursorSessionToken: `${deepUserId}%3A%3A${deepAccessToken}`,
                    createTime: new Date().toISOString(),
                    expiresTime: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60天后
                    tokenType: 'deep',
                    validDays: 60
                };
                
                console.log('🎯 构造的深度Token数据:', {
                    email: deepAccountData.email,
                    userid: deepAccountData.userid,
                    accessTokenLength: deepAccountData.accessToken.length,
                    WorkosCursorSessionTokenLength: deepAccountData.WorkosCursorSessionToken.length,
                    tokenType: deepAccountData.tokenType,
                    expiresTime: deepAccountData.expiresTime
                });

                return deepAccountData;
            } else {
                console.error('❌ 获取深度Token失败:', result.error);
                return null;
            }
            
        } catch (error) {
            console.error('❌ 轮询深度Token过程中发生错误:', error);
            return null;
        }
    }

    static async saveDeepTokenData(deepAccountData, forceUpdateCookie = false) {
        console.log('💾 开始保存深度Token数据:', deepAccountData);
        
        try {
            // saveToLocalStorage 现在会统一处理Storage和Cookie的保存
            console.log('💾 调用统一的保存方法（包含Cookie设置）...');
            const saveResult = await MessageManager.sendMessage('saveToLocalStorage', deepAccountData);
            
            if (!saveResult.success) {
                throw new Error(`保存到Storage失败: ${saveResult.error}`);
            }
            
            console.log('✅ 深度Token数据保存成功:', saveResult.message);
            
            // 如果Cookie设置失败，给出警告但不中断流程
            if (saveResult.cookieError) {
                console.warn('⚠️ Cookie设置失败，但数据已保存:', saveResult.cookieError);
                UIManager.showMessage('深度Token已保存，但Cookie设置失败，请手动切换账户', 'warning');
            } else if (saveResult.cookieSet) {
                console.log('✅ Cookie已同步更新');
            }

            // 更新应用状态
            console.log('🔄 更新应用状态...');
            AppState.setState({ currentAccount: deepAccountData });

            // 刷新界面
            console.log('🔄 刷新界面...');
            await AccountManager.updateCurrentStatus();
            await AccountManager.loadAccountList();
            
            console.log('✅ 深度Token数据保存完成');
            
        } catch (error) {
            console.error('❌ 保存深度Token数据失败:', error);
            throw error;
        }
    }



    static async handleProcessFiles() {
        const { uploadedJsonData } = AppState.getState();
        const accessTokenFile = DOMManager.get('accessTokenFile');

        if (!uploadedJsonData) {
            UIManager.showMessage('请先上传scope_v3.json文件', 'error');
            return;
        }

        const accessToken = accessTokenFile?.value.trim();
        if (!accessToken) {
            UIManager.showMessage('请输入Access Token', 'error');
            return;
        }

        return ErrorHandler.handleAsyncError(async () => {
            LoadingManager.show('processFilesBtn', '📋 处理中...');

            const accountData = {
                email: uploadedJsonData.email,
                userid: uploadedJsonData.userid,
                accessToken: accessToken,
                WorkosCursorSessionToken: `${uploadedJsonData.userid}%3A%3A${accessToken}`,
                createTime: new Date().toISOString()
            };

            await this.processAccountData(accountData);

            // 清空文件输入
            if (accessTokenFile) accessTokenFile.value = '';
            AppState.clearUploadedData();

            const jsonDropZone = DOMManager.get('jsonDropZone');
            if (jsonDropZone) {
                jsonDropZone.innerHTML = `
                    <p>📄 拖拽 scope_v3.json 文件到这里<br>或点击选择文件</p>
                `;
            }

        }, '处理文件数据').finally(() => {
            LoadingManager.hide('processFilesBtn');
        });
    }

    static async handleManualImport() {
        const elements = DOMManager.getAll();
        const email = elements.emailInput?.value.trim();
        const userid = elements.useridInput?.value.trim();
        const accessToken = elements.accessTokenInput?.value.trim();

        if (!email || !userid || !accessToken) {
            UIManager.showMessage('请填写所有必需字段', 'error');
            return;
        }

        // 验证email格式
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            UIManager.showMessage('请输入有效的email地址', 'error');
            return;
        }

        return ErrorHandler.handleAsyncError(async () => {
            LoadingManager.show('importDataBtn', '处理中...');

            const accountData = {
                email: email,
                userid: userid,
                accessToken: accessToken,
                WorkosCursorSessionToken: `${userid}%3A%3A${accessToken}`,
                createTime: new Date().toISOString()
            };

            await this.processAccountData(accountData);

            // 清空输入框
            if (elements.emailInput) elements.emailInput.value = '';
            if (elements.useridInput) elements.useridInput.value = '';
            if (elements.accessTokenInput) elements.accessTokenInput.value = '';

        }, '手动导入').finally(() => {
            LoadingManager.hide('importDataBtn');
        });
    }

    static async processAccountData(accountData) {
        // 使用统一的保存方法（自动处理Storage和Cookie）
        console.log('💾 使用统一保存方法处理账户数据...');
        const saveResult = await MessageManager.sendMessage('saveToLocalStorage', accountData);
        
        if (!saveResult.success) {
            throw new Error(saveResult.error);
        }

        // 处理保存结果
        if (saveResult.cookieError) {
            console.warn('⚠️ Cookie设置失败:', saveResult.cookieError);
            UIManager.showMessage('认证数据导入成功，但Cookie设置失败，请手动切换账户', 'warning');
        } else {
            UIManager.showMessage('认证数据导入成功！', 'success');
        }

        // 更新应用状态
        AppState.setState({ currentAccount: accountData });

        // 刷新界面
        await AccountManager.updateCurrentStatus();
        await AccountManager.loadAccountList();

        // 自动打开Dashboard
        setTimeout(async () => {
            await DashboardManager.openDashboard();
        }, 1000);
    }
}

// =============================================================================
// 调试和工具函数
// =============================================================================
class DebugManager {
    static testAccountActions() {
        console.log('🧪 测试账户操作功能...');
        console.log('AccountManager.switchToAccount 函数:', typeof AccountManager.switchToAccount);
        console.log('AccountManager.deleteAccount 函数:', typeof AccountManager.deleteAccount);

        const accountList = DOMManager.get('accountList');
        console.log('accountList DOM元素:', accountList);

        if (accountList) {
            const buttons = accountList.querySelectorAll('.btn-small');
            console.log('找到的按钮数量:', buttons.length);
            buttons.forEach((btn, i) => {
                console.log(`按钮 ${i}:`, btn.textContent, btn.getAttribute('data-action'));
            });
        }
    }

    static async debugCookieStatus() {
        try {
            console.log('🔬 开始调试Cookie状态...');

            const cookieResult = await MessageManager.sendMessage('getCurrentCookieStatus');
            console.log('🍪 Cookie状态详情:', cookieResult);

            const storageResult = await chrome.storage.local.get(['currentAccount']);
            console.log('💾 Storage中的当前账户:', storageResult.currentAccount);

            const debugInfo = `
📊 Cookie调试信息:
─────────────────
🍪 Cookie状态: ${cookieResult.success ? '✅ 成功' : '❌ 失败'}
📋 是否有Cookie: ${cookieResult.hasCookie ? '是' : '否'}
📄 消息: ${cookieResult.message}

${cookieResult.debugInfo ? `
🔍 调试详情:
${JSON.stringify(cookieResult.debugInfo, null, 2)}
` : ''}

💾 Storage账户:
${storageResult.currentAccount ? `
- Email: ${storageResult.currentAccount.email}
- UserID: ${storageResult.currentAccount.userid}
- Token长度: ${storageResult.currentAccount.accessToken ? storageResult.currentAccount.accessToken.length : 'N/A'}
` : '- 无当前账户'}
            `;

            UIManager.showMessage(debugInfo, 'info');

            console.log('🔬 完整调试信息:', {
                cookieResult,
                storageResult: storageResult.currentAccount
            });

        } catch (error) {
            console.error('❌ 调试Cookie状态时发生错误:', error);
            UIManager.showMessage(`调试失败: ${error.message}`, 'error');
        }
    }
}

// 暴露调试函数到全局作用域
window.testAccountActions = () => DebugManager.testAccountActions();
window.debugCookieStatus = () => DebugManager.debugCookieStatus();
window.AppState = AppState;
window.AccountManager = AccountManager;
window.UIManager = UIManager;






