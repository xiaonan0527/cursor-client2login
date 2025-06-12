#!/usr/bin/env python3
import os
import sys
import json
import platform
import shutil
import subprocess
from pathlib import Path


def get_system_info():
    """获取系统信息"""
    system = platform.system()
    if system == "Darwin":
        return "macos"
    elif system == "Windows":
        return "windows"
    elif system == "Linux":
        return "linux"
    else:
        raise Exception(f"不支持的操作系统: {system}")


def get_chrome_native_host_dir():
    """获取Chrome原生消息主机目录"""
    system = get_system_info()
    
    if system == "macos":
        return os.path.expanduser("~/Library/Application Support/Google/Chrome/NativeMessagingHosts")
    elif system == "windows":
        # Windows需要注册表，这里返回用户目录
        appdata = os.getenv("APPDATA")
        return os.path.join(appdata, "Google", "Chrome", "NativeMessagingHosts")
    elif system == "linux":
        return os.path.expanduser("~/.config/google-chrome/NativeMessagingHosts")


def create_native_host_manifest(host_dir, script_path):
    """创建原生主机清单文件"""
    manifest = {
        "name": "com.cursor.client.manage",
        "description": "Cursor Client2Login Native Host",
        "path": str(script_path),
        "type": "stdio",
        "allowed_origins": [
            "chrome-extension://*/"  # 允许所有扩展
        ]
    }

    manifest_path = os.path.join(host_dir, "com.cursor.client.manage.json")
    
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    
    return manifest_path


def install_native_host():
    """安装原生消息主机"""
    try:
        print("🔧 开始安装Cursor Client2Login原生主机...")
        
        # 获取当前脚本目录
        current_dir = Path(__file__).parent.absolute()
        native_host_script = current_dir / "native-host.py"
        
        if not native_host_script.exists():
            raise Exception(f"找不到native-host.py文件: {native_host_script}")
        
        # 获取Chrome原生主机目录
        host_dir = get_chrome_native_host_dir()
        
        # 创建目录（如果不存在）
        os.makedirs(host_dir, exist_ok=True)
        print(f"📁 原生主机目录: {host_dir}")
        
        # 复制脚本到系统目录
        system = get_system_info()
        if system == "windows":
            # Windows可能需要.exe或.bat包装器，但这里我们使用python直接路径
            python_executable = sys.executable
            target_script = os.path.join(host_dir, "native-host.py")
            shutil.copy2(native_host_script, target_script)
            # 在Windows上，我们需要在manifest中使用python解释器的完整路径
            script_path_for_manifest = f'"{python_executable}" "{target_script}"'
        else:
            target_script = os.path.join(host_dir, "native-host.py")
            shutil.copy2(native_host_script, target_script)
            script_path_for_manifest = target_script
        
        # 设置执行权限（Unix系统）
        if system in ["macos", "linux"]:
            os.chmod(target_script, 0o755)
        
        print(f"📋 已复制脚本到: {target_script}")
        
        # 创建清单文件
        manifest_path = create_native_host_manifest(host_dir, script_path_for_manifest)
        print(f"📄 已创建清单文件: {manifest_path}")
        
        # 显示清单文件内容用于调试
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest_content = json.load(f)
        print(f"📋 清单文件内容: {json.dumps(manifest_content, indent=2)}")
        
        # Windows需要注册表项
        if system == "windows":
            install_windows_registry(manifest_path)
        
        print("✅ 原生主机安装完成！")
        print("\n📝 接下来的步骤:")
        print("1. 重启Chrome浏览器")
        print("2. 在插件中点击'自动读取Cursor数据'")
        print("3. 如果仍然无法工作，请检查Chrome的原生消息传递权限")
        print(f"4. 调试: 检查目录 {host_dir} 中的文件权限")
        
        return True
        
    except Exception as e:
        print(f"❌ 安装失败: {e}")
        return False


def install_windows_registry(manifest_path):
    """在Windows上安装注册表项"""
    try:
        import winreg
        
        # 创建注册表项
        key_path = r"SOFTWARE\Google\Chrome\NativeMessagingHosts\com.cursor.client.manage"
        
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, manifest_path)
        
        print("📝 已添加Windows注册表项")
        
    except ImportError:
        print("⚠️  无法导入winreg模块，请手动添加注册表项")
        print(f"   路径: HKEY_CURRENT_USER\\SOFTWARE\\Google\\Chrome\\NativeMessagingHosts\\com.cursor.client.manage")
        print(f"   值: {manifest_path}")
    except Exception as e:
        print(f"⚠️  添加注册表项失败: {e}")


def uninstall_native_host():
    """卸载原生消息主机"""
    try:
        print("🗑️  开始卸载原生主机...")
        
        host_dir = get_chrome_native_host_dir()
        
        # 删除文件
        files_to_remove = [
            os.path.join(host_dir, "native-host.py"),
            os.path.join(host_dir, "native-host.exe"),
            os.path.join(host_dir, "com.cursor.client.manage.json")
        ]
        
        for file_path in files_to_remove:
            if os.path.exists(file_path):
                os.remove(file_path)
                print(f"🗑️  已删除: {file_path}")
        
        # Windows删除注册表项
        system = get_system_info()
        if system == "windows":
            try:
                import winreg
                key_path = r"SOFTWARE\Google\Chrome\NativeMessagingHosts\com.cursor.client.manage"
                winreg.DeleteKey(winreg.HKEY_CURRENT_USER, key_path)
                print("🗑️  已删除注册表项")
            except:
                print("⚠️  删除注册表项失败，请手动删除")
        
        print("✅ 卸载完成！")
        return True
        
    except Exception as e:
        print(f"❌ 卸载失败: {e}")
        return False


def test_native_host():
    """测试原生主机连接"""
    try:
        print("🧪 测试原生主机连接...")
        
        # 尝试直接运行native-host.py脚本
        current_dir = Path(__file__).parent.absolute()
        native_host_script = current_dir / "native-host.py"
        
        if not native_host_script.exists():
            print(f"❌ 找不到native-host.py文件: {native_host_script}")
            return False
        
        # 创建测试消息
        test_message = {"action": "getClientCurrentData"}
        message_json = json.dumps(test_message)
        message_length = len(message_json.encode('utf-8'))
        
        print(f"📤 发送测试消息: {test_message}")
        
        # 运行脚本并发送消息
        process = subprocess.Popen(
            [sys.executable, str(native_host_script)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # 发送消息长度（4字节）+ 消息内容
        import struct
        length_bytes = struct.pack('@I', message_length)
        message_bytes = message_json.encode('utf-8')
        
        stdout, stderr = process.communicate(length_bytes + message_bytes, timeout=10)
        
        if stderr:
            print(f"⚠️  stderr: {stderr.decode('utf-8')}")
        
        if stdout:
            # 解析响应
            if len(stdout) >= 4:
                response_length = struct.unpack('@I', stdout[:4])[0]
                if len(stdout) >= 4 + response_length:
                    response_data = stdout[4:4+response_length].decode('utf-8')
                    response = json.loads(response_data)
                    print(f"📥 收到响应: {response}")
                    
                    if 'error' in response:
                        print(f"⚠️  原生主机返回错误: {response['error']}")
                    else:
                        print("✅ 原生主机连接测试成功！")
                        return True
        
        print("❌ 原生主机连接测试失败")
        return False
        
    except subprocess.TimeoutExpired:
        print("❌ 原生主机响应超时")
        return False
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        return False


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("Cursor Client2Login 原生主机安装工具")
        print("\n使用方法:")
        print("  python install-native-host.py install   # 安装原生主机")
        print("  python install-native-host.py uninstall # 卸载原生主机")
        print("  python install-native-host.py test      # 测试原生主机")
        return
    
    action = sys.argv[1].lower()
    
    if action == "install":
        install_native_host()
    elif action == "uninstall":
        uninstall_native_host()
    elif action == "test":
        test_native_host()
    else:
        print(f"未知操作: {action}")
        print("支持的操作: install, uninstall, test")


if __name__ == "__main__":
    main() 