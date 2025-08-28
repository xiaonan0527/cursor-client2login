#!/usr/bin/env python3
"""
Chrome原生消息传递调试工具
模拟Chrome与原生主机的完整通信过程
"""

import sys
import json
import struct
import subprocess
import os
import time
from pathlib import Path

def send_native_message(host_path, message):
    """模拟Chrome发送原生消息的完整过程"""
    print(f"🚀 模拟Chrome向原生主机发送消息...")
    print(f"📍 主机路径: {host_path}")
    print(f"📨 消息内容: {json.dumps(message, indent=2)}")
    
    try:
        # 启动原生主机进程
        process = subprocess.Popen(
            [host_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # 准备消息
        message_json = json.dumps(message)
        message_bytes = message_json.encode('utf-8')
        message_length = len(message_bytes)
        
        print(f"📏 消息长度: {message_length} 字节")
        
        # 按Chrome原生消息格式发送
        length_bytes = struct.pack('@I', message_length)
        
        print(f"🔢 发送长度头: {length_bytes.hex()}")
        print(f"📝 发送消息体: {message_json}")
        
        # 发送长度头和消息体
        process.stdin.write(length_bytes)
        process.stdin.write(message_bytes)
        process.stdin.flush()
        
        # 等待响应
        print("⏳ 等待原生主机响应...")
        
        # 设置超时
        try:
            stdout, stderr = process.communicate(timeout=10)
            
            print(f"📤 进程退出码: {process.returncode}")
            
            if stderr:
                print(f"⚠️ 错误输出: {stderr.decode('utf-8', errors='ignore')}")
            
            if stdout:
                print(f"📥 原始输出: {stdout}")
                print(f"📥 原始输出(hex): {stdout.hex()}")
                
                # 尝试解析响应
                if len(stdout) >= 4:
                    response_length = struct.unpack('@I', stdout[:4])[0]
                    print(f"📏 响应长度: {response_length}")
                    
                    if len(stdout) >= 4 + response_length:
                        response_data = stdout[4:4+response_length]
                        print(f"📨 响应数据: {response_data.decode('utf-8', errors='ignore')}")
                        
                        try:
                            response_json = json.loads(response_data.decode('utf-8'))
                            print(f"✅ 解析成功: {json.dumps(response_json, indent=2)}")
                            return response_json
                        except json.JSONDecodeError as e:
                            print(f"❌ JSON解析失败: {e}")
                    else:
                        print(f"❌ 响应数据不完整: 期望{response_length}字节，实际{len(stdout)-4}字节")
                else:
                    print("❌ 响应太短，无法读取长度头")
            else:
                print("❌ 无输出数据")
                
        except subprocess.TimeoutExpired:
            print("⏰ 进程超时，强制终止")
            process.kill()
            stdout, stderr = process.communicate()
            
        return None
        
    except Exception as e:
        print(f"❌ 调试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()
        return None

def check_native_host_environment():
    """检查原生主机环境"""
    print("🔍 检查原生主机环境...")
    
    # 检查配置文件
    config_path = os.path.expanduser("~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.cursor.client.manage.json")
    if os.path.exists(config_path):
        print(f"✅ 配置文件存在: {config_path}")
        with open(config_path, 'r') as f:
            config = json.load(f)
            print(f"📋 配置内容: {json.dumps(config, indent=2)}")
            
            host_path = config.get('path')
            if os.path.exists(host_path):
                print(f"✅ 主机脚本存在: {host_path}")
                
                # 检查权限
                stat_info = os.stat(host_path)
                permissions = oct(stat_info.st_mode)[-3:]
                print(f"🔐 脚本权限: {permissions}")
                
                # 检查shebang
                with open(host_path, 'r') as f:
                    first_line = f.readline().strip()
                    print(f"🔧 Shebang: {first_line}")
                
                return host_path, config
            else:
                print(f"❌ 主机脚本不存在: {host_path}")
                return None, None
    else:
        print(f"❌ 配置文件不存在: {config_path}")
        return None, None

def test_python_environment():
    """测试Python环境"""
    print("\n🐍 测试Python环境...")
    
    # 检查python3可用性
    try:
        result = subprocess.run(['python3', '--version'], capture_output=True, text=True)
        print(f"✅ Python版本: {result.stdout.strip()}")
        print(f"📍 Python路径: {subprocess.check_output(['which', 'python3'], text=True).strip()}")
    except Exception as e:
        print(f"❌ Python3不可用: {e}")
        return False
    
    # 检查必要的Python模块
    required_modules = ['json', 'struct', 'sqlite3', 'base64', 'jwt']
    for module in required_modules:
        try:
            subprocess.check_call(['python3', '-c', f'import {module}'], 
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"✅ 模块 {module}: 可用")
        except subprocess.CalledProcessError:
            print(f"❌ 模块 {module}: 不可用")
            return False
    
    return True

def main():
    print("🔧 Chrome原生消息传递调试工具")
    print("=" * 50)
    
    # 1. 检查环境
    host_path, config = check_native_host_environment()
    if not host_path:
        return
    
    # 2. 测试Python环境
    if not test_python_environment():
        return
    
    # 3. 测试消息传递
    print("\n📡 测试原生消息传递...")
    
    test_messages = [
        {"action": "test_connection"},
        {"action": "getClientCurrentData"},
        {"action": "ping"}
    ]
    
    for i, message in enumerate(test_messages, 1):
        print(f"\n--- 测试 {i}: {message['action']} ---")
        response = send_native_message(host_path, message)
        
        if response:
            print("✅ 消息传递成功")
        else:
            print("❌ 消息传递失败")
            
        time.sleep(1)  # 避免进程冲突
    
    print("\n🎯 调试建议:")
    print("1. 如果所有测试都成功，问题可能在Chrome端")
    print("2. 如果测试失败，检查Python脚本的错误处理")
    print("3. 检查Chrome扩展控制台是否有更多错误信息")
    print("4. 尝试重新安装原生主机")

if __name__ == "__main__":
    main()
