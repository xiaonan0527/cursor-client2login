# 🔍 Chrome原生消息传递权限检查指南

## 📋 概述

本指南提供了检查Chrome扩展原生消息传递权限的详细方法，帮助诊断和解决连接问题。

## 🎯 检查方法

### 方法1: 使用专用检查工具 ⭐ 推荐

使用项目提供的专用检查工具：

```bash
# 在Chrome中打开检查工具
open check_chrome_permissions.html
```

**功能特性**:
- ✅ 自动检查所有关键权限
- ✅ 测试原生主机连接
- ✅ 获取详细的扩展信息
- ✅ 提供具体的错误诊断

### 方法2: Chrome开发者工具检查

#### 2.1 打开扩展管理页面
```
chrome://extensions/
```

#### 2.2 检查扩展详情
1. 找到"Cursor Client2Login"扩展
2. 点击"详细信息"
3. 检查以下信息：
   - **扩展ID**: 记录下来备用
   - **权限**: 确认包含"与本机应用通信"
   - **状态**: 确认已启用

#### 2.3 查看扩展控制台
1. 点击"背景页"或"Service Worker"
2. 在控制台中运行权限检查：

```javascript
// 检查权限
chrome.permissions.getAll().then(permissions => {
  console.log('当前权限:', permissions);
  console.log('是否有原生消息权限:', permissions.permissions.includes('nativeMessaging'));
});

// 测试原生主机连接
chrome.runtime.sendNativeMessage(
  'com.cursor.client.manage',
  {action: 'test'},
  (response) => {
    if (chrome.runtime.lastError) {
      console.error('连接失败:', chrome.runtime.lastError.message);
    } else {
      console.log('连接成功:', response);
    }
  }
);
```

### 方法3: 系统级检查

#### 3.1 检查原生主机配置

```bash
# 检查配置文件是否存在
ls -la ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/

# 查看配置内容
cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.cursor.client.manage.json

# 检查脚本权限
ls -la ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/native_host.py
```

#### 3.2 验证Python脚本

```bash
# 检查Python路径
head -1 ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/native_host.py

# 测试脚本执行
python3 install_native_host.py test
```

## 🔧 常见权限问题及解决方案

### 问题1: "nativeMessaging权限缺失"

**症状**: 扩展无法调用`chrome.runtime.sendNativeMessage`

**解决方案**:
1. 检查`manifest.json`中是否包含`"nativeMessaging"`权限
2. 重新加载扩展
3. 如果问题持续，重新安装扩展

### 问题2: "原生主机未找到"

**症状**: `chrome.runtime.lastError.message`显示"Specified native messaging host not found"

**解决方案**:
```bash
# 重新安装原生主机
python3 install_native_host.py

# 更新扩展ID配置
python3 update_native_host.py <你的扩展ID>
```

### 问题3: "原生主机启动失败"

**症状**: "Failed to start native messaging host"

**解决方案**:
```bash
# 检查Python路径
head -1 ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/native_host.py

# 如果路径错误，修复它
python3 fix_native_host.py --fix

# 重新安装
python3 install_native_host.py
```

### 问题4: "扩展ID不匹配"

**症状**: 连接被拒绝，但配置看起来正确

**解决方案**:
```bash
# 获取正确的扩展ID
echo "请在chrome://extensions/中找到扩展ID"

# 更新配置
python3 update_native_host.py <正确的扩展ID>
```

## 📊 权限检查清单

使用以下清单逐项检查：

### ✅ 基础检查
- [ ] Chrome扩展已安装并启用
- [ ] 扩展具有"nativeMessaging"权限
- [ ] 能获取到扩展ID

### ✅ 原生主机检查
- [ ] `com.cursor.client.manage.json`文件存在
- [ ] `native_host.py`文件存在且可执行
- [ ] Python shebang路径正确
- [ ] 扩展ID配置正确

### ✅ 连接测试
- [ ] `chrome.runtime.sendNativeMessage`可调用
- [ ] 原生主机响应正常
- [ ] 无连接错误信息

### ✅ 环境检查
- [ ] Chrome版本 >= 88
- [ ] Python 3.x 可用
- [ ] 系统权限正常

## 🛠️ 调试工具

### 1. 专用权限检查工具
```bash
# 打开权限检查工具
open check_chrome_permissions.html
```

### 2. 原生主机调试工具  
```bash
# 打开原生主机调试工具
open debug_native_host.html
```

### 3. 命令行诊断工具
```bash
# 运行完整诊断
python3 fix_native_host.py

# 仅检查配置
python3 fix_native_host.py --check
```

## 🚨 紧急故障排除

如果所有方法都失败，请按以下步骤操作：

### 1. 完全重置
```bash
# 删除现有配置
rm -rf ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.cursor.client.manage.json
rm -rf ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/native_host.py

# 重新安装
python3 install_native_host.py

# 更新扩展ID
python3 update_native_host.py <扩展ID>
```

### 2. 重启所有服务
```bash
# 完全退出Chrome
killall "Google Chrome" 2>/dev/null

# 重新启动Chrome
open -a "Google Chrome"
```

### 3. 检查系统日志
```bash
# 查看Chrome日志 (如果可用)
tail -f ~/Library/Application\ Support/Google/Chrome/chrome_debug.log
```

## 📞 获取帮助

如果问题仍然存在：

1. **收集诊断信息**:
   ```bash
   python3 fix_native_host.py > diagnostic_report.txt
   ```

2. **查看详细日志**:
   - Chrome扩展控制台错误
   - 系统控制台输出
   - 原生主机响应信息

3. **参考文档**:
   - `docs/troubleshooting/` 目录
   - `PATH_AUDIT_REPORT.md`
   - `PYTHON_SCRIPTS_SUMMARY.md`

## 🎉 成功标志

权限配置正确时，您应该看到：

- ✅ 扩展控制台无错误信息
- ✅ 原生主机连接测试成功
- ✅ "自动读取Cursor数据"功能正常工作
- ✅ 账户切换功能可用

---

**💡 提示**: 建议先使用`check_chrome_permissions.html`工具进行自动化检查，它能快速识别大部分权限问题！
