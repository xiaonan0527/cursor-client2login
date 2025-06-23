// =============================================================================
// Cursor Client2Login - 模块化重构版本
// =============================================================================

// 调试信息
console.log('🔍 插件调试信息:');
console.log('扩展ID:', chrome.runtime.id);
console.log('Chrome版本:', navigator.userAgent);

// =============================================================================
// JWT解码工具函数 (与background.js保持一致)
// =============================================================================
const JWTDecoder = {
  /**
   * 解码JWT token的payload部分
   * @param {string} token - JWT token
   * @returns {object|null} 解码后的payload对象，失败返回null
   */
  decodePayload(token) {
    try {
      if (!token || typeof token !== 'string') {
        console.error('❌ JWT解码失败: token无效');
        return null;
      }

      // JWT由三部分组成: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('❌ JWT解码失败: token格式错误，应该有3个部分');
        return null;
      }

      // 解码payload部分（第二部分）
      const payload = this.decodeBase64Part(parts[1]);
      console.log('✅ JWT payload解码成功:', payload);
      return payload;
    } catch (error) {
      console.error('❌ JWT解码过程出错:', error);
      return null;
    }
  },

  /**
   * 解码JWT的base64部分
   * @param {string} part - base64编码的部分
   * @returns {object} 解码后的对象
   */
  decodeBase64Part(part) {
    // 添加必要的padding
    let paddedPart = part;
    const missingPadding = paddedPart.length % 4;
    if (missingPadding) {
      paddedPart += '='.repeat(4 - missingPadding);
    }

    // Base64解码
    const decodedBytes = atob(paddedPart.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodedBytes);
  },

  /**
   * 从JWT token中提取用户ID
   * @param {string} token - JWT token
   * @returns {string|null} 用户ID，失败返回null
   */
  extractUserId(token) {
    const payload = this.decodePayload(token);
    if (!payload || !payload.sub) {
      console.error('❌ 无法从JWT中提取用户ID: sub字段不存在');
      return null;
    }

    const sub = payload.sub;
    console.log('🔍 JWT sub字段:', sub);

    // 如果sub包含|分隔符，提取后半部分作为用户ID
    if (sub.includes('|')) {
      const userId = sub.split('|')[1];
      console.log('✅ 从JWT提取的用户ID:', userId);
      return userId;
    } else {
      // 直接使用sub作为用户ID
      console.log('✅ 直接使用sub作为用户ID:', sub);
      return sub;
    }
  },

  /**
   * 从JWT token中提取过期时间
   * @param {string} token - JWT token
   * @returns {object|null} 包含过期时间信息的对象，失败返回null
   */
  extractExpirationInfo(token) {
    const payload = this.decodePayload(token);
    if (!payload || !payload.exp) {
      console.error('❌ 无法从JWT中提取过期时间: exp字段不存在');
      return null;
    }

    const expTimestamp = payload.exp;
    const expDate = new Date(expTimestamp * 1000); // exp是秒级时间戳，需要转换为毫秒
    const currentDate = new Date();
    const isExpired = expDate <= currentDate;

    // 计算剩余天数
    const remainingMs = expDate.getTime() - currentDate.getTime();
    const remainingDays = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

    const expirationInfo = {
      expTimestamp: expTimestamp,
      expDate: expDate.toISOString(),
      isExpired: isExpired,
      remainingDays: remainingDays
    };

    console.log('✅ JWT过期时间信息:', expirationInfo);
    return expirationInfo;
  },

  /**
   * 完整解析JWT token，提取所有关键信息
   * @param {string} token - JWT token
   * @returns {object|null} 包含用户ID和过期信息的对象，失败返回null
   */
  parseToken(token) {
    try {
      const payload = this.decodePayload(token);
      if (!payload) {
        return null;
      }

      const userId = this.extractUserId(token);
      const expirationInfo = this.extractExpirationInfo(token);

      if (!userId || !expirationInfo) {
        console.error('❌ JWT解析失败: 无法提取必要信息');
        return null;
      }

      const result = {
        userId: userId,
        sub: payload.sub,
        exp: payload.exp,
        expirationInfo: expirationInfo,
        fullPayload: payload
      };

      console.log('✅ JWT完整解析结果:', result);
      return result;
    } catch (error) {
      console.error('❌ JWT完整解析失败:', error);
      return null;
    }
  }
};

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
            accessTokenInput: document.getElementById('accessTokenInput'),
            importDataBtn: document.getElementById('importDataBtn'),
            autoReadBtn: document.getElementById('autoReadBtn'),
            accountList: document.getElementById('accountList'),

            openDashboardBtn: document.getElementById('openDashboardBtn'),
            clearDataBtn: document.getElementById('clearDataBtn'),
            nativeHostInfo: document.getElementById('nativeHostInfo'),
            showInstallGuide: document.getElementById('showInstallGuide'),
            currentStatus: document.getElementById('currentStatus'),
            nativeHostToggle: document.getElementById('nativeHostToggle'),
            clientTokenOption: document.getElementById('clientTokenOption'),
            deepBrowserOption: document.getElementById('deepBrowserOption')
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

        // 使用Toast通知替代原有的消息区域
        this.showToast(message, type, duration);
    }

    static showToast(message, type = 'info', duration = null) {
        try {
            // 创建Toast元素
            const toast = document.createElement('div');
            toast.className = `toast-notification ${type}`;
            toast.textContent = message;
            toast.style.whiteSpace = 'pre-line';

            // 获取或创建Toast容器
            let toastContainer = document.getElementById('toastContainer');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toastContainer';
                document.body.appendChild(toastContainer);
            }

            // 添加到容器
            toastContainer.appendChild(toast);

            // 显示Toast（延迟一帧以确保CSS过渡生效）
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });

            // 根据消息类型调整自动清除时间
            const clearTime = duration || (type === 'error' ? 8000 : type === 'loading' ? 0 : 3000);

            if (clearTime > 0) {
                setTimeout(() => {
                    this.hideToast(toast);
                }, clearTime);
            }

            console.log('✅ Toast通知已显示');
            return toast;
        } catch (error) {
            console.error('❌ 显示Toast通知时发生错误:', error);
            // 降级到原有的消息显示方式
            this.showLegacyMessage(message, type, duration);
        }
    }

    static hideToast(toast) {
        if (!toast || !toast.parentNode) return;

        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300); // 等待CSS过渡完成
    }

    static showLegacyMessage(message, type = 'info', duration = null) {
        // 保留原有的消息显示方式作为降级方案
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

            console.log('✅ 降级消息已显示到页面');
        } catch (error) {
            console.error('❌ 显示降级消息时发生错误:', error);
        }
    }

    static clearMessage() {
        // 清除Toast通知
        const toastContainer = document.getElementById('toastContainer');
        if (toastContainer) {
            const toasts = toastContainer.querySelectorAll('.toast-notification');
            toasts.forEach(toast => this.hideToast(toast));
        }

        // 清除传统消息区域
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
                <button id="logoutBtn" class="logout-btn" title="退出登录（仅清除Cookie）">退出</button>
                <span class="status-icon">✅</span>
                <div class="status-title">当前账户</div>
                <div class="status-email">${storageAccount.email}</div>
                <div class="status-userid">${storageAccount.userid}</div>
                <div class="status-note">${statusNote}</div>
            `;

            // 添加退出按钮事件监听器
            setTimeout(() => {
                const logoutBtn = document.getElementById('logoutBtn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.handleLogout();
                    });
                }
            }, 100);
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

        // 清除任何现有的加载遮罩
        this.hideAccountListLoading();

        if (accounts.length === 0) {
            accountList.innerHTML = '<div class="empty-state">暂无保存的账户<br><small>请先导入账户数据</small></div>';
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

                const expiresDateStr = expiresDate.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });

                if (daysLeft > 0) {
                    if (daysLeft <= 7) {
                        // 7天内过期，显示警告
                        tokenStatusText = `📅 ${expiresDateStr}到期 (剩余${daysLeft}天)`;
                        tokenStatusClass = 'token-expired'; // 警告状态
                    } else {
                        // 正常状态
                        tokenStatusText = `📅 ${expiresDateStr}到期 (剩余${daysLeft}天)`;
                        tokenStatusClass = 'token-deep'; // 正常状态
                    }
                } else {
                    // 已过期
                    tokenStatusText = `📅 已于${expiresDateStr}过期`;
                    tokenStatusClass = 'token-expired';
                }
            } else {
                // 没有过期时间信息，尝试从JWT解码获取
                if (account.accessToken) {
                    const jwtInfo = JWTDecoder.parseToken(account.accessToken);
                    if (jwtInfo && jwtInfo.expirationInfo) {
                        const expiresDate = new Date(jwtInfo.expirationInfo.expDate);
                        const expiresDateStr = expiresDate.toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        });
                        const daysLeft = jwtInfo.expirationInfo.remainingDays;

                        if (jwtInfo.expirationInfo.isExpired) {
                            tokenStatusText = `📅 已于${expiresDateStr}过期`;
                            tokenStatusClass = 'token-expired';
                        } else if (daysLeft <= 7) {
                            tokenStatusText = `📅 ${expiresDateStr}到期 (剩余${daysLeft}天)`;
                            tokenStatusClass = 'token-expired';
                        } else {
                            tokenStatusText = `📅 ${expiresDateStr}到期 (剩余${daysLeft}天)`;
                            tokenStatusClass = 'token-deep';
                        }
                    } else {
                        // JWT解码失败，显示未知状态
                        tokenStatusText = '📅 过期时间未知';
                        tokenStatusClass = 'token-client';
                    }
                } else {
                    // 没有Token信息
                    tokenStatusText = '📅 过期时间未知';
                    tokenStatusClass = 'token-client';
                }
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

    // 专门为账户列表设计的加载状态管理
    static showAccountListLoading(message = '处理中...') {
        const accountList = DOMManager.get('accountList');
        if (!accountList) return;

        // 移除现有的加载遮罩
        this.hideAccountListLoading();

        // 创建加载遮罩
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'accountListLoadingOverlay';
        loadingOverlay.className = 'account-list-loading-overlay';
        loadingOverlay.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        `;

        // 设置遮罩样式
        accountList.style.position = 'relative';
        accountList.appendChild(loadingOverlay);

        // 添加样式（如果还没有添加）
        if (!document.getElementById('account-list-loading-styles')) {
            this.addAccountListLoadingStyles();
        }
    }

    static hideAccountListLoading() {
        const overlay = document.getElementById('accountListLoadingOverlay');
        if (overlay) {
            overlay.remove();
        }
    }

    static addAccountListLoadingStyles() {
        const style = document.createElement('style');
        style.id = 'account-list-loading-styles';
        style.textContent = `
            .account-list-loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(2px);
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            }

            .loading-content {
                text-align: center;
                color: white;
            }

            .loading-spinner {
                width: 32px;
                height: 32px;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-top: 3px solid #4CAF50;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 12px;
            }

            .loading-text {
                font-size: 14px;
                font-weight: 500;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
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
// 原生主机状态管理模块
// =============================================================================
class NativeHostStateManager {
    static isEnabled = true;

    static async initialize() {
        // 从存储中恢复开关状态
        await this.loadStateFromStorage();

        const toggle = DOMManager.get('nativeHostToggle');

        if (toggle) {
            // 监听开关变化
            toggle.addEventListener('change', this.handleToggleChange.bind(this));
        }

        // 初始化UI状态
        this.updateUI();
    }

    static async loadStateFromStorage() {
        try {
            if (chrome?.storage?.local) {
                const result = await chrome.storage.local.get(['nativeHostEnabled']);
                // 如果存储中有值，使用存储的值；否则保持默认值 true
                if (result.nativeHostEnabled !== undefined) {
                    this.isEnabled = result.nativeHostEnabled;
                    console.log('📋 从存储恢复原生主机开关状态:', this.isEnabled);
                }
            }
        } catch (error) {
            console.warn('⚠️ 加载原生主机开关状态失败，使用默认值:', error);
        }
    }

    static async saveStateToStorage() {
        try {
            if (chrome?.storage?.local) {
                await chrome.storage.local.set({ nativeHostEnabled: this.isEnabled });
                console.log('💾 原生主机开关状态已保存:', this.isEnabled);
            }
        } catch (error) {
            console.warn('⚠️ 保存原生主机开关状态失败:', error);
        }
    }

    static async handleToggleChange(event) {
        this.isEnabled = event.target.checked;

        // 保存状态到存储
        await this.saveStateToStorage();

        this.updateUI();

        // 显示状态变化提示
        if (this.isEnabled) {
            UIManager.showMessage('原生主机功能已启用', 'success');
        } else {
            UIManager.showMessage('原生主机功能已禁用，相关功能将不可用', 'info');
        }
    }

    static updateUI() {
        const toggle = DOMManager.get('nativeHostToggle');
        const autoReadBtn = DOMManager.get('autoReadBtn');
        const clientTokenOption = DOMManager.get('clientTokenOption');
        const deepBrowserOption = DOMManager.get('deepBrowserOption');

        // 更新开关状态
        if (toggle) {
            toggle.checked = this.isEnabled;
        }

        // 更新依赖原生主机的UI元素
        const elementsToToggle = [autoReadBtn, clientTokenOption, deepBrowserOption].filter(el => el);

        elementsToToggle.forEach(element => {
            if (!this.isEnabled) {
                element.classList.add('native-host-disabled');
                if (element === autoReadBtn) {
                    element.disabled = true;
                }
            } else {
                element.classList.remove('native-host-disabled');
                if (element === autoReadBtn) {
                    element.disabled = false;
                }
            }
        });

        // 禁用/启用radio按钮
        const radioButtons = document.querySelectorAll('input[name="tokenMode"]');
        radioButtons.forEach(radio => {
            radio.disabled = !this.isEnabled;
        });
    }

    static isNativeHostEnabled() {
        return this.isEnabled;
    }

    static setEnabled(enabled) {
        this.isEnabled = enabled;
        this.updateUI();
    }
}

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
                accountList.innerHTML = '<div class="empty-state">加载失败<br><small>请刷新页面重试</small></div>';
            }
        }
    }

    static async switchToAccount(index) {
        return ErrorHandler.handleAsyncError(async () => {
            const { accountList } = AppState.getState();

            if (index >= 0 && index < accountList.length) {
                const account = accountList[index];

                // 使用专门的账户列表加载状态
                UIManager.showAccountListLoading('切换中...');

                const cookieResult = await MessageManager.sendMessage('setCookie', {
                    userid: account.userid,
                    accessToken: account.accessToken
                });

                if (cookieResult.success) {
                    UIManager.showMessage(`已切换到账户: ${account.email}`, 'success');

                    await chrome.storage.local.set({ currentAccount: account });
                    AppState.setState({ currentAccount: account });

                    await this.refreshAccountInterface();

                    setTimeout(async () => {
                        await DashboardManager.openDashboard();
                    }, 1000);
                } else {
                    throw new Error(cookieResult.error);
                }
            }
        }, '切换账户').finally(() => {
            // 确保加载状态被清除
            UIManager.hideAccountListLoading();
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

                await this.refreshAccountInterface();
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

            // 使用专门的账户列表加载状态
            UIManager.showAccountListLoading('🔄 正在刷新Token...');

            try {
                console.log('🔄 开始刷新账户Token:', account.email);

                // 直接使用浏览器模式刷新Token，不依赖原生主机
                console.log('🌐 使用浏览器模式刷新深度Token...');

                // 构造要刷新的账户数据
                const accountDataForRefresh = {
                    userid: account.userid,
                    accessToken: account.accessToken,
                    email: account.email,
                    tokenType: 'client',
                    needBrowserAction: true,
                    deepLoginUrl: 'https://www.cursor.com/cn/loginDeepControl'
                };

                UIManager.showMessage('🌐 正在打开浏览器页面，请确认登录...', 'info');

                // 直接调用浏览器模式处理，传递要刷新的账户信息
                await DataImportManager.handleDeepTokenBrowserMode(accountDataForRefresh);

                console.log('✅ 深度Token浏览器模式完成，账户信息已自动更新');
                UIManager.showMessage(`✅ 账户 ${account.email} 的深度Token已刷新完成`, 'success');

            } catch (error) {
                console.error('❌ 刷新Token失败:', error);
                UIManager.showMessage(`❌ 刷新Token失败: ${error.message}`, 'error');
            } finally {
                // 确保加载状态被清除
                UIManager.hideAccountListLoading();
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

    static async refreshAccountInterface() {
        // 统一的界面刷新方法，避免重复调用
        await this.updateCurrentStatus();
        await this.loadAccountList();
    }

    static async handleLogout() {
        return ErrorHandler.handleAsyncError(async () => {
            console.log('🚪 开始退出登录（仅清除Cookie）...');

            // 确认操作
            if (!confirm('确定要退出登录吗？\n\n这将清除Cookie中的认证信息，但保留本地存储的账户数据。\n您可以随时重新切换到该账户。')) {
                return;
            }

            // 显示加载状态
            UIManager.showMessage('正在退出登录...', 'loading');

            try {
                // 清除Cookie
                const clearResult = await MessageManager.sendMessage('clearCookie');

                if (clearResult.success) {
                    console.log('✅ Cookie已清除');
                    UIManager.showMessage('已退出登录，Cookie已清除', 'success');
                } else {
                    console.warn('⚠️ Cookie清除可能不完整:', clearResult.error);
                    UIManager.showMessage('退出登录完成，但Cookie清除可能不完整', 'warning');
                }

                // 刷新当前状态显示（不清除Storage中的currentAccount，让用户看到状态变化）
                await this.updateCurrentStatus();

            } catch (error) {
                console.error('❌ 退出登录失败:', error);
                throw new Error(`退出登录失败: ${error.message}`);
            }
        }, '退出登录');
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

            await this.refreshAccountInterface();

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
            await AccountManager.refreshAccountInterface();

            // 设置事件监听器
            EventManager.setupEventListeners();
            EventManager.setupMethodTabs();

            // 初始化原生主机状态管理（异步）
            await NativeHostStateManager.initialize();

            // 标记为已初始化
            AppState.setState({ isInitialized: true });

            // 自动测试原生消息传递（仅在Chrome扩展环境中且原生主机功能启用时）
            if (chrome?.runtime?.sendNativeMessage && NativeHostStateManager.isNativeHostEnabled()) {
                console.log('开始自动测试原生消息传递...');
                setTimeout(() => NativeHostManager.testConnection(), 1000);
            } else if (!chrome?.runtime?.sendNativeMessage) {
                console.log('⚠️ 非Chrome扩展环境，跳过原生消息测试');
            } else {
                console.log('⚠️ 原生主机功能已禁用，跳过原生消息测试');
            }

        } catch (error) {
            ErrorHandler.handleError(error, '应用初始化');
            UIManager.showMessage('应用初始化失败，请刷新页面重试', 'error');
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    App.initialize();
    UIEnhancementManager.init();
});

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
            await AccountManager.refreshAccountInterface();
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
// 文件管理模块 - 已移除文件上传功能
// =============================================================================
// 注意：文件上传功能已被移除，现在只支持手动输入和自动读取

// =============================================================================
// 数据导入管理模块
// =============================================================================
class DataImportManager {
    static async handleAutoRead() {
        const nativeHostInfo = DOMManager.get('nativeHostInfo');

        return ErrorHandler.handleAsyncError(async () => {
            // 检查原生主机是否启用（仅提示，不阻止执行）
            if (!NativeHostStateManager.isNativeHostEnabled()) {
                UIManager.showMessage('提示：原生主机功能已禁用，但仍会尝试执行', 'warning');
            }

            LoadingManager.show('autoReadBtn', '🔍 正在读取...');

            // 获取用户选择的token模式
            const selectedMode = document.querySelector('input[name="tokenMode"]:checked')?.value || 'client';
            
            let result;
            
            if (selectedMode === 'client') {
                // 客户端token模式
                result = await MessageManager.sendMessage('autoReadCursorData');
            }
            /*
            ========================================
            无头模式逻辑 - 暂时注释掉
            ========================================
            原因：原生主机的无头模式实现存在问题，需要完善后再启用
            恢复方法：取消下面的注释，并恢复HTML中的无头模式选项
            注意：需要确保 background.js 和 native_host.py 中的相关方法也正常工作
            ========================================
            */
            else if (selectedMode === 'deep_browser') {
                // 深度token浏览器模式
                result = await MessageManager.sendMessage('getDeepToken', {
                    mode: selectedMode,
                    headless: false
                });
            }
            /*
            else {
                // 深度token模式（包含无头模式）
                const isHeadless = selectedMode === 'deep_headless';
                result = await MessageManager.sendMessage('getDeepToken', {
                    mode: selectedMode,
                    headless: isHeadless
                });
            }
            */

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
                    await this.saveDeepTokenData(deepTokenData);
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
                
                // 使用JWT解码获取用户ID和过期时间
                console.log('🔍 开始使用JWT解码分析深度Token...');
                const jwtInfo = JWTDecoder.parseToken(deepAccessToken);

                let deepUserId = clientData.userid;
                let expiresTime = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 默认60天后
                let validDays = 60;

                if (jwtInfo) {
                    // 使用JWT解码的用户ID
                    if (jwtInfo.userId) {
                        deepUserId = jwtInfo.userId;
                        console.log('✅ 使用JWT解码的用户ID:', deepUserId);
                    }

                    // 使用JWT解码的过期时间
                    if (jwtInfo.expirationInfo) {
                        expiresTime = jwtInfo.expirationInfo.expDate;
                        validDays = jwtInfo.expirationInfo.remainingDays;
                        console.log('✅ 使用JWT解码的过期时间:', {
                            expDate: expiresTime,
                            remainingDays: validDays
                        });
                    }
                } else {
                    console.warn('⚠️ JWT解码失败，使用传统方法提取用户ID');
                    // 回退到传统方法
                    if (authId.includes('|')) {
                        deepUserId = authId.split('|')[1];
                    }
                }

                // 创建深度token账户数据
                const deepAccountData = {
                    email: clientData.email,
                    userid: deepUserId,
                    accessToken: deepAccessToken,
                    WorkosCursorSessionToken: `${deepUserId}%3A%3A${deepAccessToken}`,
                    createTime: new Date().toISOString(),
                    expiresTime: expiresTime,
                    tokenType: 'deep',
                    validDays: validDays,
                    jwtInfo: jwtInfo // 保存JWT解码信息用于调试
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

    static async saveDeepTokenData(deepAccountData) {
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
            await AccountManager.refreshAccountInterface();
            
            console.log('✅ 深度Token数据保存完成');
            
        } catch (error) {
            console.error('❌ 保存深度Token数据失败:', error);
            throw error;
        }
    }



    // handleProcessFiles 函数已移除 - 文件上传功能不再支持

    static async handleManualImport() {
        const elements = DOMManager.getAll();
        const email = elements.emailInput?.value.trim();
        const accessToken = elements.accessTokenInput?.value.trim();

        if (!email || !accessToken) {
            UIManager.showMessage('请填写邮箱地址和Access Token', 'error');
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

            // 使用JWT解码获取用户ID
            console.log('🔍 开始使用JWT解码分析手动输入的Token...');
            const jwtInfo = JWTDecoder.parseToken(accessToken);

            if (!jwtInfo || !jwtInfo.userId) {
                UIManager.showMessage('❌ 无法从Token中解析用户ID，请检查Token格式是否正确', 'error');
                return;
            }

            console.log('✅ 从JWT解码获取的用户ID:', jwtInfo.userId);
            UIManager.showMessage(`✅ 成功解析用户ID: ${jwtInfo.userId}`, 'success');

            const accountData = {
                email: email,
                userid: jwtInfo.userId,
                accessToken: accessToken,
                WorkosCursorSessionToken: `${jwtInfo.userId}%3A%3A${accessToken}`,
                createTime: new Date().toISOString(),
                tokenType: 'client',
                jwtInfo: jwtInfo // 保存JWT解码信息
            };

            await this.processAccountData(accountData);

            // 清空输入框
            if (elements.emailInput) elements.emailInput.value = '';
            if (elements.accessTokenInput) elements.accessTokenInput.value = '';

        }, '手动导入').finally(() => {
            LoadingManager.hide('importDataBtn');
        });
    }

    static async processAccountData(accountData) {
        // 在保存之前，使用JWT解码来获取正确的用户ID和过期时间
        console.log('🔍 开始使用JWT解码分析账户Token...');

        if (accountData.accessToken) {
            const jwtInfo = JWTDecoder.parseToken(accountData.accessToken);

            if (jwtInfo) {
                // 使用JWT解码的用户ID（如果可用）
                if (jwtInfo.userId && jwtInfo.userId !== accountData.userid) {
                    console.log('✅ 更新用户ID:', {
                        原始: accountData.userid,
                        JWT解码: jwtInfo.userId
                    });
                    accountData.userid = jwtInfo.userId;
                    // 同时更新WorkosCursorSessionToken
                    accountData.WorkosCursorSessionToken = `${jwtInfo.userId}%3A%3A${accountData.accessToken}`;
                }

                // 使用JWT解码的过期时间（如果可用）
                if (jwtInfo.expirationInfo) {
                    console.log('✅ 更新过期时间信息:', {
                        原始过期时间: accountData.expiresTime,
                        JWT过期时间: jwtInfo.expirationInfo.expDate,
                        剩余天数: jwtInfo.expirationInfo.remainingDays
                    });
                    accountData.expiresTime = jwtInfo.expirationInfo.expDate;
                    accountData.validDays = jwtInfo.expirationInfo.remainingDays;
                }

                // 保存JWT解码信息用于调试
                accountData.jwtInfo = jwtInfo;

                console.log('✅ JWT解码完成，更新后的账户数据:', {
                    email: accountData.email,
                    userid: accountData.userid,
                    tokenType: accountData.tokenType,
                    expiresTime: accountData.expiresTime,
                    validDays: accountData.validDays
                });
            } else {
                console.warn('⚠️ JWT解码失败，使用原始账户数据');
            }
        }

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

        // 更新应用状态并刷新界面
        AppState.setState({ currentAccount: accountData });
        await AccountManager.refreshAccountInterface();

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

// =============================================================================
// UI增强功能模块
// =============================================================================
class UIEnhancementManager {
    static init() {
        this.initCollapsibleSections();
        this.initScrollbarAutoHide();
    }

    // 初始化可折叠区域
    static initCollapsibleSections() {
        const collapsibleSections = document.querySelectorAll('.collapsible-section');

        collapsibleSections.forEach(section => {
            const header = section.querySelector('h3');
            if (header) {
                header.addEventListener('click', () => {
                    this.toggleSection(section);
                });
            }
        });
    }

    // 切换区域折叠状态
    static toggleSection(section) {
        const isCollapsed = section.classList.contains('collapsed');

        if (isCollapsed) {
            section.classList.remove('collapsed');
            console.log('📂 展开区域:', section.id);
        } else {
            section.classList.add('collapsed');
            console.log('📁 折叠区域:', section.id);
        }
    }

    // 初始化滚动条自动隐藏
    static initScrollbarAutoHide() {
        const accountList = document.getElementById('accountList');
        if (!accountList) return;

        let scrollTimeout;

        // 滚动时显示滚动条
        accountList.addEventListener('scroll', () => {
            accountList.classList.add('scrolling');

            // 清除之前的定时器
            clearTimeout(scrollTimeout);

            // 2秒后隐藏滚动条
            scrollTimeout = setTimeout(() => {
                accountList.classList.remove('scrolling');
            }, 2000);
        });

        // 鼠标进入时显示滚动条
        accountList.addEventListener('mouseenter', () => {
            clearTimeout(scrollTimeout);
        });

        // 鼠标离开时隐藏滚动条
        accountList.addEventListener('mouseleave', () => {
            scrollTimeout = setTimeout(() => {
                accountList.classList.remove('scrolling');
            }, 1000);
        });
    }
}






