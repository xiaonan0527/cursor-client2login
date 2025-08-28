#!/usr/bin/env python3
"""
专门诊断 "Native host has exited" 错误的工具
"""

import json
import os
import subprocess
import sys
import time
import struct

def check_chrome_native_host_logs():
    """检查Chrome的原生主机日志"""
    print("🔍 检查Chrome原生主机日志...")
    
    # Chrome日志可能的位置
    possible_log_paths = [
        "~/Library/Application Support/Google/Chrome/chrome_debug.log",
        "~/Library/Logs/Google/Chrome/chrome.log",
        "/tmp/chrome_native_messaging.log"
    ]
    
    for log_path in possible_log_paths:
        expanded_path = os.path.expanduser(log_path)
        if os.path.exists(expanded_path):
            print(f"📄 找到日志文件: {expanded_path}")
            try:
                with open(expanded_path, 'r') as f:
                    lines = f.readlines()[-20:]  # 最后20行
                    for line in lines:
                        if 'native' in line.lower() or 'host' in line.lower():
                            print(f"  {line.strip()}")
            except Exception as e:
                print(f"  ❌ 无法读取日志: {e}")
        else:
            print(f"  ❌ 日志文件不存在: {expanded_path}")

def test_script_lifecycle():
    """测试脚本的生命周期"""
    print("\n🔄 测试原生主机脚本生命周期...")
    
    host_path = os.path.expanduser("~/Library/Application Support/Google/Chrome/NativeMessagingHosts/native_host.py")
    
    # 测试1: 脚本是否能正常启动和退出
    print("1. 测试脚本启动和退出...")
    try:
        process = subprocess.Popen(
            [host_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        print(f"  ✅ 脚本启动成功，PID: {process.pid}")
        
        # 等待一下看脚本是否立即退出
        time.sleep(0.5)
        poll_result = process.poll()
        
        if poll_result is not None:
            print(f"  ❌ 脚本立即退出，退出码: {poll_result}")
            stdout, stderr = process.communicate()
            if stderr:
                print(f"  错误输出: {stderr.decode('utf-8', errors='ignore')}")
        else:
            print("  ✅ 脚本正在运行，等待输入...")
            
            # 发送一个简单消息测试
            message = {"action": "testConnection"}
            message_json = json.dumps(message)
            message_bytes = message_json.encode('utf-8')
            message_length = len(message_bytes)
            length_bytes = struct.pack('@I', message_length)
            
            process.stdin.write(length_bytes)
            process.stdin.write(message_bytes)
            process.stdin.flush()
            
            # 等待响应
            try:
                stdout, stderr = process.communicate(timeout=5)
                print(f"  ✅ 脚本正常处理消息并退出，退出码: {process.returncode}")
                
                if stderr:
                    print(f"  ⚠️ 错误输出: {stderr.decode('utf-8', errors='ignore')}")
                    
            except subprocess.TimeoutExpired:
                print("  ❌ 脚本超时，强制终止")
                process.kill()
                
    except Exception as e:
        print(f"  ❌ 启动脚本失败: {e}")

def test_concurrent_access():
    """测试并发访问问题"""
    print("\n🔄 测试并发访问...")
    
    host_path = os.path.expanduser("~/Library/Application Support/Google/Chrome/NativeMessagingHosts/native_host.py")
    
    # 启动多个进程测试
    processes = []
    for i in range(3):
        try:
            process = subprocess.Popen(
                [host_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            processes.append(process)
            print(f"  进程 {i+1}: PID {process.pid} 启动成功")
        except Exception as e:
            print(f"  进程 {i+1}: 启动失败 - {e}")
    
    # 等待并检查状态
    time.sleep(1)
    
    for i, process in enumerate(processes):
        if process.poll() is not None:
            print(f"  进程 {i+1}: 已退出，退出码 {process.returncode}")
        else:
            print(f"  进程 {i+1}: 仍在运行")
            process.terminate()

def check_file_locks():
    """检查文件锁定情况"""
    print("\n🔒 检查文件锁定情况...")
    
    # 检查Cursor数据库文件
    cursor_db = os.path.expanduser("~/Library/Application Support/Cursor/User/globalStorage/state.vscdb")
    
    if os.path.exists(cursor_db):
        print(f"✅ Cursor数据库文件存在: {cursor_db}")
        
        # 检查文件是否被锁定
        try:
            # 尝试以只读方式打开
            with open(cursor_db, 'rb') as f:
                f.read(1)  # 尝试读取一个字节
            print("  ✅ 数据库文件可读取")
        except Exception as e:
            print(f"  ❌ 数据库文件访问失败: {e}")
            
        # 检查是否有其他进程在访问文件
        try:
            result = subprocess.run(['lsof', cursor_db], capture_output=True, text=True)
            if result.stdout:
                print("  ⚠️ 文件正在被以下进程使用:")
                print(result.stdout)
            else:
                print("  ✅ 没有其他进程在使用数据库文件")
        except Exception:
            print("  ❓ 无法检查文件使用情况")
    else:
        print(f"❌ Cursor数据库文件不存在: {cursor_db}")

def analyze_chrome_extension_state():
    """分析Chrome扩展状态"""
    print("\n🔍 分析Chrome扩展可能的状态问题...")
    
    # 检查扩展是否可能被Chrome限制
    print("可能的Chrome限制原因:")
    print("1. 扩展权限不足")
    print("2. Chrome安全策略限制")
    print("3. 原生主机启动频率限制")
    print("4. 扩展被暂时禁用或限制")
    print("5. Chrome版本兼容性问题")
    
    # 检查Chrome版本
    try:
        # 尝试获取Chrome版本信息
        chrome_app = "/Applications/Google Chrome.app/Contents/Info.plist"
        if os.path.exists(chrome_app):
            result = subprocess.run(['defaults', 'read', chrome_app, 'CFBundleShortVersionString'], 
                                  capture_output=True, text=True)
            if result.stdout:
                print(f"📱 Chrome版本: {result.stdout.strip()}")
            else:
                print("❓ 无法获取Chrome版本")
    except Exception:
        print("❓ 无法检查Chrome版本")

def provide_solutions():
    """提供解决方案"""
    print("\n🎯 'Native host has exited' 错误解决方案:")
    print("=" * 50)
    
    print("🔧 立即尝试的解决方案:")
    print("1. **完全重启Chrome** (最重要！)")
    print("   - 完全退出Chrome (Cmd+Q)")
    print("   - 等待5秒")
    print("   - 重新启动Chrome")
    
    print("\n2. **重新安装原生主机**:")
    print("   python3 install_native_host.py")
    
    print("\n3. **检查扩展状态**:")
    print("   - 打开 chrome://extensions/")
    print("   - 确认扩展已启用")
    print("   - 尝试重新加载扩展")
    
    print("\n4. **检查扩展权限**:")
    print("   - 确认扩展有'与本机应用通信'权限")
    print("   - 检查是否被Chrome安全策略限制")
    
    print("\n🔍 深度诊断方案:")
    print("1. 使用 debug_native_host.html 进行浏览器端测试")
    print("2. 检查Chrome扩展控制台的详细错误信息")
    print("3. 尝试在Chrome隐身模式下测试")
    print("4. 检查是否有其他扩展冲突")
    
    print("\n⚠️ 特殊情况:")
    print("如果Python脚本本身运行正常（如我们测试所示），")
    print("但Chrome仍报告'Native host has exited'，")
    print("这通常意味着Chrome无法正确启动或与脚本通信。")
    print("这可能是Chrome的安全策略或进程管理问题。")

def main():
    print("🚨 Native Host Has Exited 错误专项诊断工具")
    print("=" * 60)
    
    # 运行所有检查
    check_chrome_native_host_logs()
    test_script_lifecycle()
    test_concurrent_access()
    check_file_locks()
    analyze_chrome_extension_state()
    provide_solutions()
    
    print("\n" + "=" * 60)
    print("🎯 诊断完成！请根据上述结果采取相应的解决措施。")

if __name__ == "__main__":
    main()
