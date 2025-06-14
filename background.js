// 原生消息主机配置
const NATIVE_HOST_NAME = 'com.cursor.client.manage';

// 安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('Cursor Client2Login 插件已安装');
});

// 消息处理器映射
const messageHandlers = {
  'getCursorData': getCursorAuthData,
  'autoReadCursorData': autoReadCursorData,
  'saveToLocalStorage': (data) => saveToLocalStorage(data),
  'setCookie': (data) => setCursorCookie(data),
  'clearCookie': clearCursorCookie,
  'openDashboard': openCursorDashboard,
  'getCurrentCookieStatus': getCurrentCookieStatus,
  'validateCurrentAccountStatus': validateCurrentAccountStatus,
  'getDeepToken': (data) => getDeepToken(data),
  'pollDeepToken': (data) => pollDeepToken(data),
  'getAccountList': () => chrome.storage.local.get(['accountList']).then(result => ({ accountList: result.accountList || [] })),
  'getCurrentAccount': () => chrome.storage.local.get(['currentAccount']).then(result => ({ currentAccount: result.currentAccount || null })),
  'switchAccount': (data) => switchAccount(data),
  'parseFileContent': (data) => parseFileContent(data.content, data.fileType)
};

// 统一的消息处理器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = messageHandlers[request.action];

  if (handler) {
    const result = handler(request.data);

    // 如果返回Promise，等待结果
    if (result && typeof result.then === 'function') {
      result.then(sendResponse).catch(error => {
        console.error(`处理${request.action}时发生错误:`, error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // 保持消息通道开启
    } else {
      // 同步结果直接返回
      sendResponse(result);
    }
  } else {
    console.warn('未知的消息类型:', request.action);
    sendResponse({ success: false, error: '未知的消息类型' });
  }
});

// 自动读取Cursor认证数据
async function autoReadCursorData() {
  try {
    console.log('开始尝试自动读取Cursor数据...');
    
    // 方法1: 尝试使用原生消息传递
    try {
      console.log('尝试连接原生主机:', NATIVE_HOST_NAME);
              const nativeResult = await sendNativeMessage({ action: 'getClientCurrentData' });
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
              '1. 确保已运行 python3 install_native_host.py',
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
    console.log('💾 开始保存账户数据到Storage并更新Cookie...', {
      email: data.email,
      userid: data.userid,
      tokenType: data.tokenType || 'client',
      accessTokenLength: data.accessToken ? data.accessToken.length : 0
    });

    // 获取现有的账户列表
    const result = await chrome.storage.local.get(['accountList']);
    let accountList = result.accountList || [];
    
    // 检查是否已存在相同email的账户
    const existingIndex = accountList.findIndex(account => account.email === data.email);
    
    if (existingIndex >= 0) {
      // 更新现有账户
      console.log('🔄 更新现有账户:', data.email);
      accountList[existingIndex] = data;
    } else {
      // 添加新账户
      console.log('➕ 添加新账户:', data.email);
      accountList.push(data);
    }
    
    // 保存到chrome.storage
    await chrome.storage.local.set({ 
      accountList: accountList,
      currentAccount: data
    });
    console.log('✅ 账户数据已保存到Storage');

    // 统一在这里设置Cookie，确保Storage和Cookie同步
    console.log('🍪 开始统一设置Cookie...');
    const cookieResult = await setCursorCookie({
      userid: data.userid,
      accessToken: data.accessToken
    });

    if (!cookieResult.success) {
      console.warn('⚠️ Cookie设置失败，但Storage已保存:', cookieResult.error);
      return { 
        success: true, 
        message: '账户信息已保存到本地存储，但Cookie设置失败',
        cookieError: cookieResult.error
      };
    }

    console.log('✅ 账户数据和Cookie已同步更新');
    return { 
      success: true, 
      message: '账户信息已保存到本地存储并更新Cookie',
      cookieSet: true
    };
    
  } catch (error) {
    console.error('❌ 保存账户数据失败:', error);
    return { success: false, error: error.message };
  }
}

// 设置Cookie
async function setCursorCookie(data) {
  try {
    const { userid, accessToken } = data;
    const cookieValue = `${userid}%3A%3A${accessToken}`;
    
    console.log('🍪 开始设置Cursor Cookie...', {
      userid: userid,
      accessTokenLength: accessToken ? accessToken.length : 0,
      cookieValueLength: cookieValue.length
    });
    
    // 先尝试删除现有的Cookie，确保强制覆盖
    try {
      await chrome.cookies.remove({
        url: 'https://www.cursor.com',
        name: 'WorkosCursorSessionToken'
      });
      console.log('🗑️ 已删除现有Cookie，准备设置新Cookie');
    } catch (removeError) {
      console.log('⚠️ 删除现有Cookie时出错（可能不存在）:', removeError.message);
    }
    
    // 等待一下确保删除操作完成
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 设置新的Cookie
    const cookieParams = {
      url: 'https://www.cursor.com',
      name: 'WorkosCursorSessionToken',
      value: cookieValue,
      domain: '.cursor.com',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'lax'
    };
    
    console.log('🍪 设置Cookie参数:', {
      name: cookieParams.name,
      domain: cookieParams.domain,
      path: cookieParams.path,
      valueLength: cookieParams.value.length,
      secure: cookieParams.secure,
      sameSite: cookieParams.sameSite
    });
    
    await chrome.cookies.set(cookieParams);
    
    console.log('✅ Cookie设置操作完成');
    
    // 验证Cookie是否设置成功
    const verificationCookies = await chrome.cookies.getAll({
      url: 'https://www.cursor.com',
      name: 'WorkosCursorSessionToken'
    });
    
    if (verificationCookies.length > 0) {
      const verifiedCookie = verificationCookies[0];
      console.log('✅ Cookie设置验证成功:', {
        name: verifiedCookie.name,
        domain: verifiedCookie.domain,
        valueLength: verifiedCookie.value ? verifiedCookie.value.length : 0,
        secure: verifiedCookie.secure
      });
      
      // 检查Cookie值是否正确
      if (verifiedCookie.value === cookieValue) {
        console.log('✅ Cookie值完全匹配');
        return { success: true, message: 'Cookie已设置成功并验证' };
      } else {
        console.warn('⚠️ Cookie值不匹配', {
          expected: cookieValue.substring(0, 50) + '...',
          actual: verifiedCookie.value ? verifiedCookie.value.substring(0, 50) + '...' : 'null'
        });
        return { success: true, message: 'Cookie已设置但值可能不匹配' };
      }
    } else {
      console.warn('⚠️ Cookie设置后验证失败：未找到Cookie');
      return { success: false, error: 'Cookie设置后验证失败' };
    }
    
  } catch (error) {
    console.error('❌ 设置Cookie时发生错误:', error);
    return { success: false, error: error.message };
  }
}

// 清除Cookie
async function clearCursorCookie() {
  try {
    console.log('🍪 开始彻底清除Cursor认证Cookie...');
    
    // 多种方式清除特定的Cookie，确保彻底删除
    const removeTargets = [
      { url: 'https://www.cursor.com', name: 'WorkosCursorSessionToken' },
      { url: 'https://cursor.com', name: 'WorkosCursorSessionToken' },
      { url: 'http://www.cursor.com', name: 'WorkosCursorSessionToken' },
      { url: 'http://cursor.com', name: 'WorkosCursorSessionToken' }
    ];
    
    for (const target of removeTargets) {
      try {
        await chrome.cookies.remove(target);
        console.log(`🗑️ 尝试清除Cookie: ${target.url} - ${target.name}`);
      } catch (err) {
        console.log(`⚠️ 清除Cookie失败 (${target.url}):`, err.message);
      }
    }
    
    // 查找并清除所有可能的cursor相关cookie
    const allDomains = ['.cursor.com', 'cursor.com', 'www.cursor.com'];
    
    for (const domain of allDomains) {
      try {
        const allCookies = await chrome.cookies.getAll({ domain });
        console.log(`🔍 在域名 ${domain} 找到的Cookies:`, allCookies.length);
        
        for (const cookie of allCookies) {
          if (cookie.name.toLowerCase().includes('session') || 
              cookie.name.toLowerCase().includes('auth') ||
              cookie.name.toLowerCase().includes('token') ||
              cookie.name === 'WorkosCursorSessionToken') {
            try {
              // 尝试多种URL格式来删除Cookie
              const urlsToTry = [
                `https://${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}`,
                `https://${cookie.domain}`,
                `http://${cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain}`,
                `http://${cookie.domain}`
              ];
              
              for (const url of urlsToTry) {
                try {
                  await chrome.cookies.remove({
                    url: url,
                    name: cookie.name
                  });
                  console.log(`✅ 成功清除Cookie: ${cookie.name} (${url})`);
                  break; // 如果成功了就跳出循环
                } catch (removeErr) {
                  console.log(`⚠️ 尝试删除失败 ${cookie.name} (${url}):`, removeErr.message);
                }
              }
            } catch (err) {
              console.warn(`⚠️ 清除Cookie失败: ${cookie.name}`, err);
            }
          }
        }
      } catch (domainErr) {
        console.log(`⚠️ 查询域名 ${domain} 的Cookie失败:`, domainErr.message);
      }
    }
    
    // 等待一下确保删除操作完成
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 验证清除结果
    const remainingCookies = await chrome.cookies.getAll({
      name: 'WorkosCursorSessionToken'
    });
    
    if (remainingCookies.length === 0) {
      console.log('✅ 所有WorkosCursorSessionToken Cookie已彻底清除');
      return { success: true, message: 'Cursor认证Cookie已彻底清除' };
    } else {
      console.warn('⚠️ 仍有Cookie未清除:', remainingCookies.map(c => ({ name: c.name, domain: c.domain })));
      return { success: true, message: `Cursor认证Cookie已部分清除，仍有${remainingCookies.length}个Cookie残留` };
    }
    
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

// 注意：消息处理已在上面的统一处理器中合并，此处删除重复代码

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

// 获取当前Cookie状态
async function getCurrentCookieStatus() {
  try {
    console.log('🍪 开始检查当前Cookie状态...');
    
    // 方法1: 使用URL查询
    let cookies = await chrome.cookies.getAll({
      url: 'https://www.cursor.com',
      name: 'WorkosCursorSessionToken'
    });
    
    console.log('🔍 方法1 - URL查询结果:', cookies.length);
    
    // 方法2: 如果没找到，尝试仅使用name查询
    if (cookies.length === 0) {
      console.log('🔍 尝试方法2 - 仅使用name查询...');
      cookies = await chrome.cookies.getAll({
        name: 'WorkosCursorSessionToken'
      });
      console.log('🔍 方法2查询结果:', cookies.length);
    }
    
    // 方法3: 如果还没找到，查询所有cursor.com域名的Cookie
    if (cookies.length === 0) {
      console.log('🔍 尝试方法3 - 查询所有cursor域名Cookie...');
      const allCursorCookies = await chrome.cookies.getAll({
        domain: '.cursor.com'
      });
      console.log('🔍 所有cursor Cookie:', allCursorCookies.map(c => c.name));
      cookies = allCursorCookies.filter(cookie => 
        cookie.name === 'WorkosCursorSessionToken'
      );
      console.log('🔍 方法3过滤结果:', cookies.length);
    }
    
    // 方法4: 尝试不同的域名格式
    if (cookies.length === 0) {
      console.log('🔍 尝试方法4 - 使用cursor.com域名查询...');
      const cursorCookies = await chrome.cookies.getAll({
        domain: 'cursor.com'
      });
      console.log('🔍 cursor.com域名Cookie:', cursorCookies.map(c => c.name));
      cookies = cursorCookies.filter(cookie => 
        cookie.name === 'WorkosCursorSessionToken'
      );
      console.log('🔍 方法4过滤结果:', cookies.length);
    }
    
    console.log('🔍 最终查找Cookie结果:', {
      找到的Cookie数量: cookies.length,
      cookies: cookies.map(c => ({
        name: c.name,
        domain: c.domain,
        path: c.path,
        valueLength: c.value ? c.value.length : 0
      }))
    });
    
    if (cookies.length === 0) {
      console.log('❌ 未找到WorkosCursorSessionToken Cookie');
      
      // 获取所有可能相关的Cookie用于调试
      const allCookies = await chrome.cookies.getAll({});
      const relevantCookies = allCookies.filter(cookie => 
        cookie.domain.includes('cursor') || 
        cookie.name.toLowerCase().includes('session') ||
        cookie.name.toLowerCase().includes('token')
      );
      
      return { 
        success: true, 
        hasCookie: false,
        message: '当前无认证Cookie',
        debugInfo: {
          查询方法: '尝试了4种不同的查询方式',
          相关Cookie: relevantCookies.map(c => ({
            name: c.name,
            domain: c.domain,
            path: c.path
          }))
        }
      };
    }
    
    const cookie = cookies[0];
    console.log('🍪 找到Cookie详情:', {
      name: cookie.name,
      value: cookie.value ? cookie.value.substring(0, 50) + '...' : 'null',
      valueLength: cookie.value ? cookie.value.length : 0,
      domain: cookie.domain,
      path: cookie.path,
      expirationDate: cookie.expirationDate,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly
    });
    
    // 解析Cookie值
    if (!cookie.value) {
      return {
        success: true,
        hasCookie: true,
        cookieData: null,
        message: 'Cookie值为空',
        debugInfo: {
          cookie: cookie
        }
      };
    }
    
    // 格式检查：userid%3A%3AaccessToken
    if (cookie.value.includes('%3A%3A')) {
      const parts = cookie.value.split('%3A%3A');
      console.log('🔍 Cookie分割结果:', {
        原始值长度: cookie.value.length,
        分割后部分数量: parts.length,
        第一部分长度: parts[0] ? parts[0].length : 0,
        第二部分长度: parts[1] ? parts[1].length : 0
      });
      
      if (parts.length === 2 && parts[0] && parts[1]) {
        const userid = parts[0];
        const accessToken = parts[1];
        
        // 检查Cookie是否过期
        const isExpired = cookie.expirationDate && cookie.expirationDate * 1000 < Date.now();
        
        console.log('✅ Cookie解析成功:', {
          userid: userid,
          accessTokenLength: accessToken.length,
          isExpired: isExpired,
          expirationDate: cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toISOString() : 'undefined'
        });
        
        return {
          success: true,
          hasCookie: true,
          cookieData: {
            userid: userid,
            accessToken: accessToken,
            expirationDate: cookie.expirationDate,
            isExpired: isExpired,
            domain: cookie.domain,
            path: cookie.path
          },
          message: isExpired ? 'Cookie已过期' : 'Cookie有效',
          debugInfo: {
            原始Cookie值: cookie.value,
            解析结果: { userid, accessTokenLength: accessToken.length }
          }
        };
      }
    }
    
    console.log('⚠️ Cookie格式无法解析:', {
      value: cookie.value,
      包含分隔符: cookie.value.includes('%3A%3A'),
      valueType: typeof cookie.value
    });
    
    return {
      success: true,
      hasCookie: true,
      cookieData: null,
      message: 'Cookie格式无法解析',
      debugInfo: {
        原始Cookie值: cookie.value,
        格式检查: {
          包含分隔符: cookie.value.includes('%3A%3A'),
          值类型: typeof cookie.value,
          值内容: cookie.value
        }
      }
    };
    
  } catch (error) {
    console.error('❌ 检查Cookie状态时发生错误:', error);
    return { 
      success: false, 
      error: error.message,
      debugInfo: {
        错误类型: error.name,
        错误消息: error.message,
        错误堆栈: error.stack
      }
    };
  }
}

// 获取深度Token
async function getDeepToken(params = {}) {
  try {
    console.log('开始获取深度Token...', params);

    /*
    ========================================
    无头模式逻辑 - 暂时注释掉
    ========================================
    原因：原生主机的无头模式实现存在问题，需要完善后再启用
    恢复方法：取消下面的注释，并确保 native_host.py 中的相关方法正常工作
    注意：目前只支持浏览器模式(deep_browser)，无头模式(deep_headless)暂时禁用
    ========================================
    */

    // 检查模式，暂时只支持浏览器模式
    const mode = params.mode || 'deep_browser';
    if (mode === 'deep_headless') {
      console.warn('⚠️ 无头模式暂时禁用，自动切换到浏览器模式');
      params.mode = 'deep_browser';
    }

    const message = {
      action: 'getClientCurrentData',
      params: {
        mode: params.mode || 'deep_browser'  // 默认使用浏览器模式
      }
    };

    const nativeResult = await sendNativeMessage(message);
    console.log('深度Token原生主机响应:', nativeResult);

    if (nativeResult && !nativeResult.error) {
      console.log('深度Token获取成功');
      return {
        success: true,
        data: nativeResult,
        method: 'native'
      };
    } else {
      console.log('深度Token原生主机返回错误:', nativeResult?.error);
      return {
        success: false,
        error: `深度Token获取失败: ${nativeResult?.error || '未知错误'}`,
        needFileSelection: true
      };
    }
  } catch (error) {
    console.error('getDeepToken error:', error);
    return {
      success: false,
      error: `深度Token获取失败: ${error.message}`,
      needFileSelection: true
    };
  }
}

// 验证当前账户状态（对比storage和cookie）
async function validateCurrentAccountStatus() {
  try {
    console.log('🔍 开始验证当前账户状态...');
    
    // 获取storage中的当前账户
    const storageResult = await chrome.storage.local.get(['currentAccount']);
    const storageAccount = storageResult.currentAccount;
    
    // 获取Cookie中的当前账户
    const cookieResult = await getCurrentCookieStatus();
    
    let status = {
      isConsistent: false,
      storageAccount: storageAccount,
      cookieStatus: cookieResult,
      recommendation: ''
    };
    
    if (!storageAccount) {
      // storage中没有当前账户
      if (cookieResult.hasCookie && cookieResult.cookieData) {
        status.recommendation = 'Cookie存在但storage中无当前账户，建议重新选择账户';
      } else {
        status.recommendation = '无当前账户，请先导入并选择账户';
      }
    } else if (!cookieResult.hasCookie || !cookieResult.cookieData) {
      // storage有账户但cookie无效
      status.recommendation = 'storage中有账户但Cookie无效，建议重新切换到该账户';
    } else if (cookieResult.cookieData.isExpired) {
      // Cookie已过期
      status.recommendation = 'Cookie已过期，建议重新切换到该账户';
    } else {
      // 对比storage和cookie中的账户信息
      const storageUserid = storageAccount.userid;
      const cookieUserid = cookieResult.cookieData.userid;
      
      if (storageUserid === cookieUserid) {
        status.isConsistent = true;
        status.recommendation = '当前账户状态正常';
      } else {
        status.recommendation = 'storage和Cookie中的账户不一致，建议重新切换账户';
      }
    }
    
    console.log('✅ 账户状态验证完成:', status);
    return { success: true, status: status };
    
  } catch (error) {
    console.error('❌ 验证账户状态时发生错误:', error);
    return { success: false, error: error.message };
  }
}

// 轮询深度Token（在background中处理，避免CORS问题）
async function pollDeepToken(params) {
  const { uuid, verifier, maxAttempts = 30, pollInterval = 2000 } = params;
  
  console.log('🔄 Background开始轮询深度Token...', { uuid: uuid.substring(0, 8) + '...', maxAttempts });
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 Background轮询尝试 ${attempt}/${maxAttempts}...`);
      
      const pollUrl = `https://api2.cursor.sh/auth/poll?uuid=${uuid}&verifier=${verifier}`;
      
      const response = await fetch(pollUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "*/*",
          "Referer": "https://www.cursor.com/"
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📥 Background轮询响应:', data);
        
        const deepAccessToken = data.accessToken;
        const authId = data.authId || '';

        if (deepAccessToken) {
          console.log('🎉 Background成功获取深度Token！');
          
          return {
            success: true,
            data: {
              accessToken: deepAccessToken,
              authId: authId
            }
          };
        }
      }
      
      // 如果还没有获取到Token，等待后继续
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
      
    } catch (error) {
      console.error(`❌ Background轮询第${attempt}次失败:`, error);
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
  }
  
  console.error('❌ Background轮询超时，未能获取到深度Token');
  return {
    success: false,
    error: '轮询超时，未能获取到深度Token'
  };
} 