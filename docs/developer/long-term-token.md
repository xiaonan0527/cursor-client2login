# 🔐 长效Token管理功能

## 📋 功能概述

长效Token管理功能解决了客户端Token在客户端退出后失效的问题，通过获取真正的长效Token（60天有效期）来提供更稳定的认证体验。

## 🏗️ 架构设计

### 混合模式架构
```
客户端Token → background.js → 深度Token API → 长效Token → Chrome Storage
     ↓              ↓                ↓              ↓
popup.js ← 用户反馈 ← 进度显示 ← API调用状态 ← 保存结果
```

### 核心组件

#### 1. DeepTokenManager (background.js)
- **职责**: 无头模式API调用，获取长效Token
- **特性**: 完全后台执行，不受用户操作影响
- **错误处理**: 详细的错误分类和诊断

#### 2. TokenManager (popup.js)
- **职责**: Token状态管理和验证
- **功能**: 过期检查、自动刷新、类型识别

#### 3. DataImportManager (popup.js)
- **职责**: 集成长效Token获取到数据导入流程
- **特性**: 自动降级处理，用户友好反馈

## 🔄 工作流程

### 1. Token获取流程
```javascript
// 1. 用户导入账户数据
const accountData = {
    email: 'user@example.com',
    userid: 'user_01XXXXXXXXX',
    accessToken: 'client_token_here'
};

// 2. 尝试获取长效Token
const longTermResult = await MessageManager.sendMessage('getLongTermToken', {
    clientToken: accountData.accessToken,
    userInfo: { email: accountData.email, userid: accountData.userid }
});

// 3. 处理结果
if (longTermResult.success) {
    // 使用长效Token
    finalAccountData = {
        ...accountData,
        accessToken: longTermResult.longTermToken,
        tokenType: 'long_term',
        expiresAt: new Date(Date.now() + longTermResult.expiresIn * 1000).toISOString()
    };
} else {
    // 降级使用原始Token
    finalAccountData = {
        ...accountData,
        tokenType: 'client_token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
}
```

### 2. Token验证流程
```javascript
// 检查Token有效性
const isValid = await TokenManager.isTokenValid(accountData);
const isExpiringSoon = await TokenManager.isTokenExpiringSoon(accountData);

// 自动刷新Token
if (isExpiringSoon) {
    const refreshResult = await TokenManager.refreshTokenIfNeeded(accountData);
}
```

## 🎭 Mock API系统

### 开发模式检测
```javascript
const isDevMode = chrome.runtime.getManifest().name.includes('Dev') || 
                  chrome.runtime.getManifest().version.includes('dev');
```

### Mock响应配置
```javascript
class MockAPIServer {
    static responses = {
        success: {
            access_token: 'mock_long_term_token_' + Date.now(),
            token_type: 'Bearer',
            expires_in: 60 * 24 * 60 * 60, // 60天
            scope: 'long_term'
        },
        failure: {
            error: 'invalid_grant',
            error_description: 'The provided authorization grant is invalid'
        }
    };
}
```

### Mock模式控制
```javascript
// 设置Mock模式
await MessageManager.sendMessage('setMockMode', { mode: 'success' });
await MessageManager.sendMessage('setMockMode', { mode: 'failure' });
await MessageManager.sendMessage('setMockMode', { mode: 'network_error' });
```

## 🔧 调试工具

### 调试面板
```javascript
// 启用调试模式
enableDebugMode();

// 调试面板功能
- 测试Token API
- 模拟API成功/失败
- 检查Token状态
- 清除调试日志
```

### 调试命令
```javascript
// 全局调试函数
window.enableDebugMode();     // 启用调试模式
window.testTokenAPI();        // 测试Token API
window.checkTokenStatus();    // 检查Token状态
window.debugCookieStatus();   // 调试Cookie状态
```

## 📊 数据结构

### Token数据格式
```javascript
{
    "email": "user@example.com",
    "userid": "user_01XXXXXXXXX",
    "accessToken": "long_term_token_here",
    "tokenType": "long_term",           // 'long_term' | 'client_token'
    "createdAt": "2025-01-25T10:00:00Z",
    "expiresAt": "2025-03-26T10:00:00Z", // 60天后
    "originalToken": "client_token_here", // 原始客户端Token
    "WorkosCursorSessionToken": "userid%3A%3Atoken",
    "lastRefreshed": "2025-01-25T10:00:00Z" // 最后刷新时间
}
```

### API请求格式
```javascript
{
    "grant_type": "refresh_token",
    "refresh_token": "client_token",
    "scope": "long_term",
    "client_id": "cursor-client",
    "user_info": {
        "email": "user@example.com",
        "userid": "user_01XXXXXXXXX"
    }
}
```

## 🧪 测试指南

### 1. 开发环境测试
```bash
# 1. 使用开发版本manifest
cp manifest-dev.json manifest.json

# 2. 加载扩展到Chrome
# 在chrome://extensions/中加载

# 3. 启用调试模式
# 在popup中执行: enableDebugMode()

# 4. 运行测试
# 使用调试面板或全局函数测试
```

### 2. Mock API测试
```javascript
// 测试成功场景
setMockMode('success');
testTokenAPI();

// 测试失败场景
setMockMode('failure');
testTokenAPI();

// 测试网络错误
setMockMode('network_error');
testTokenAPI();
```

### 3. Token状态测试
```javascript
// 检查当前Token状态
checkTokenStatus();

// 模拟Token过期
const mockExpiredToken = {
    accessToken: 'expired_token',
    expiresAt: new Date(Date.now() - 1000).toISOString()
};
TokenManager.isTokenValid(mockExpiredToken); // false
```

## 🔍 故障排除

### 常见问题

#### 1. API调用失败
- **检查网络连接**
- **验证Token格式**
- **查看控制台错误日志**

#### 2. Mock模式不生效
- **确认使用开发版本manifest**
- **检查扩展名称是否包含'Dev'**
- **重新加载扩展**

#### 3. 调试面板不显示
- **确认已启用调试模式**
- **检查localStorage设置**
- **刷新popup页面**

### 调试检查清单
```javascript
// 1. 检查扩展环境
console.log('扩展名称:', chrome.runtime.getManifest().name);
console.log('是否开发模式:', isDevMode);

// 2. 检查调试状态
console.log('调试模式:', DebugManager.isDebugMode());

// 3. 检查Token状态
checkTokenStatus();

// 4. 检查API连通性
testTokenAPI();
```

## 📈 性能优化

### 1. 缓存策略
- Token状态缓存
- API响应缓存
- 减少重复请求

### 2. 异步处理
- 非阻塞API调用
- 后台Token刷新
- 用户操作响应优先

### 3. 错误恢复
- 自动重试机制
- 降级处理策略
- 用户友好提示

## 🔮 未来扩展

### 计划功能
- [ ] Token自动刷新
- [ ] 批量Token管理
- [ ] Token使用统计
- [ ] 安全审计日志

### 架构优化
- [ ] WebWorker支持
- [ ] 离线Token验证
- [ ] 加密存储
- [ ] 多环境配置
