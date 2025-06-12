// 原生消息主机配置
const NATIVE_HOST_NAME = 'com.cursor.auth.manager';

// 安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('Cursor Client2Login 插件已安装');
});

// 处理来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCursorData') {
    getCursorAuthData().then(sendResponse);
    return true; // 保持消息通道开启
  } else if (request.action === 'autoReadCursorData') {
    autoReadCursorData().then(sendResponse);
    return true;
  } else if (request.action === 'saveToLocalStorage') {
    saveToLocalStorage(request.data).then(sendResponse);
    return true;
  } else if (request.action === 'setCookie') {
    setCursorCookie(request.data).then(sendResponse);
    return true;
  } else if (request.action === 'clearCookie') {
    clearCursorCookie().then(sendResponse);
    return true;
  } else if (request.action === 'openDashboard') {
    openCursorDashboard().then(sendResponse);
    return true;
  }
});

// 自动读取Cursor认证数据
async function autoReadCursorData() {
  try {
    console.log('开始尝试自动读取Cursor数据...');
    
    // 方法1: 尝试使用原生消息传递
    try {
      console.log('尝试连接原生主机:', NATIVE_HOST_NAME);
      const nativeResult = await sendNativeMessage({ action: 'getAllData' });
      console.log('原生主机响应:', nativeResult);
      
      if (nativeResult && !nativeResult.error) {
        console.log('原生主机读取成功');
        return { 
          success: true, 
          data: nativeResult,
          method: 'native'
        };
      } else {
        console.log('原生主机返回错误:', nativeResult?.error);
        return {
          success: false,
          error: `原生主机错误: ${nativeResult?.error || '未知错误'}`,
          needFileSelection: true
        };
      }
    } catch (nativeError) {
      console.error('原生消息传递失败:', nativeError);
      
      // 提取详细错误信息
      let errorMessage = '原生主机连接失败';
      let errorDetails = '';
      let troubleshooting = [];
      
      try {
        // 尝试解析JSON格式的错误信息
        const errorInfo = JSON.parse(nativeError.message);
        errorMessage = errorInfo.message || errorMessage;
        errorDetails = errorInfo.originalError || '';
        troubleshooting = errorInfo.troubleshooting || [];
      } catch (parseError) {
        // 如果不是JSON格式，直接使用错误消息
        if (nativeError.message) {
          errorDetails = nativeError.message;
        } else if (typeof nativeError === 'object') {
          errorDetails = JSON.stringify(nativeError);
        } else {
          errorDetails = String(nativeError);
        }
        
        // 检查常见错误类型
        if (errorDetails.includes('not found') || errorDetails.includes('access denied')) {
          errorMessage = '原生主机未正确安装或权限不足';
        } else if (errorDetails.includes('Specified native messaging host not found')) {
          errorMessage = '找不到原生主机程序，请检查安装是否正确';
        } else if (errorDetails.includes('disconnected') || errorDetails.includes('connection')) {
          errorMessage = '原生主机连接中断，请重启Chrome浏览器';
        }
      }
      
      console.log('错误详情:', errorDetails);
      console.log('故障排除建议:', troubleshooting);
      
      return {
        success: false,
        error: errorMessage,
        details: errorDetails,
        troubleshooting: troubleshooting,
        needFileSelection: true
      };
    }
    
  } catch (error) {
    console.error('autoReadCursorData error:', error);
    return { 
      success: false, 
      error: `自动读取失败: ${error.message}`,
      needFileSelection: true
    };
  }
}

// 发送原生消息
function sendNativeMessage(message) {
  return new Promise((resolve, reject) => {
    console.log('发送原生消息:', message);
    
    // 检查原生消息传递权限
    if (!chrome.runtime.sendNativeMessage) {
      reject(new Error('原生消息传递API不可用，请检查插件权限'));
      return;
    }
    
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, (response) => {
        const lastError = chrome.runtime.lastError;
        
        if (lastError) {
          console.error('原生消息错误对象:', lastError);
          console.error('错误消息:', lastError.message);
          
          // 创建详细的错误信息
          let errorMessage = lastError.message || '未知错误';
          
          // 检查常见错误类型并提供更好的错误信息
          if (errorMessage.includes('Specified native messaging host not found')) {
            errorMessage = `原生主机未找到 (${NATIVE_HOST_NAME})。请确保已正确安装原生主机程序。`;
          } else if (errorMessage.includes('Access denied')) {
            errorMessage = '访问被拒绝。请检查原生主机程序的权限设置。';
          } else if (errorMessage.includes('Invalid native messaging host name')) {
            errorMessage = `无效的原生主机名称: ${NATIVE_HOST_NAME}`;
          }
          
          const errorInfo = {
            message: errorMessage,
            originalError: lastError.message,
            hostName: NATIVE_HOST_NAME,
            timestamp: new Date().toISOString(),
            troubleshooting: [
              '1. 确保已运行 python3 install-native-host.py',
              '2. 重启 Chrome 浏览器',
              '3. 检查原生主机配置文件是否存在',
              '4. 尝试使用具体扩展ID更新配置'
            ]
          };
          
          reject(new Error(JSON.stringify(errorInfo, null, 2)));
        } else {
          console.log('原生消息响应:', response);
          resolve(response);
        }
      });
    } catch (syncError) {
      console.error('同步错误:', syncError);
      reject(new Error(`同步调用失败: ${syncError.message}`));
    }
  });
}

// 处理文件内容解析
async function parseFileContent(fileContent, fileType) {
  try {
    if (fileType === 'database') {
      // 这里应该解析SQLite数据库，但浏览器环境限制较大
      // 我们提供一个替代方案：让用户导出数据
      return {
        success: false,
        error: '浏览器无法直接解析SQLite数据库，请使用原生主机或手动导入'
      };
    } else if (fileType === 'json') {
      // 解析scope_v3.json
      const content = fileContent.replace(/%$/, '').trim();
      const data = JSON.parse(content);
      
      const userInfo = data.scope?.user || {};
      const email = userInfo.email;
      const userIdFull = userInfo.id;
      
      if (email && userIdFull && userIdFull.includes('|')) {
        const userid = userIdFull.split('|')[1];
        return {
          success: true,
          data: { email, userid }
        };
      } else {
        return {
          success: false,
          error: '无法从JSON文件中提取有效的email或userid'
        };
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `文件解析失败: ${error.message}`
    };
  }
}

// 获取Cursor认证数据
async function getCursorAuthData() {
  try {
    // 首先尝试从localStorage中获取已保存的数据
    const savedData = await chrome.storage.local.get(['cursorAuthData']);
    if (savedData.cursorAuthData) {
      return { success: true, data: savedData.cursorAuthData };
    }
    
    // 如果没有保存的数据，需要用户手动提供
    return { 
      success: false, 
      error: '需要用户手动导入Cursor认证数据',
      needManualImport: true
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 保存到localStorage
async function saveToLocalStorage(data) {
  try {
    // 获取现有的账户列表
    const result = await chrome.storage.local.get(['accountList']);
    let accountList = result.accountList || [];
    
    // 检查是否已存在相同email的账户
    const existingIndex = accountList.findIndex(account => account.email === data.email);
    
    if (existingIndex >= 0) {
      // 更新现有账户
      accountList[existingIndex] = data;
    } else {
      // 添加新账户
      accountList.push(data);
    }
    
    // 保存到chrome.storage
    await chrome.storage.local.set({ 
      accountList: accountList,
      currentAccount: data
    });
    
    return { success: true, message: '账户信息已保存到本地存储' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 设置Cookie
async function setCursorCookie(data) {
  try {
    const { userid, accessToken } = data;
    const cookieValue = `${userid}%3A%3A${accessToken}`;
    
    // 设置Cookie
    await chrome.cookies.set({
      url: 'https://www.cursor.com',
      name: 'WorkosCursorSessionToken',
      value: cookieValue,
      domain: '.cursor.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'lax'
    });
    
    return { success: true, message: 'Cookie已设置成功' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 清除Cookie
async function clearCursorCookie() {
  try {
    console.log('🍪 开始清除Cursor认证Cookie...');
    
    // 清除特定的Cookie
    await chrome.cookies.remove({
      url: 'https://www.cursor.com',
      name: 'WorkosCursorSessionToken'
    });
    
    console.log('✅ WorkosCursorSessionToken Cookie已清除');
    
    // 也尝试清除其他可能的cursor相关cookie
    const allCookies = await chrome.cookies.getAll({
      domain: '.cursor.com'
    });
    
    console.log('🔍 找到的cursor.com相关Cookies:', allCookies.length);
    
    for (const cookie of allCookies) {
      if (cookie.name.toLowerCase().includes('session') || 
          cookie.name.toLowerCase().includes('auth') ||
          cookie.name.toLowerCase().includes('token')) {
        try {
          await chrome.cookies.remove({
            url: `https://${cookie.domain}`,
            name: cookie.name
          });
          console.log(`✅ 已清除Cookie: ${cookie.name}`);
        } catch (err) {
          console.warn(`⚠️ 清除Cookie失败: ${cookie.name}`, err);
        }
      }
    }
    
    return { success: true, message: 'Cursor认证Cookie已清除' };
  } catch (error) {
    console.error('❌ 清除Cookie时发生错误:', error);
    return { success: false, error: error.message };
  }
}

// 打开Cursor Dashboard
async function openCursorDashboard() {
  try {
    await chrome.tabs.create({
      url: 'https://www.cursor.com/cn/dashboard',
      active: true
    });
    
    return { success: true, message: 'Dashboard页面已打开' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 处理从content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAccountList') {
    chrome.storage.local.get(['accountList']).then(result => {
      sendResponse({ accountList: result.accountList || [] });
    });
    return true;
  } else if (request.action === 'getCurrentAccount') {
    chrome.storage.local.get(['currentAccount']).then(result => {
      sendResponse({ currentAccount: result.currentAccount || null });
    });
    return true;
  } else if (request.action === 'switchAccount') {
    switchAccount(request.accountData).then(sendResponse);
    return true;
  } else if (request.action === 'parseFileContent') {
    parseFileContent(request.content, request.fileType).then(sendResponse);
    return true;
  }
});

// 切换账户
async function switchAccount(accountData) {
  try {
    // 提取accessToken，支持两种格式
    let accessToken;
    if (accountData.accessToken) {
      accessToken = accountData.accessToken;
    } else if (accountData.WorkosCursorSessionToken && accountData.WorkosCursorSessionToken.includes('%3A%3A')) {
      accessToken = accountData.WorkosCursorSessionToken.split('%3A%3A')[1];
    } else {
      throw new Error('无法找到有效的accessToken');
    }
    
    await setCursorCookie({
      userid: accountData.userid,
      accessToken: accessToken
    });
    
    await chrome.storage.local.set({ currentAccount: accountData });
    
    return { success: true, message: '账户切换成功' };
  } catch (error) {
    return { success: false, error: error.message };
  }
} 