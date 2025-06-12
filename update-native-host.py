#!/usr/bin/env python3
import os
import json
import sys
import platform


def get_chrome_native_host_dir():
    """获取Chrome原生消息主机目录"""
    system = platform.system()
    
    if system == "Darwin":
        return os.path.expanduser("~/Library/Application Support/Google/Chrome/NativeMessagingHosts")
    elif system == "Windows":
        appdata = os.getenv("APPDATA")
        return os.path.join(appdata, "Google", "Chrome", "NativeMessagingHosts")
    elif system == "Linux":
        return os.path.expanduser("~/.config/google-chrome/NativeMessagingHosts")


def update_native_host_manifest(extension_id=None):
    """更新原生主机清单文件"""
    try:
        host_dir = get_chrome_native_host_dir()
        manifest_path = os.path.join(host_dir, "com.cursor.client.manage.json")
        
        if not os.path.exists(manifest_path):
            print("❌ 原生主机清单文件不存在，请先运行安装命令")
            return False
        
        # 读取现有清单
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        
        # 更新allowed_origins
        if extension_id:
            manifest["allowed_origins"] = [f"chrome-extension://{extension_id}/"]
            print(f"✅ 更新为指定扩展ID: {extension_id}")
        else:
            manifest["allowed_origins"] = ["chrome-extension://*/"]
            print("✅ 更新为通配符模式（允许所有扩展）")
        
        # 写回文件
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2)
        
        print(f"📄 已更新清单文件: {manifest_path}")
        print(f"📋 新的allowed_origins: {manifest['allowed_origins']}")
        
        return True
        
    except Exception as e:
        print(f"❌ 更新失败: {e}")
        return False


def main():
    if len(sys.argv) > 1:
        extension_id = sys.argv[1]
        print(f"🔧 更新原生主机配置为扩展ID: {extension_id}")
        update_native_host_manifest(extension_id)
    else:
        print("🔧 更新原生主机配置为通配符模式")
        update_native_host_manifest()
        print("\n💡 如果仍然无法工作，请:")
        print("1. 在Chrome扩展页面找到你的扩展ID")
        print("2. 运行: python3 update-native-host.py <扩展ID>")
        print("3. 重启Chrome浏览器")


if __name__ == "__main__":
    main() 