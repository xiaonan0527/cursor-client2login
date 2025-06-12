#!/usr/bin/env python3
import json
import sys
import struct
import sqlite3
import os
import platform


def get_message():
    """从Chrome读取消息"""
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        sys.exit(0)
    message_length = struct.unpack('@I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)


def send_message(message):
    """发送消息到Chrome"""
    encoded_content = json.dumps(message).encode('utf-8')
    encoded_length = struct.pack('@I', len(encoded_content))
    sys.stdout.buffer.write(encoded_length)
    sys.stdout.buffer.write(encoded_content)
    sys.stdout.buffer.flush()


def get_cursor_db_path():
    """根据操作系统获取Cursor数据库路径"""
    system = platform.system()
    
    if system == "Windows":
        appdata = os.getenv("APPDATA")
        if appdata is None:
            raise EnvironmentError("APPDATA 环境变量未设置")
        return os.path.join(appdata, "Cursor", "User", "globalStorage", "state.vscdb")
    elif system == "Darwin":  # macOS
        return os.path.expanduser("~/Library/Application Support/Cursor/User/globalStorage/state.vscdb")
    elif system == "Linux":
        return os.path.expanduser("~/.config/Cursor/User/globalStorage/state.vscdb")
    else:
        raise NotImplementedError(f"不支持的操作系统: {system}")


def get_scope_json_path():
    """根据操作系统获取scope_v3.json路径"""
    system = platform.system()
    
    if system == "Windows":
        appdata = os.getenv("APPDATA")
        if appdata is None:
            raise EnvironmentError("APPDATA 环境变量未设置")
        return os.path.join(appdata, "Cursor", "sentry", "scope_v3.json")
    elif system == "Darwin":  # macOS
        return os.path.expanduser("~/Library/Application Support/Cursor/sentry/scope_v3.json")
    elif system == "Linux":
        return os.path.expanduser("~/.config/Cursor/sentry/scope_v3.json")
    else:
        raise NotImplementedError(f"不支持的操作系统: {system}")


def read_access_token():
    """从Cursor数据库读取accessToken"""
    try:
        db_path = get_cursor_db_path()
        if not os.path.exists(db_path):
            return {"error": f"数据库文件不存在: {db_path}"}
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT value FROM itemTable WHERE key = ?", ("cursorAuth/accessToken",))
        result = cursor.fetchone()
        
        conn.close()
        
        if result:
            return {"accessToken": result[0]}
        else:
            return {"error": "未找到accessToken"}
            
    except Exception as e:
        return {"error": f"读取accessToken失败: {str(e)}"}


def read_scope_json():
    """读取scope_v3.json文件"""
    try:
        json_path = get_scope_json_path()
        if not os.path.exists(json_path):
            return {"error": f"JSON文件不存在: {json_path}"}
        
        with open(json_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # 移除末尾的%符号（如果存在）
            content = content.rstrip('%').strip()
            data = json.loads(content)
        
        # 提取email和userid
        user_info = data.get("scope", {}).get("user", {})
        email = user_info.get("email")
        user_id_full = user_info.get("id")
        
        if email and user_id_full and "|" in user_id_full:
            userid = user_id_full.split("|")[1]
            return {
                "email": email,
                "userid": userid
            }
        else:
            return {"error": "无法提取email或userid"}
            
    except Exception as e:
        return {"error": f"读取scope_v3.json失败: {str(e)}"}


def main():
    """主函数"""
    try:
        message = get_message()
        action = message.get("action")
        
        if action == "getAccessToken":
            response = read_access_token()
        elif action == "getScopeData":
            response = read_scope_json()
        elif action == "getAllData":
            # 获取所有数据
            token_result = read_access_token()
            scope_result = read_scope_json()
            
            if "error" in token_result:
                response = token_result
            elif "error" in scope_result:
                response = scope_result
            else:
                response = {
                    "accessToken": token_result.get("accessToken"),
                    "email": scope_result.get("email"),
                    "userid": scope_result.get("userid")
                }
        else:
            response = {"error": f"未知操作: {action}"}
        
        send_message(response)
        
    except Exception as e:
        send_message({"error": f"处理请求时发生错误: {str(e)}"})


if __name__ == "__main__":
    main() 