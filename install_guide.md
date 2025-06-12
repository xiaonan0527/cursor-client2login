# Cursor Client2Login 安装使用指南

## 📦 安装说明

### 1. 准备插件文件
确保你有以下文件：
- `manifest.json` - 插件配置文件
- `background.js` - 后台服务脚本
- `popup.html` - 弹出窗口页面
- `popup.js` - 弹出窗口逻辑
- `content.js` - 内容脚本
- `native_host.py` - 原生主机脚本
- `install_native_host.py` - 原生主机安装器
- `native_host.json` - 原生主机配置模板

### 2. 安装到Chrome浏览器

1. 打开Chrome浏览器
2. 在地址栏输入 `chrome://extensions/`
3. 打开右上角的"开发者模式"开关
4. 点击"加载已解压的扩展程序"
5. 选择包含所有插件文件的文件夹
6. 插件安装成功后，你会在扩展程序列表中看到"Cursor Client2Login"

### 3. 固定插件到工具栏
- 点击Chrome工具栏右侧的拼图图标（扩展程序）
- 找到"Cursor Client2Login"
- 点击📌图标将其固定到工具栏

## 🚀 使用指南

### 方法一：🤖 自动读取（推荐）

#### 安装原生主机程序（一次性设置）

1. 打开终端/命令提示符
2. 导航到插件目录
3. 运行安装命令：

**macOS/Linux:**
```bash
python3 install_native_host.py install
```

**Windows:**
```cmd
python install_native_host.py install
```

4. 重启Chrome浏览器
5. 点击插件图标，选择"🤖 自动读取"标签
6. 点击"🔍 自动读取Cursor数据"按钮

插件将自动：
- 读取Cursor数据库获取accessToken
- 解析scope_v3.json获取email和userid
- 设置Cookie和保存到本地存储
- 打开Cursor Dashboard

### 方法二：📁 文件上传

1. 点击插件图标，选择"📁 文件上传"标签
2. 拖拽或点击上传 `scope_v3.json` 文件
3. 手动输入从数据库中提取的AccessToken
4. 点击"📋 处理文件数据"

**获取文件位置：**
- **macOS**: `~/Library/Application Support/Cursor/sentry/scope_v3.json`
- **Windows**: `%APPDATA%\Cursor\sentry\scope_v3.json`

### 方法三：✋ 手动输入

#### 获取所需数据

**获取 AccessToken：**
1. 找到Cursor数据库文件：
   - **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`
   - **Windows**: `%APPDATA%\Cursor\User\globalStorage\state.vscdb`
   - **Linux**: `~/.config/Cursor/User/globalStorage/state.vscdb`

2. 使用SQLite工具打开数据库文件
3. 执行SQL查询：
   ```sql
   SELECT value FROM itemTable WHERE key = 'cursorAuth/accessToken';
   ```

**获取 Email 和 UserID：**
1. 找到scope_v3.json文件：
   - **macOS**: `~/Library/Application Support/Cursor/sentry/scope_v3.json`
   - **Windows**: `%APPDATA%\Cursor\sentry\scope_v3.json`

2. 打开文件，找到类似以下的JSON结构：
   ```json
   {
     "scope": {
       "user": {
         "email": "your-email@example.com",
         "id": "auth0|user_01XXXXXXXXX"
       }
     }
   }
   ```

3. 提取email和id中"|"符号后面的部分作为userid

#### 使用手动输入
1. 点击插件图标，选择"✋ 手动输入"标签
2. 填写Email地址、User ID和Access Token
3. 点击"💾 导入并设置认证"

## 🔧 多账户管理

### 添加多个账户
- 使用任何方法导入不同的Cursor账户
- 所有账户都会保存在"已保存的账户"列表中

### 快速切换账户

#### 在插件中切换
- 在"已保存的账户"列表中点击"切换"按钮

#### 在Cursor网站上切换
1. 访问 https://www.cursor.com 的任何页面
2. 点击右上角的🎯浮动按钮
3. 选择要切换的账户
4. 页面会自动刷新并应用新的认证

## 🛠️ 技术说明

### 原生主机程序
- 允许插件直接读取本地文件系统
- 自动解析SQLite数据库和JSON配置文件
- 支持Windows、macOS和Linux系统

### Cookie格式
插件会自动将userid和accessToken拼接成以下格式：
```
userid%3A%3AaccessToken
```
这个值会被设置为名为 `WorkosCursorSessionToken` 的Cookie。

### 数据存储
- 所有账户信息都保存在Chrome的本地存储中
- 不会上传到任何服务器
- 可以随时清空所有数据

## 🔧 故障排除

**常见问题：**

1. **自动读取失败**
   - 确保已正确安装原生主机程序
   - 重启Chrome浏览器
   - 检查Cursor是否已安装并登录过

2. **插件无法设置Cookie**
   - 确保你有 www.cursor.com 的访问权限
   - 检查Chrome的Cookie设置

3. **找不到数据库文件**
   - 确保Cursor已经安装并至少登录过一次
   - 检查文件路径是否正确

4. **AccessToken无效**
   - Token可能已过期，重新登录Cursor获取新的Token
   - 确保复制的Token完整无误

5. **原生主机安装失败**
   - 检查Python是否正确安装
   - 在Windows上可能需要管理员权限
   - 手动检查Chrome的原生主机目录权限

## 🗑️ 卸载

### 卸载原生主机程序
```bash
python3 install_native_host.py uninstall
```

### 卸载Chrome插件
1. 进入 `chrome://extensions/`
2. 找到"Cursor Client2Login"
3. 点击"移除"

## 🛡️ 安全说明

- 本插件仅在本地处理认证数据，不会发送到任何外部服务器
- 原生主机程序只读取指定的Cursor配置文件
- AccessToken是敏感信息，请妥善保管
- 建议定期更新AccessToken以确保安全性
- 如果怀疑账户安全，请及时在Cursor官网更改密码

## 📝 更新日志

### v1.0.0
- ✅ 支持三种导入方式：自动读取、文件上传、手动输入
- ✅ 原生主机程序支持自动读取本地文件
- ✅ 支持多账户管理和快速切换
- ✅ 提供在线账户切换浮动按钮
- ✅ 自动设置Cookie和打开Dashboard
- ✅ 美观的现代化UI界面
- ✅ 支持拖拽文件上传
- ✅ 跨平台支持（Windows、macOS、Linux）

## 🤝 支持

如遇问题，请检查：
1. Chrome版本是否支持Manifest V3
2. 插件权限是否正确设置
3. 原生主机是否正确安装
4. 文件路径是否存在
5. 数据格式是否正确

---
*Cursor Client2Login - 让多账户管理更简单* 🎯 