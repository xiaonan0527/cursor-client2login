#!/usr/bin/env python3
"""
原生主机连接问题诊断和修复工具
"""

import json
import os
import sys
import subprocess
import platform
from pathlib import Path

class NativeHostFixer:
    def __init__(self):
        self.system = platform.system()
        self.native_host_name = "com.cursor.client.manage"
        self.script_dir = Path(__file__).parent
        
    def get_native_host_dir(self):
        """获取原生主机配置目录"""
        if self.system == "Darwin":  # macOS
            return Path.home() / "Library/Application Support/Google/Chrome/NativeMessagingHosts"
        elif self.system == "Windows":
            appdata = os.getenv("APPDATA")
            return Path(appdata) / "Google/Chrome/NativeMessagingHosts"
        elif self.system == "Linux":
            return Path.home() / ".config/google-chrome/NativeMessagingHosts"
        else:
            raise Exception(f"不支持的操作系统: {self.system}")
    
    def diagnose(self):
        """诊断原生主机连接问题"""
        print("🔍 开始诊断原生主机连接问题...\n")
        
        issues = []
        suggestions = []
        
        # 1. 检查原生主机文件
        native_host_dir = self.get_native_host_dir()
        config_file = native_host_dir / f"{self.native_host_name}.json"
        script_file = native_host_dir / "native_host.py"
        
        print(f"📁 原生主机目录: {native_host_dir}")
        print(f"📄 配置文件: {config_file}")
        print(f"🐍 脚本文件: {script_file}")
        print()
        
        if not native_host_dir.exists():
            issues.append("❌ 原生主机目录不存在")
            suggestions.append("运行: python3 install_native_host.py install")
        else:
            print("✅ 原生主机目录存在")
        
        if not config_file.exists():
            issues.append("❌ 原生主机配置文件不存在")
            suggestions.append("运行: python3 install_native_host.py install")
        else:
            print("✅ 原生主机配置文件存在")
            
            # 检查配置文件内容
            try:
                with open(config_file, 'r') as f:
                    config = json.load(f)
                
                print(f"📋 配置内容:")
                print(f"   名称: {config.get('name')}")
                print(f"   描述: {config.get('description')}")
                print(f"   路径: {config.get('path')}")
                print(f"   允许的来源: {config.get('allowed_origins', [])}")
                
                # 检查路径是否正确
                config_path = Path(config.get('path', ''))
                if not config_path.exists():
                    issues.append(f"❌ 脚本路径不存在: {config_path}")
                    suggestions.append("运行: python3 install_native_host.py install")
                else:
                    print("✅ 脚本路径存在")
                
                # 检查扩展ID配置
                allowed_origins = config.get('allowed_origins', [])
                if not allowed_origins:
                    issues.append("❌ 未配置允许的扩展来源")
                    suggestions.append("需要配置扩展ID: python3 update_native_host.py [扩展ID]")
                else:
                    print("✅ 已配置扩展来源")
                    for origin in allowed_origins:
                        extension_id = origin.replace('chrome-extension://', '').replace('/', '')
                        print(f"   扩展ID: {extension_id}")
                
            except Exception as e:
                issues.append(f"❌ 配置文件格式错误: {e}")
                suggestions.append("重新安装: python3 install_native_host.py install")
        
        if not script_file.exists():
            issues.append("❌ 原生主机脚本不存在")
            suggestions.append("运行: python3 install_native_host.py install")
        else:
            print("✅ 原生主机脚本存在")
            
            # 检查脚本权限
            if not os.access(script_file, os.X_OK):
                issues.append("❌ 原生主机脚本无执行权限")
                suggestions.append(f"添加执行权限: chmod +x {script_file}")
            else:
                print("✅ 原生主机脚本有执行权限")
        
        # 2. 测试脚本功能
        print("\n🧪 测试原生主机脚本功能...")
        local_script = self.script_dir / "native_host.py"
        if local_script.exists():
            try:
                result = subprocess.run([
                    sys.executable, str(local_script)
                ], input='{"action": "testConnection"}', 
                text=True, capture_output=True, timeout=10)
                
                if result.returncode == 0:
                    print("✅ 本地脚本测试成功")
                else:
                    issues.append(f"❌ 本地脚本测试失败: {result.stderr}")
                    suggestions.append("检查Python环境和依赖")
            except Exception as e:
                issues.append(f"❌ 本地脚本测试异常: {e}")
                suggestions.append("检查Python环境")
        
        # 3. 输出诊断结果
        print("\n" + "="*50)
        print("📊 诊断结果")
        print("="*50)
        
        if not issues:
            print("🎉 未发现明显问题！")
            print("\n💡 如果仍然连接失败，请尝试:")
            print("1. 完全重启Chrome浏览器")
            print("2. 检查扩展ID是否正确")
            print("3. 运行: python3 fix_native_host.py --fix")
        else:
            print("🚨 发现以下问题:")
            for i, issue in enumerate(issues, 1):
                print(f"{i}. {issue}")
            
            print("\n💡 建议的解决方案:")
            for i, suggestion in enumerate(set(suggestions), 1):
                print(f"{i}. {suggestion}")
        
        return len(issues) == 0
    
    def auto_fix(self):
        """自动修复常见问题"""
        print("🔧 开始自动修复原生主机问题...\n")
        
        try:
            # 1. 重新安装原生主机
            print("1. 重新安装原生主机...")
            result = subprocess.run([
                sys.executable, "install_native_host.py", "install"
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                print("✅ 原生主机重新安装成功")
            else:
                print(f"❌ 原生主机安装失败: {result.stderr}")
                return False
            
            # 2. 设置脚本权限
            print("2. 设置脚本执行权限...")
            native_host_dir = self.get_native_host_dir()
            script_file = native_host_dir / "native_host.py"
            
            if script_file.exists():
                os.chmod(script_file, 0o755)
                print("✅ 脚本权限设置成功")
            
            # 3. 测试连接
            print("3. 测试原生主机连接...")
            result = subprocess.run([
                sys.executable, "install_native_host.py", "test"
            ], capture_output=True, text=True)
            
            if result.returncode == 0:
                print("✅ 原生主机测试成功")
            else:
                print(f"⚠️ 原生主机测试警告: {result.stderr}")
            
            print("\n🎉 自动修复完成！")
            print("\n📋 接下来请:")
            print("1. 获取当前Chrome扩展的ID")
            print("2. 运行: python3 update_native_host.py [扩展ID]")
            print("3. 完全重启Chrome浏览器")
            
            return True
            
        except Exception as e:
            print(f"❌ 自动修复失败: {e}")
            return False
    
    def get_extension_id_guide(self):
        """显示获取扩展ID的指南"""
        print("📋 获取Chrome扩展ID的步骤:")
        print("="*40)
        print("1. 打开Chrome浏览器")
        print("2. 在地址栏输入: chrome://extensions/")
        print("3. 找到 'Cursor Client2Login' 扩展")
        print("4. 在扩展卡片上找到 'ID' 字段")
        print("5. 复制32位字符的扩展ID")
        print("6. 运行: python3 update_native_host.py [扩展ID]")
        print("\n💡 扩展ID示例: abcdefghijklmnopqrstuvwxyz123456")

def main():
    fixer = NativeHostFixer()
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "--fix":
            fixer.auto_fix()
        elif sys.argv[1] == "--id-guide":
            fixer.get_extension_id_guide()
        elif sys.argv[1] == "--help":
            print("原生主机修复工具")
            print("用法:")
            print("  python3 fix_native_host.py           # 诊断问题")
            print("  python3 fix_native_host.py --fix     # 自动修复")
            print("  python3 fix_native_host.py --id-guide # 显示获取扩展ID指南")
        else:
            print("未知参数，使用 --help 查看帮助")
    else:
        # 默认执行诊断
        success = fixer.diagnose()
        
        if not success:
            print(f"\n🔧 要自动修复这些问题，请运行:")
            print(f"python3 {sys.argv[0]} --fix")

if __name__ == "__main__":
    main()
