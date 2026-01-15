"""
配置管理模块
负责从环境变量中读取配置信息
"""
import os
from typing import Optional


class Config:
    """配置类"""
    
    # IEEE账户配置
    IEEE_EMAIL: Optional[str] = os.getenv('IEEE_EMAIL')
    IEEE_PASSWORD: Optional[str] = os.getenv('IEEE_PASSWORD')
    IEEE_URL: Optional[str] = os.getenv('IEEE_URL')  # IEEE期刊的ScholarOne网址
    
    # Elsevier账户配置
    ELSEVIER_EMAIL: Optional[str] = os.getenv('ELSEVIER_EMAIL')
    ELSEVIER_PASSWORD: Optional[str] = os.getenv('ELSEVIER_PASSWORD')
    ELSEVIER_URL: Optional[str] = os.getenv('ELSEVIER_URL')  # Elsevier期刊的Editorial Manager网址
    
    # 邮件配置
    EMAIL_SENDER: Optional[str] = os.getenv('EMAIL_SENDER')
    EMAIL_PASSWORD: Optional[str] = os.getenv('EMAIL_PASSWORD')
    EMAIL_RECEIVER: Optional[str] = os.getenv('EMAIL_RECEIVER')
    
    # SMTP配置（自动识别）
    SMTP_HOST: Optional[str] = os.getenv('SMTP_HOST')
    SMTP_PORT: int = int(os.getenv('SMTP_PORT', '465'))
    
    # 其他配置
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    DATA_FILE: str = os.getenv('DATA_FILE', 'data/manuscripts.json')
    HEADLESS: bool = os.getenv('HEADLESS', 'true').lower() == 'true'
    
    @classmethod
    def validate(cls) -> bool:
        """验证配置是否完整"""
        required_fields = []
        
        # 检查是否至少配置了一个期刊账户
        ieee_configured = cls.IEEE_EMAIL and cls.IEEE_PASSWORD and cls.IEEE_URL
        elsevier_configured = cls.ELSEVIER_EMAIL and cls.ELSEVIER_PASSWORD and cls.ELSEVIER_URL
        
        if not ieee_configured and not elsevier_configured:
            required_fields.append('IEEE或Elsevier账户（包括邮箱、密码和期刊网址）')
        
        # 检查邮件配置
        if not cls.EMAIL_SENDER or not cls.EMAIL_PASSWORD:
            required_fields.append('邮件发送配置')
        
        if not cls.EMAIL_RECEIVER:
            required_fields.append('邮件接收地址')
        
        if required_fields:
            print(f"❌ 配置不完整，缺少: {', '.join(required_fields)}")
            return False
        
        return True
    
    @classmethod
    def get_smtp_config(cls) -> tuple:
        """自动识别SMTP配置"""
        if cls.SMTP_HOST:
            return cls.SMTP_HOST, cls.SMTP_PORT
        
        # 根据发件人邮箱自动识别SMTP服务器
        email_lower = cls.EMAIL_SENDER.lower()
        
        smtp_configs = {
            'qq.com': ('smtp.qq.com', 465),
            '163.com': ('smtp.163.com', 465),
            '126.com': ('smtp.126.com', 465),
            'gmail.com': ('smtp.gmail.com', 587),
            'outlook.com': ('smtp.office365.com', 587),
            'hotmail.com': ('smtp.office365.com', 587),
            'sina.com': ('smtp.sina.com', 465),
            'yeah.net': ('smtp.yeah.net', 465),
        }
        
        for domain, (host, port) in smtp_configs.items():
            if domain in email_lower:
                return host, port
        
        # 默认配置
        return 'smtp.gmail.com', 587
    
    @classmethod
    def print_config(cls):
        """打印配置信息（隐藏敏感信息）"""
        print("=" * 50)
        print("当前配置:")
        print("=" * 50)
        print(f"IEEE账户: {cls.IEEE_EMAIL if cls.IEEE_EMAIL else '未配置'}")
        if cls.IEEE_URL:
            print(f"IEEE期刊网址: {cls.IEEE_URL}")
        print(f"Elsevier账户: {cls.ELSEVIER_EMAIL if cls.ELSEVIER_EMAIL else '未配置'}")
        if cls.ELSEVIER_URL:
            print(f"Elsevier期刊网址: {cls.ELSEVIER_URL}")
        print(f"发件邮箱: {cls.EMAIL_SENDER}")
        print(f"收件邮箱: {cls.EMAIL_RECEIVER}")
        smtp_host, smtp_port = cls.get_smtp_config()
        print(f"SMTP服务器: {smtp_host}:{smtp_port}")
        print(f"无头模式: {cls.HEADLESS}")
        print(f"日志级别: {cls.LOG_LEVEL}")
        print(f"数据文件: {cls.DATA_FILE}")
        print("=" * 50)
