"""
数据存储和状态对比模块
负责保存和读取稿件状态，检测变化
"""
import json
import os
from datetime import datetime
from typing import Dict, List, Optional


class ManuscriptStorage:
    """稿件存储类"""
    
    def __init__(self, data_file: str):
        self.data_file = data_file
        self._ensure_data_dir()
    
    def _ensure_data_dir(self):
        """确保数据目录存在"""
        data_dir = os.path.dirname(self.data_file)
        if data_dir and not os.path.exists(data_dir):
            os.makedirs(data_dir, exist_ok=True)
    
    def load_manuscripts(self) -> Dict:
        """加载已保存的稿件数据"""
        if not os.path.exists(self.data_file):
            return {}
        
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️  读取数据文件失败: {e}")
            return {}
    
    def save_manuscripts(self, manuscripts: Dict):
        """保存稿件数据"""
        try:
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(manuscripts, f, ensure_ascii=False, indent=2)
            print(f"✅ 数据已保存到 {self.data_file}")
        except Exception as e:
            print(f"❌ 保存数据失败: {e}")
    
    def compare_and_update(self, new_manuscripts: List[Dict]) -> List[Dict]:
        """
        对比新旧稿件状态，返回有变化的稿件
        
        Args:
            new_manuscripts: 新获取的稿件列表
        
        Returns:
            有状态变化的稿件列表
        """
        old_data = self.load_manuscripts()
        changed_manuscripts = []
        updated_data = {}
        
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        for manuscript in new_manuscripts:
            manuscript_id = manuscript.get('id')
            title = manuscript.get('title', '未知标题')
            current_status = manuscript.get('status', '未知状态')
            source = manuscript.get('source', '未知来源')
            
            # 构建唯一键
            key = f"{source}_{manuscript_id}"
            
            # 检查是否有旧记录
            if key in old_data:
                old_status = old_data[key].get('status')
                
                # 状态发生变化
                if old_status != current_status:
                    changed_manuscripts.append({
                        'id': manuscript_id,
                        'title': title,
                        'source': source,
                        'old_status': old_status,
                        'new_status': current_status,
                        'changed_at': current_time,
                        'url': manuscript.get('url', '')
                    })
                    print(f"📝 检测到状态变化: {title}")
                    print(f"   {old_status} → {current_status}")
            else:
                # 新稿件
                print(f"🆕 发现新稿件: {title} ({current_status})")
            
            # 更新数据
            updated_data[key] = {
                'id': manuscript_id,
                'title': title,
                'status': current_status,
                'source': source,
                'url': manuscript.get('url', ''),
                'last_checked': current_time,
                'first_seen': old_data.get(key, {}).get('first_seen', current_time)
            }
        
        # 保存更新后的数据
        self.save_manuscripts(updated_data)
        
        return changed_manuscripts
    
    def get_all_manuscripts(self) -> List[Dict]:
        """获取所有稿件列表"""
        data = self.load_manuscripts()
        return list(data.values())
    
    def clear_data(self):
        """清空数据（用于测试）"""
        if os.path.exists(self.data_file):
            os.remove(self.data_file)
            print(f"🗑️  已清空数据文件: {self.data_file}")
