# 🔧 原生主机连接失败解决方案

## 🚨 错误描述

```
[NativeHost] 原生主机连接失败 Error: Failed to start native messaging host.
```

这个错误表示Chrome扩展无法与原生主机程序建立连接。

## 🔍 问题诊断

我已经为您创建了一个专门的诊断工具，请按以下步骤进行：

### 1. 运行自动诊断工具
```bash
python3 fix_native_host.py
```

### 2. 如果诊断发现问题，运行自动修复
```bash
python3 fix_native_host.py --fix
```

### 3. 使用调试页面测试连接
在Chrome中打开：`chrome-extension://[扩展ID]/debug_native_host.html`

## 🎯 常见原因和解决方案

### 1. **扩展ID不匹配** ⭐ (最可能的原因)

**现象**: 原生主机配置文件中的扩展ID与当前扩展ID不符

**检查方法**:
```bash
# 查看配置文件中的扩展ID
cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.cursor.client.manage.json
```

**解决方案**:
1. 获取当前扩展ID:
   - 打开 `chrome://extensions/`
   - 找到 "Cursor Client2Login" 扩展
   - 复制扩展ID（32位字符串）

2. 更新配置:
```bash
python3 update_native_host.py [您的扩展ID]
```

3. 重启Chrome浏览器

### 2. **原生主机未安装**

**现象**: 配置文件或脚本不存在

**解决方案**:
```bash
python3 install_native_host.py install
```

### 3. **脚本权限问题**

**现象**: 脚本存在但无执行权限

**解决方案**:
```bash
chmod +x ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/native_host.py
```

### 4. **Python环境问题**

**现象**: 脚本无法正常运行

**测试方法**:
```bash
python3 native_host.py
```

**解决方案**:
- 确保Python 3.6+已安装
- 检查依赖包是否完整

### 5. **Chrome权限问题**

**现象**: 扩展无法使用原生消息API

**解决方案**:
1. 检查 `manifest.json` 中是否有 `nativeMessaging` 权限
2. 重新加载扩展
3. 完全重启Chrome

## 🔄 完整修复流程

### 步骤1: 自动诊断和修复
```bash
# 1. 诊断问题
python3 fix_native_host.py

# 2. 如果有问题，自动修复
python3 fix_native_host.py --fix

# 3. 测试原生主机功能
python3 install_native_host.py test
```

### 步骤2: 更新扩展ID
```bash
# 1. 获取扩展ID (在chrome://extensions/页面)
# 2. 更新配置
python3 update_native_host.py [您的扩展ID]
```

### 步骤3: 重启和测试
1. 完全关闭Chrome浏览器
2. 重新打开Chrome
3. 重新加载扩展
4. 测试自动读取功能

## 🧪 调试工具

### 1. 诊断工具
```bash
python3 fix_native_host.py           # 诊断问题
python3 fix_native_host.py --fix     # 自动修复
python3 fix_native_host.py --id-guide # 获取扩展ID指南
```

### 2. 网页调试工具
打开 `debug_native_host.html` 进行实时调试：
- 基础连接测试
- 获取客户端数据测试
- 实时错误日志
- 环境信息显示

### 3. 命令行测试
```bash
# 测试原生主机程序本身
python3 install_native_host.py test

# 手动测试脚本
echo '{"action": "testConnection"}' | python3 native_host.py
```

## 📊 验证修复成功

修复完成后，以下操作应该正常工作：

1. **扩展中的自动读取功能**
   - 点击 "🔍 自动读取Cursor数据" 按钮
   - 应该能成功读取并显示账户信息

2. **Chrome开发者工具无错误**
   - 按F12打开开发者工具
   - Console中不应该有原生主机相关错误

3. **调试页面测试通过**
   - 基础连接测试成功
   - 获取客户端数据成功

## 🆘 如果仍然失败

如果按照以上步骤仍然无法解决，请提供以下信息：

1. **运行诊断工具的完整输出**:
```bash
python3 fix_native_host.py > debug_output.txt 2>&1
```

2. **扩展信息**:
   - 当前扩展ID
   - Chrome版本
   - 操作系统版本

3. **错误日志**:
   - Chrome开发者工具Console的错误信息
   - 调试页面的测试结果

4. **配置文件内容**:
```bash
cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.cursor.client.manage.json
```

## 📋 预防措施

为避免将来出现类似问题：

1. **扩展更新后**:
   - 如果重新安装扩展，扩展ID可能会改变
   - 需要重新运行 `python3 update_native_host.py [新扩展ID]`

2. **Chrome更新后**:
   - 重启Chrome浏览器
   - 测试原生主机功能是否正常

3. **系统更新后**:
   - 检查Python环境是否正常
   - 重新测试原生主机程序

---

**🎯 大多数情况下，问题都是由于扩展ID不匹配导致的。请首先尝试获取正确的扩展ID并更新配置！**
