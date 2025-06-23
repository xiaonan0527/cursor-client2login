# JWT解码器实现文档

## 概述

本次更新实现了在Chrome扩展中使用JavaScript原生JWT解码功能，替代了原来依赖原生主机的Token解析方式。现在可以直接从JWT Token中提取用户ID和过期时间信息。

## 主要修改

### 1. 添加JWT解码器模块

在 `background.js` 和 `popup.js` 中都添加了完整的JWT解码器：

```javascript
const JWTDecoder = {
  decodePayload(token),           // 解码JWT payload部分
  decodeBase64Part(part),         // Base64解码工具函数
  extractUserId(token),           // 从JWT中提取用户ID
  extractExpirationInfo(token),   // 从JWT中提取过期时间信息
  parseToken(token)               // 完整解析JWT token
}
```

### 2. 修改用户ID获取逻辑

**之前**: 从JSON文件或手动输入获取用户ID
```javascript
const userid = userIdFull.split('|')[1];
```

**现在**: 从JWT Token的`sub`字段提取用户ID
```javascript
const jwtInfo = JWTDecoder.parseToken(accessToken);
if (jwtInfo && jwtInfo.userId) {
    userid = jwtInfo.userId;
}
```

### 3. 修改过期时间获取逻辑

**之前**: 使用固定的60天有效期或Cookie过期时间
```javascript
expiresTime: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
```

**现在**: 从JWT Token的`exp`字段获取真实过期时间
```javascript
if (jwtInfo && jwtInfo.expirationInfo) {
    expiresTime = jwtInfo.expirationInfo.expDate;
    validDays = jwtInfo.expirationInfo.remainingDays;
}
```

### 4. 更新的文件和函数

#### background.js
- 添加了完整的`JWTDecoder`模块
- 修改了`getCurrentCookieStatus()`函数，使用JWT解码获取用户ID和过期时间
- 增强了Cookie解析逻辑，支持JWT信息提取

#### popup.js
- 添加了完整的`JWTDecoder`模块
- 修改了`handleDeepTokenBrowserMode()`函数，使用JWT解码处理深度Token
- 修改了`processAccountData()`函数，在保存账户数据前进行JWT解码
- 更新了账户数据结构，包含JWT解码信息

## JWT解码结果格式

解码后的JWT信息包含以下字段：

```javascript
{
  userId: "user_0",     // 提取的用户ID
  sub: "auth0|user_0",  // 原始sub字段
  exp: 1755413694,                                // 过期时间戳
  expirationInfo: {
    expTimestamp: 1755413694,
    expDate: "2025-06-17T02:01:34.000Z",         // ISO格式过期时间
    isExpired: false,                             // 是否已过期
    remainingDays: 60                             // 剩余天数
  },
  fullPayload: { /* 完整的JWT payload */ }
}
```

## 兼容性处理

为了确保向后兼容，实现了以下降级机制：

1. **JWT解码失败时**: 回退到原有的用户ID提取方式
2. **过期时间获取失败时**: 使用Cookie过期时间或默认60天
3. **保留原始数据**: 在账户数据中同时保存原始用户ID和JWT解码的用户ID

## 测试

创建了 `test_jwt_decoder.html` 测试页面，可以：
- 测试JWT解码功能
- 验证用户ID提取
- 验证过期时间计算
- 查看完整的JWT payload

## 使用示例

### 在background.js中使用
```javascript
// 解析Cookie中的Token
const jwtInfo = JWTDecoder.parseToken(accessToken);
if (jwtInfo) {
    console.log('用户ID:', jwtInfo.userId);
    console.log('过期时间:', jwtInfo.expirationInfo.expDate);
    console.log('剩余天数:', jwtInfo.expirationInfo.remainingDays);
}
```

### 在popup.js中使用
```javascript
// 处理账户数据时自动解码
static async processAccountData(accountData) {
    if (accountData.accessToken) {
        const jwtInfo = JWTDecoder.parseToken(accountData.accessToken);
        if (jwtInfo) {
            accountData.userid = jwtInfo.userId;
            accountData.expiresTime = jwtInfo.expirationInfo.expDate;
            accountData.validDays = jwtInfo.expirationInfo.remainingDays;
        }
    }
    // ... 继续处理
}
```

## 优势

1. **准确性**: 直接从JWT Token获取真实的过期时间，不再依赖估算
2. **实时性**: 每次处理Token时都会重新解码，确保信息最新
3. **独立性**: 不再依赖原生主机进行JWT解析
4. **调试友好**: 保存完整的JWT解码信息，便于问题排查
5. **用户体验**: 显示准确的剩余天数和过期日期

## 注意事项

1. JWT解码仅在浏览器环境中进行，不涉及签名验证
2. 解码失败时会有完善的错误处理和降级机制
3. 所有JWT解码信息都会在控制台输出，便于调试
4. 账户数据结构保持向后兼容，新增字段不影响现有功能
