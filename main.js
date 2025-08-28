// =============================================================================
// Cursor Client2Login - 主功能页面脚本
// 这是从popup.js转移过来的完整功能模块
// =============================================================================

// 调试信息
console.log('🔍 主页面调试信息:');
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
// 核心模块架构
// =============================================================================

/**
 * 错误处理器 - 统一错误处理和用户提示
 */
const ErrorHandler = {
  /**
   * 显示错误信息
   * @param {string} message - 错误消息
   * @param {Error|string} error - 错误对象或详细信息
   * @param {string} context - 错误上下文
   */
  showError(message, error = null, context = '') {
    console.error(`❌ [${context}] ${message}`, error);
    
    let errorDetails = '';
    if (error) {
      if (typeof error === 'string') {
        errorDetails = error;
      } else if (error.message) {
        errorDetails = error.message;
      } else {
        errorDetails = JSON.stringify(error);
      }
    }
    
    const fullMessage = errorDetails ? `${message}: ${errorDetails}` : message;
    UIManager.showToast(fullMessage, 'error');
    
    // 在消息区域显示详细错误
    MessageManager.showMessage(fullMessage, 'error');
  },

  /**
   * 显示成功信息
   * @param {string} message - 成功消息
   * @param {string} context - 上下文
   */
  showSuccess(message, context = '') {
    console.log(`✅ [${context}] ${message}`);
    UIManager.showToast(message, 'success');
    MessageManager.showMessage(message, 'success');
  },

  /**
   * 显示警告信息
   * @param {string} message - 警告消息
   * @param {string} context - 上下文
   */
  showWarning(message, context = '') {
    console.warn(`⚠️ [${context}] ${message}`);
    UIManager.showToast(message, 'warning');
    MessageManager.showMessage(message, 'warning');
  },

  /**
   * 处理原生主机错误
   * @param {Object} error - 错误对象
   */
  handleNativeHostError(error) {
    let message = '原生主机连接失败';
    let suggestions = [];
    
    if (error && error.message) {
      if (error.message.includes('not found')) {
        message = '原生主机程序未找到';
        suggestions = [
          '请确保已安装原生主机程序',
          '运行: python3 install_native_host.py install',
          '重启Chrome浏览器'
        ];
      } else if (error.message.includes('access denied')) {
        message = '原生主机访问被拒绝';
        suggestions = [
          '检查文件权限',
          '以管理员权限运行安装程序'
        ];
      }
    }
    
    this.showError(message, error, 'NativeHost');
    
    if (suggestions.length > 0) {
      const suggestionText = suggestions.map(s => `• ${s}`).join('\n');
      MessageManager.showMessage(`建议解决方案:\n${suggestionText}`, 'info');
    }
  }
};

/**
 * 加载管理器 - 管理加载状态
 */
const LoadingManager = {
  activeLoaders: new Set(),

  /**
   * 显示加载状态
   * @param {string} loaderId - 加载器ID
   * @param {string} message - 加载消息
   */
  show(loaderId, message = '加载中...') {
    this.activeLoaders.add(loaderId);
    console.log(`🔄 [Loading] ${loaderId}: ${message}`);
    
    // 更新UI显示加载状态
    const button = document.getElementById(loaderId);
    if (button) {
      button.disabled = true;
      button.textContent = message;
    }
    
    // 显示全局加载指示器
    this.updateGlobalLoader();
  },

  /**
   * 隐藏加载状态
   * @param {string} loaderId - 加载器ID
   * @param {string} originalText - 原始文本
   */
  hide(loaderId, originalText = null) {
    this.activeLoaders.delete(loaderId);
    console.log(`✅ [Loading] ${loaderId}: 完成`);
    
    // 恢复按钮状态
    const button = document.getElementById(loaderId);
    if (button) {
      button.disabled = false;
      if (originalText) {
        button.textContent = originalText;
      }
    }
    
    // 更新全局加载指示器
    this.updateGlobalLoader();
  },

  /**
   * 更新全局加载指示器
   */
  updateGlobalLoader() {
    const hasActiveLoaders = this.activeLoaders.size > 0;
    // 这里可以添加全局加载指示器的逻辑
    console.log(`🔄 全局加载状态: ${hasActiveLoaders ? '加载中' : '空闲'}`);
  }
};

/**
 * DOM管理器 - 管理DOM元素
 */
const DOMManager = {
  elements: {},

  /**
   * 初始化DOM元素引用
   */
  init() {
    const elementIds = [
      'nativeHostToggle',
      'currentStatus', 
      'messageArea',
      'importSection',
      'autoReadBtn',
      'importDataBtn',
      'emailInput',
      'accessTokenInput',
      'accountList',
      'openDashboardBtn',
      'clearDataBtn',
      'toastContainer'
    ];

    elementIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        this.elements[id] = element;
      } else {
        console.warn(`⚠️ 未找到DOM元素: ${id}`);
      }
    });

    console.log('✅ DOM元素初始化完成', Object.keys(this.elements));
  },

  /**
   * 获取DOM元素
   * @param {string} id - 元素ID
   * @returns {HTMLElement|null} DOM元素
   */
  get(id) {
    return this.elements[id] || document.getElementById(id);
  },

  /**
   * 检查必需的DOM元素是否存在
   * @returns {boolean} 是否所有必需元素都存在
   */
  validateRequired() {
    const required = ['currentStatus', 'messageArea', 'accountList'];
    const missing = required.filter(id => !this.get(id));
    
    if (missing.length > 0) {
      console.error('❌ 缺少必需的DOM元素:', missing);
      return false;
    }
    
    return true;
  }
};

/**
 * 应用状态管理器
 */
const AppState = {
  state: {
    currentAccount: null,
    accountList: [],
    nativeHostEnabled: true,
    isLoading: false
  },

  /**
   * 设置状态
   * @param {string} key - 状态键
   * @param {any} value - 状态值
   */
  setState(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    console.log(`📊 状态更新: ${key}`, { old: oldValue, new: value });
    
    // 触发状态变更事件
    this.onStateChange(key, value, oldValue);
  },

  /**
   * 获取状态
   * @param {string} key - 状态键
   * @returns {any} 状态值
   */
  getState(key = null) {
    return key ? this.state[key] : this.state;
  },

  /**
   * 状态变更处理
   * @param {string} key - 变更的键
   * @param {any} newValue - 新值
   * @param {any} oldValue - 旧值
   */
  onStateChange(key, newValue, oldValue) {
    switch (key) {
      case 'currentAccount':
        UIManager.updateCurrentAccountStatus(newValue);
        break;
      case 'accountList':
        UIManager.updateAccountList(newValue);
        break;
      case 'isLoading':
        UIManager.updateLoadingState(newValue);
        break;
    }
  }
};

/**
 * UI管理器 - 管理用户界面
 */
const UIManager = {
  /**
   * 显示Toast通知
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型 (success, error, warning, info)
   * @param {number} duration - 显示时长(毫秒)
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = DOMManager.get('toastContainer');
    if (!container) {
      console.warn('⚠️ Toast容器不存在');
      return;
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // 显示动画
    setTimeout(() => toast.classList.add('show'), 100);
    
    // 自动移除
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (container.contains(toast)) {
          container.removeChild(toast);
        }
      }, 300);
    }, duration);
  },

  /**
   * 更新当前账户状态显示
   * @param {Object|null} account - 账户信息
   */
  updateCurrentAccountStatus(account) {
    const statusElement = DOMManager.get('currentStatus');
    if (!statusElement) return;

    const statusIcon = statusElement.querySelector('.status-icon');
    const statusTitle = statusElement.querySelector('.status-title');
    const statusEmail = statusElement.querySelector('.status-email');
    const statusUserid = statusElement.querySelector('.status-userid');

    if (account) {
      statusElement.className = 'current-status has-account';
      if (statusIcon) statusIcon.textContent = '✅';
      if (statusTitle) statusTitle.textContent = '当前账户';
      if (statusEmail) statusEmail.textContent = account.email;
      if (statusUserid) statusUserid.textContent = `ID: ${account.userid}`;
    } else {
      statusElement.className = 'current-status no-account';
      if (statusIcon) statusIcon.textContent = '👤';
      if (statusTitle) statusTitle.textContent = '当前账户';
      if (statusEmail) statusEmail.textContent = '未登录';
      if (statusUserid) statusUserid.textContent = '请先导入账户';
    }
  },

  /**
   * 更新账户列表显示
   * @param {Array} accountList - 账户列表
   */
  updateAccountList(accountList) {
    const listElement = DOMManager.get('accountList');
    if (!listElement) return;

    if (!accountList || accountList.length === 0) {
      listElement.innerHTML = '<div class="loading">暂无保存的账户</div>';
      return;
    }

    const currentAccount = AppState.getState('currentAccount');
    
    listElement.innerHTML = accountList.map(account => {
      const isCurrent = currentAccount && 
                       currentAccount.email === account.email && 
                       currentAccount.userid === account.userid;
      
      // 解析过期时间
      let expiryDisplay = '未知';
      let expiryClass = '';
      
      if (account.accessToken) {
        const jwtInfo = JWTDecoder.parseToken(account.accessToken);
        if (jwtInfo && jwtInfo.expirationInfo) {
          const { remainingDays, isExpired } = jwtInfo.expirationInfo;
          const expDate = new Date(jwtInfo.expirationInfo.expDate);
          
          if (isExpired) {
            expiryDisplay = '已过期';
            expiryClass = 'expired';
          } else if (remainingDays <= 7) {
            expiryDisplay = `${remainingDays}天后过期`;
            expiryClass = 'warning';
          } else {
            const year = expDate.getFullYear();
            const month = String(expDate.getMonth() + 1).padStart(2, '0');
            const day = String(expDate.getDate()).padStart(2, '0');
            expiryDisplay = `${year}-${month}-${day} (${remainingDays}天)`;
            expiryClass = 'normal';
          }
        }
      }

      return `
        <div class="account-item ${isCurrent ? 'current' : ''}" data-email="${account.email}" data-userid="${account.userid}">
          <div class="account-header">
            <div class="account-info">
              <div class="account-email">
                ${account.email}
                ${isCurrent ? '<span class="current-badge">正在使用</span>' : ''}
              </div>
              <div class="account-userid">ID: ${account.userid}</div>
              <div class="account-expiry ${expiryClass}">📅 ${expiryDisplay}</div>
            </div>
            <div class="account-actions">
              ${!isCurrent ? `<button class="switch-btn" data-email="${account.email}" data-userid="${account.userid}">切换</button>` : ''}
              <button class="remove-btn btn-danger" data-email="${account.email}" data-userid="${account.userid}">删除</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // 设置事件委托处理按钮点击
    this.setupAccountListEvents();
  },

  /**
   * 设置账户列表的事件委托
   */
  setupAccountListEvents() {
    const listElement = DOMManager.get('accountList');
    if (!listElement) return;

    // 移除旧的事件监听器（如果存在）
    listElement.removeEventListener('click', this.handleAccountListClick);
    
    // 添加新的事件监听器
    listElement.addEventListener('click', this.handleAccountListClick.bind(this));
  },

  /**
   * 处理账户列表的点击事件
   */
  handleAccountListClick(event) {
    const target = event.target;
    
    if (target.classList.contains('switch-btn')) {
      // 处理切换按钮
      const email = target.dataset.email;
      const userid = target.dataset.userid;
      if (email && userid) {
        AccountManager.switchAccount(email, userid);
      }
    } else if (target.classList.contains('remove-btn')) {
      // 处理删除按钮
      const email = target.dataset.email;
      const userid = target.dataset.userid;
      if (email && userid) {
        AccountManager.removeAccount(email, userid);
      }
    }
  },

  /**
   * 更新加载状态
   * @param {boolean} isLoading - 是否正在加载
   */
  updateLoadingState(isLoading) {
    // 这里可以添加全局加载状态的UI更新
    console.log(`🔄 UI加载状态: ${isLoading ? '加载中' : '完成'}`);
  }
};

/**
 * 原生主机管理器
 */
const NativeHostManager = {
  /**
   * 检查原生主机是否可用
   * @returns {Promise<boolean>} 是否可用
   */
  async isAvailable() {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'autoReadCursorData' 
      });
      return response && !response.needFileSelection;
    } catch (error) {
      console.warn('⚠️ 原生主机检查失败:', error);
      return false;
    }
  },

  /**
   * 自动读取Cursor数据
   * @param {string} mode - 读取模式
   * @returns {Promise<Object>} 读取结果
   */
  async readCursorData(mode = 'client') {
    try {
      LoadingManager.show('autoReadBtn', '🔄 读取中...');
      
      const response = await chrome.runtime.sendMessage({
        action: mode === 'deep_browser' ? 'getDeepToken' : 'autoReadCursorData',
        data: { mode }
      });
      
      LoadingManager.hide('autoReadBtn', '🔍 自动读取Cursor数据');
      
      if (response.success) {
        return response;
      } else {
        throw new Error(response.error || '读取失败');
      }
    } catch (error) {
      LoadingManager.hide('autoReadBtn', '🔍 自动读取Cursor数据');
      throw error;
    }
  }
};

/**
 * 账户管理器
 */
const AccountManager = {
  /**
   * 加载账户列表
   */
  async loadAccountList() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAccountList' });
      const accountList = response?.accountList || [];
      AppState.setState('accountList', accountList);
      
      // 同时加载当前账户
      const currentResponse = await chrome.runtime.sendMessage({ action: 'getCurrentAccount' });
      const currentAccount = currentResponse?.currentAccount || null;
      AppState.setState('currentAccount', currentAccount);
      
      console.log('✅ 账户列表加载完成', { 
        总数: accountList.length, 
        当前账户: currentAccount?.email || '无'
      });
    } catch (error) {
      ErrorHandler.showError('加载账户列表失败', error, 'AccountManager');
    }
  },

  /**
   * 保存账户
   * @param {Object} accountData - 账户数据
   */
  async saveAccount(accountData) {
    try {
      LoadingManager.show('importDataBtn', '💾 保存中...');
      
      const response = await chrome.runtime.sendMessage({
        action: 'saveToLocalStorage',
        data: accountData
      });
      
      LoadingManager.hide('importDataBtn', '💾 导入并设置认证');
      
      if (response.success) {
        ErrorHandler.showSuccess('账户保存成功', 'AccountManager');
        await this.loadAccountList(); // 重新加载列表
        
        // 清空表单
        const emailInput = DOMManager.get('emailInput');
        const tokenInput = DOMManager.get('accessTokenInput');
        if (emailInput) emailInput.value = '';
        if (tokenInput) tokenInput.value = '';
        
        return true;
      } else {
        throw new Error(response.error || '保存失败');
      }
    } catch (error) {
      LoadingManager.hide('importDataBtn', '💾 导入并设置认证');
      ErrorHandler.showError('保存账户失败', error, 'AccountManager');
      return false;
    }
  },

  /**
   * 切换账户
   * @param {string} email - 邮箱
   * @param {string} userid - 用户ID
   */
  async switchAccount(email, userid) {
    try {
      const accountList = AppState.getState('accountList');
      const account = accountList.find(acc => acc.email === email && acc.userid === userid);
      
      if (!account) {
        throw new Error('账户不存在');
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'switchAccount',
        accountData: account
      });
      
      if (response.success) {
        ErrorHandler.showSuccess(`已切换到账户: ${email}`, 'AccountManager');
        await this.loadAccountList(); // 重新加载列表以更新当前状态
      } else {
        throw new Error(response.error || '切换失败');
      }
    } catch (error) {
      ErrorHandler.showError('切换账户失败', error, 'AccountManager');
    }
  },

  /**
   * 删除账户
   * @param {string} email - 邮箱
   * @param {string} userid - 用户ID
   */
  async removeAccount(email, userid) {
    if (!confirm(`确定要删除账户 ${email} 吗？`)) {
      return;
    }
    
    try {
      const accountList = AppState.getState('accountList');
      const filteredList = accountList.filter(acc => 
        !(acc.email === email && acc.userid === userid)
      );
      
      await chrome.storage.local.set({ accountList: filteredList });
      
      // 如果删除的是当前账户，清除当前账户状态
      const currentAccount = AppState.getState('currentAccount');
      if (currentAccount && currentAccount.email === email && currentAccount.userid === userid) {
        await chrome.storage.local.remove(['currentAccount']);
        AppState.setState('currentAccount', null);
      }
      
      ErrorHandler.showSuccess(`账户 ${email} 已删除`, 'AccountManager');
      await this.loadAccountList(); // 重新加载列表
    } catch (error) {
      ErrorHandler.showError('删除账户失败', error, 'AccountManager');
    }
  }
};

/**
 * 消息管理器
 */
const MessageManager = {
  /**
   * 显示消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型
   */
  showMessage(message, type = 'info') {
    const messageArea = DOMManager.get('messageArea');
    if (!messageArea) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = message.replace(/\n/g, '<br>');
    
    // 清除旧消息
    messageArea.innerHTML = '';
    messageArea.appendChild(messageDiv);
    
    // 3秒后自动隐藏
    setTimeout(() => {
      if (messageArea.contains(messageDiv)) {
        messageDiv.style.opacity = '0';
        setTimeout(() => {
          if (messageArea.contains(messageDiv)) {
            messageArea.removeChild(messageDiv);
          }
        }, 300);
      }
    }, 3000);
  },

  /**
   * 清除消息
   */
  clearMessage() {
    const messageArea = DOMManager.get('messageArea');
    if (messageArea) {
      messageArea.innerHTML = '';
    }
  }
};

/**
 * Dashboard管理器
 */
const DashboardManager = {
  /**
   * 打开Dashboard
   */
  async openDashboard() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'openDashboard' });
      if (response.success) {
        ErrorHandler.showSuccess('Dashboard已打开', 'Dashboard');
      } else {
        throw new Error(response.error || '打开失败');
      }
    } catch (error) {
      ErrorHandler.showError('打开Dashboard失败', error, 'Dashboard');
    }
  }
};

/**
 * 事件管理器 - 管理所有事件监听
 */
const EventManager = {
  /**
   * 初始化事件监听器
   */
  init() {
    this.setupMethodTabs();
    this.setupCollapsibleSections();
    this.setupFormSubmission();
    this.setupQuickActions();
    this.setupNativeHostToggle();
    
    console.log('✅ 事件监听器初始化完成');
  },

  /**
   * 设置方法标签页切换
   */
  setupMethodTabs() {
    const tabs = document.querySelectorAll('.method-tab');
    const contents = document.querySelectorAll('.method-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const method = tab.dataset.method;
        
        // 更新标签页状态
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        // 更新内容显示
        contents.forEach(content => {
          content.classList.remove('active');
          if (content.id === `${method}Method`) {
            content.classList.add('active');
          }
        });
      });
    });
  },

  /**
   * 设置可折叠部分 - 已移除折叠功能，保持展开状态
   */
  setupCollapsibleSections() {
    // 移除折叠功能，导入认证数据部分始终保持展开状态
    const importSection = document.getElementById('importSection');
    if (importSection) {
      importSection.classList.remove('collapsed');
    }
  },

  /**
   * 设置表单提交
   */
  setupFormSubmission() {
    // 自动读取按钮
    const autoReadBtn = DOMManager.get('autoReadBtn');
    if (autoReadBtn) {
      autoReadBtn.addEventListener('click', this.handleAutoRead.bind(this));
    }

    // 手动导入按钮
    const importBtn = DOMManager.get('importDataBtn');
    if (importBtn) {
      importBtn.addEventListener('click', this.handleManualImport.bind(this));
    }
  },

  /**
   * 设置快速操作
   */
  setupQuickActions() {
    // 打开Dashboard
    const dashboardBtn = DOMManager.get('openDashboardBtn');
    if (dashboardBtn) {
      dashboardBtn.addEventListener('click', DashboardManager.openDashboard);
    }

    // 清空数据
    const clearBtn = DOMManager.get('clearDataBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', this.handleClearData.bind(this));
    }
  },

  /**
   * 设置原生主机开关
   */
  setupNativeHostToggle() {
    const toggle = DOMManager.get('nativeHostToggle');
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        AppState.setState('nativeHostEnabled', enabled);
        console.log(`🔌 原生主机功能: ${enabled ? '启用' : '禁用'}`);
      });
    }
  },

  /**
   * 处理自动读取
   */
  async handleAutoRead() {
    try {
      // 获取选择的模式
      const modeRadio = document.querySelector('input[name="tokenMode"]:checked');
      const mode = modeRadio ? modeRadio.value : 'client';
      
      console.log('🚀 开始自动读取，模式:', mode);
      
      const response = await NativeHostManager.readCursorData(mode);
      
      if (response.success && response.data) {
        const { email, userid, accessToken, tokenType } = response.data;
        
        if (email && userid && accessToken) {
          const accountData = {
            email,
            userid,
            accessToken,
            tokenType: tokenType || mode,
            importMethod: 'auto',
            createdAt: new Date().toISOString()
          };
          
          await AccountManager.saveAccount(accountData);
          ErrorHandler.showSuccess('自动读取并保存成功！', 'AutoRead');
        } else {
          throw new Error('读取的数据不完整');
        }
      } else {
        throw new Error(response.error || '自动读取失败');
      }
    } catch (error) {
      ErrorHandler.handleNativeHostError(error);
    }
  },

  /**
   * 处理手动导入
   */
  async handleManualImport() {
    try {
      const emailInput = DOMManager.get('emailInput');
      const tokenInput = DOMManager.get('accessTokenInput');
      
      if (!emailInput || !tokenInput) {
        throw new Error('表单元素不存在');
      }
      
      const email = emailInput.value.trim();
      const accessToken = tokenInput.value.trim();
      
      if (!email || !accessToken) {
        throw new Error('请填写完整的邮箱和Token信息');
      }
      
      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('邮箱格式不正确');
      }
      
      // 尝试解析JWT获取用户ID
      console.log('🔍 尝试从JWT中解析用户信息...');
      const jwtInfo = JWTDecoder.parseToken(accessToken);
      
      let userid;
      if (jwtInfo && jwtInfo.userId) {
        userid = jwtInfo.userId;
        console.log('✅ 从JWT成功解析用户ID:', userid);
        
        // 显示解析结果
        if (jwtInfo.expirationInfo) {
          const { remainingDays, isExpired } = jwtInfo.expirationInfo;
          const statusText = isExpired ? '已过期' : `剩余${remainingDays}天`;
          ErrorHandler.showSuccess(`JWT解析成功！用户ID: ${userid}, 状态: ${statusText}`, 'JWT');
        }
      } else {
        // JWT解析失败，要求用户手动输入
        throw new Error('无法从JWT中解析用户ID，请检查Token格式是否正确');
      }
      
      const accountData = {
        email,
        userid,
        accessToken,
        tokenType: 'manual',
        importMethod: 'manual',
        createdAt: new Date().toISOString()
      };
      
      await AccountManager.saveAccount(accountData);
    } catch (error) {
      ErrorHandler.showError('手动导入失败', error, 'ManualImport');
    }
  },

  /**
   * 处理清空数据
   */
  async handleClearData() {
    if (!confirm('确定要清空所有数据吗？此操作将删除所有保存的账户信息且不可撤销。')) {
      return;
    }
    
    try {
      // 清空本地存储
      await chrome.storage.local.clear();
      
      // 清空Cookie
      await chrome.runtime.sendMessage({ action: 'clearCookie' });
      
      // 重置应用状态
      AppState.setState('currentAccount', null);
      AppState.setState('accountList', []);
      
      ErrorHandler.showSuccess('所有数据已清空', 'ClearData');
    } catch (error) {
      ErrorHandler.showError('清空数据失败', error, 'ClearData');
    }
  }
};

/**
 * 数据导入管理器
 */
const DataImportManager = {
  /**
   * 验证导入数据
   * @param {Object} data - 导入的数据
   * @returns {boolean} 是否有效
   */
  validateImportData(data) {
    const required = ['email', 'userid', 'accessToken'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      ErrorHandler.showError(`缺少必需字段: ${missing.join(', ')}`, null, 'DataImport');
      return false;
    }
    
    return true;
  },

  /**
   * 处理导入的数据
   * @param {Object} rawData - 原始数据
   * @returns {Object} 处理后的数据
   */
  processImportData(rawData) {
    return {
      ...rawData,
      importMethod: rawData.importMethod || 'unknown',
      createdAt: rawData.createdAt || new Date().toISOString(),
      tokenType: rawData.tokenType || 'client'
    };
  }
};

/**
 * 主应用类
 */
const App = {
  /**
   * 初始化应用
   */
  async init() {
    try {
      console.log('🚀 开始初始化Cursor Client2Login主页面...');
      
      // 初始化DOM管理器
      DOMManager.init();
      
      // 验证必需的DOM元素
      if (!DOMManager.validateRequired()) {
        throw new Error('缺少必需的DOM元素');
      }
      
      // 初始化事件管理器
      EventManager.init();
      
      // 加载账户数据
      await AccountManager.loadAccountList();
      
      // 检查原生主机状态
      const nativeHostAvailable = await NativeHostManager.isAvailable();
      console.log(`🔌 原生主机状态: ${nativeHostAvailable ? '可用' : '不可用'}`);
      
      // 显示初始化完成消息
      MessageManager.showMessage('主页面初始化完成，可以开始使用各项功能', 'success');
      
      console.log('✅ 主页面初始化完成');
    } catch (error) {
      console.error('❌ 初始化失败:', error);
      ErrorHandler.showError('应用初始化失败', error, 'App');
    }
  }
};

/**
 * 调试管理器 - 开发和调试工具
 */
const DebugManager = {
  /**
   * 启用调试模式
   */
  enableDebugMode() {
    window.DebugMode = true;
    window.App = App;
    window.AppState = AppState;
    window.AccountManager = AccountManager;
    window.UIManager = UIManager;
    window.ErrorHandler = ErrorHandler;
    window.JWTDecoder = JWTDecoder;
    
    console.log('🐛 调试模式已启用');
    console.log('可用的调试对象:', [
      'App', 'AppState', 'AccountManager', 
      'UIManager', 'ErrorHandler', 'JWTDecoder'
    ]);
  },

  /**
   * 显示应用状态
   */
  showAppState() {
    console.table(AppState.getState());
  },

  /**
   * 测试所有功能模块
   */
  testAllModules() {
    console.log('🧪 开始测试所有功能模块...');
    
    // 测试DOM管理器
    console.log('DOM元素:', Object.keys(DOMManager.elements));
    
    // 测试状态管理
    console.log('应用状态:', AppState.getState());
    
    // 测试Toast通知
    UIManager.showToast('这是一个测试通知', 'info');
    
    console.log('✅ 功能模块测试完成');
  }
};

// =============================================================================
// 应用启动
// =============================================================================

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  
  // 设置返回按钮功能
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.addEventListener('click', (e) => {
      e.preventDefault();
      window.close();
    });
  }
  
  // 开发环境下启用调试模式
  if (window.location.hostname === 'localhost' || window.location.protocol === 'chrome-extension:') {
    DebugManager.enableDebugMode();
  }
});

// 导出到全局作用域以便调试
window.CursorClient2Login = {
  App,
  AppState,
  AccountManager,
  UIManager,
  ErrorHandler,
  JWTDecoder,
  DebugManager
};
