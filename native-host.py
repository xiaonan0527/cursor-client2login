#!/usr/bin/env python3
import json
import sys
import struct
import sqlite3
import os
import platform
from typing import Dict, Any, Optional, Callable
from abc import ABC, abstractmethod


class BaseActionHandler(ABC):
    """Action处理器基类"""
    
    @abstractmethod
    def handle(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """处理请求并返回响应"""
        pass


class CursorDataManager:
    """Cursor数据管理器"""
    
    @staticmethod
    def get_cursor_db_path() -> str:
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

    @staticmethod
    def get_scope_json_path() -> str:
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

    @classmethod
    def read_access_token(cls) -> Dict[str, Any]:
        """从Cursor数据库读取accessToken"""
        try:
            db_path = cls.get_cursor_db_path()
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

    @classmethod
    def read_scope_json(cls) -> Dict[str, Any]:
        """读取scope_v3.json文件"""
        try:
            json_path = cls.get_scope_json_path()
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


class GetAccessTokenHandler(BaseActionHandler):
    """获取AccessToken处理器"""
    
    def handle(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return CursorDataManager.read_access_token()


class GetScopeDataHandler(BaseActionHandler):
    """获取Scope数据处理器"""
    
    def handle(self, params: Dict[str, Any]) -> Dict[str, Any]:
        return CursorDataManager.read_scope_json()


class GetClientCurrentDataHandler(BaseActionHandler):
    """获取客户端当前数据处理器"""
    
    def handle(self, params: Dict[str, Any]) -> Dict[str, Any]:
        # 获取所有数据
        token_result = CursorDataManager.read_access_token()
        scope_result = CursorDataManager.read_scope_json()
        
        if "error" in token_result:
            return token_result
        elif "error" in scope_result:
            return scope_result
        else:
            return {
                "accessToken": token_result.get("accessToken"),
                "email": scope_result.get("email"),
                "userid": scope_result.get("userid")
            }


class ActionRegistry:
    """Action注册表"""
    
    def __init__(self):
        self._handlers: Dict[str, BaseActionHandler] = {}
    
    def register(self, action: str, handler: BaseActionHandler) -> None:
        """注册action处理器"""
        self._handlers[action] = handler
    
    def get_handler(self, action: str) -> Optional[BaseActionHandler]:
        """获取action处理器"""
        return self._handlers.get(action)
    
    def get_available_actions(self) -> list:
        """获取所有可用的action"""
        return list(self._handlers.keys())


class NativeHostServer:
    """原生主机服务器"""
    
    def __init__(self):
        self.registry = ActionRegistry()
        self._register_default_handlers()
    
    def _register_default_handlers(self):
        """注册默认的处理器"""
        self.registry.register("getAccessToken", GetAccessTokenHandler())
        self.registry.register("getScopeData", GetScopeDataHandler())
        self.registry.register("getClientCurrentData", GetClientCurrentDataHandler())
    
    def add_handler(self, action: str, handler: BaseActionHandler) -> None:
        """添加新的action处理器"""
        self.registry.register(action, handler)
    
    @staticmethod
    def get_message() -> Dict[str, Any]:
        """从Chrome读取消息"""
        raw_length = sys.stdin.buffer.read(4)
        if len(raw_length) == 0:
            sys.exit(0)
        message_length = struct.unpack('@I', raw_length)[0]
        message = sys.stdin.buffer.read(message_length).decode('utf-8')
        return json.loads(message)
    
    @staticmethod
    def send_message(message: Dict[str, Any]) -> None:
        """发送消息到Chrome"""
        encoded_content = json.dumps(message).encode('utf-8')
        encoded_length = struct.pack('@I', len(encoded_content))
        sys.stdout.buffer.write(encoded_length)
        sys.stdout.buffer.write(encoded_content)
        sys.stdout.buffer.flush()
    
    def handle_request(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """处理请求"""
        action = message.get("action")
        params = message.get("params", {})
        
        if not action:
            return {"error": "缺少action参数"}
        
        handler = self.registry.get_handler(action)
        if not handler:
            available_actions = self.registry.get_available_actions()
            return {
                "error": f"未知操作: {action}",
                "available_actions": available_actions
            }
        
        try:
            return handler.handle(params)
        except Exception as e:
            return {"error": f"处理action '{action}' 时发生错误: {str(e)}"}
    
    def run(self) -> None:
        """运行服务器"""
        try:
            message = self.get_message()
            response = self.handle_request(message)
            self.send_message(response)
        except Exception as e:
            self.send_message({"error": f"处理请求时发生错误: {str(e)}"})


def main():
    """主函数"""
    server = NativeHostServer()
    server.run()


if __name__ == "__main__":
    main()