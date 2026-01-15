"""
邮件通知模块
负责发送状态变化通知邮件
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
from datetime import datetime
from typing import List, Dict
from config import Config


class EmailNotifier:
    """邮件通知类"""
    
    def __init__(self):
        self.sender = Config.EMAIL_SENDER
        self.password = Config.EMAIL_PASSWORD
        self.receiver = Config.EMAIL_RECEIVER
        self.smtp_host, self.smtp_port = Config.get_smtp_config()
    
    def send_change_notification(self, changed_manuscripts: List[Dict]) -> bool:
        """
        发送状态变化通知邮件
        
        Args:
            changed_manuscripts: 有状态变化的稿件列表
        
        Returns:
            是否发送成功
        """
        if not changed_manuscripts:
            print("ℹ️  没有状态变化，无需发送邮件")
            return True
        
        try:
            # 创建邮件
            message = MIMEMultipart('alternative')
            message['From'] = Header(f"期刊状态监控 <{self.sender}>", 'utf-8')
            message['To'] = Header(self.receiver, 'utf-8')
            message['Subject'] = Header(
                f"📬 期刊稿件状态更新通知 ({len(changed_manuscripts)}篇)",
                'utf-8'
            )
            
            # 生成邮件内容
            html_content = self._generate_html_content(changed_manuscripts)
            text_content = self._generate_text_content(changed_manuscripts)
            
            # 添加纯文本和HTML版本
            part1 = MIMEText(text_content, 'plain', 'utf-8')
            part2 = MIMEText(html_content, 'html', 'utf-8')
            message.attach(part1)
            message.attach(part2)
            
            # 发送邮件
            print(f"📧 正在发送邮件到 {self.receiver}...")
            
            if self.smtp_port == 465:
                # SSL连接
                server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port)
            else:
                # TLS连接
                server = smtplib.SMTP(self.smtp_host, self.smtp_port)
                server.starttls()
            
            server.login(self.sender, self.password)
            server.sendmail(self.sender, [self.receiver], message.as_string())
            server.quit()
            
            print("✅ 邮件发送成功！")
            return True
            
        except Exception as e:
            print(f"❌ 邮件发送失败: {e}")
            return False
    
    def _generate_html_content(self, changed_manuscripts: List[Dict]) -> str:
        """生成HTML格式的邮件内容"""
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
        }}
        .header p {{
            margin: 5px 0 0 0;
            opacity: 0.9;
        }}
        .manuscript {{
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin-bottom: 15px;
            border-radius: 4px;
        }}
        .manuscript-title {{
            font-size: 16px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 8px;
        }}
        .manuscript-info {{
            font-size: 14px;
            color: #555;
            margin: 5px 0;
        }}
        .status-change {{
            background: white;
            padding: 10px;
            border-radius: 4px;
            margin-top: 8px;
        }}
        .status-old {{
            color: #e74c3c;
            text-decoration: line-through;
        }}
        .status-new {{
            color: #27ae60;
            font-weight: bold;
        }}
        .footer {{
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #999;
            text-align: center;
        }}
        .badge {{
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: bold;
        }}
        .badge-ieee {{
            background: #0066cc;
            color: white;
        }}
        .badge-elsevier {{
            background: #ff6600;
            color: white;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>📬 期刊稿件状态更新通知</h1>
        <p>检测到 {len(changed_manuscripts)} 篇稿件状态发生变化</p>
    </div>
"""
        
        for i, manuscript in enumerate(changed_manuscripts, 1):
            source = manuscript.get('source', '未知')
            badge_class = 'badge-ieee' if 'IEEE' in source.upper() else 'badge-elsevier'
            
            html += f"""
    <div class="manuscript">
        <div class="manuscript-title">
            {i}. {manuscript.get('title', '未知标题')}
        </div>
        <div class="manuscript-info">
            <span class="badge {badge_class}">{source}</span>
            稿件ID: {manuscript.get('id', '未知')}
        </div>
        <div class="status-change">
            <strong>状态变化：</strong>
            <span class="status-old">{manuscript.get('old_status', '未知')}</span>
            →
            <span class="status-new">{manuscript.get('new_status', '未知')}</span>
        </div>
        <div class="manuscript-info" style="margin-top: 8px;">
            <strong>变化时间：</strong> {manuscript.get('changed_at', current_time)}
        </div>
"""
            if manuscript.get('url'):
                html += f"""
        <div class="manuscript-info">
            <strong>查看链接：</strong> <a href="{manuscript['url']}">{manuscript['url']}</a>
        </div>
"""
            html += """
    </div>
"""
        
        html += f"""
    <div class="footer">
        <p>此邮件由期刊状态监控系统自动发送</p>
        <p>生成时间: {current_time}</p>
    </div>
</body>
</html>
"""
        return html
    
    def _generate_text_content(self, changed_manuscripts: List[Dict]) -> str:
        """生成纯文本格式的邮件内容"""
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        text = f"""
期刊稿件状态更新通知
{'=' * 50}

检测到 {len(changed_manuscripts)} 篇稿件状态发生变化

"""
        
        for i, manuscript in enumerate(changed_manuscripts, 1):
            text += f"""
{i}. {manuscript.get('title', '未知标题')}
   来源: {manuscript.get('source', '未知')}
   稿件ID: {manuscript.get('id', '未知')}
   状态变化: {manuscript.get('old_status', '未知')} → {manuscript.get('new_status', '未知')}
   变化时间: {manuscript.get('changed_at', current_time)}
"""
            if manuscript.get('url'):
                text += f"   查看链接: {manuscript['url']}\n"
            text += "\n"
        
        text += f"""
{'=' * 50}
此邮件由期刊状态监控系统自动发送
生成时间: {current_time}
"""
        return text
    
    def send_test_email(self) -> bool:
        """发送测试邮件"""
        try:
            message = MIMEText('这是一封测试邮件，用于验证邮件配置是否正确。', 'plain', 'utf-8')
            message['From'] = Header(f"期刊状态监控 <{self.sender}>", 'utf-8')
            message['To'] = Header(self.receiver, 'utf-8')
            message['Subject'] = Header('📧 期刊状态监控 - 测试邮件', 'utf-8')
            
            if self.smtp_port == 465:
                server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port)
            else:
                server = smtplib.SMTP(self.smtp_host, self.smtp_port)
                server.starttls()
            
            server.login(self.sender, self.password)
            server.sendmail(self.sender, [self.receiver], message.as_string())
            server.quit()
            
            print("✅ 测试邮件发送成功！")
            return True
            
        except Exception as e:
            print(f"❌ 测试邮件发送失败: {e}")
            return False
