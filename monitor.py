"""
期刊状态监控主程序
负责登录IEEE和Elsevier，获取稿件状态
"""
import time
from typing import List, Dict, Optional
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from config import Config
from storage import ManuscriptStorage
from notification import EmailNotifier


class JournalMonitor:
    """期刊监控类"""
    
    def __init__(self):
        self.config = Config
        self.storage = ManuscriptStorage(Config.DATA_FILE)
        self.notifier = EmailNotifier()
        self.driver = None
    
    def _init_driver(self):
        """初始化浏览器驱动"""
        print("🌐 初始化浏览器...")
        
        chrome_options = Options()
        
        if self.config.HEADLESS:
            chrome_options.add_argument('--headless')
            chrome_options.add_argument('--no-sandbox')
            chrome_options.add_argument('--disable-dev-shm-usage')
        
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.implicitly_wait(10)
        
        print("✅ 浏览器初始化完成")
    
    def _close_driver(self):
        """关闭浏览器"""
        if self.driver:
            self.driver.quit()
            print("🔒 浏览器已关闭")
    
    def fetch_ieee_manuscripts(self) -> List[Dict]:
        """
        获取IEEE稿件列表
        
        Returns:
            稿件列表
        """
        if not self.config.IEEE_EMAIL or not self.config.IEEE_PASSWORD:
            print("⚠️  未配置IEEE账户，跳过")
            return []
        
        print("\n" + "=" * 50)
        print("📚 开始获取IEEE稿件状态...")
        print("=" * 50)
        
        manuscripts = []
        
        try:
            # 访问ScholarOne登录页面
            print("🔗 访问ScholarOne登录页面...")
            login_url = "https://mc.manuscriptcentral.com/tnnls-ieee"
            
            self.driver.get(login_url)
            time.sleep(2)
            
            # 输入用户名
            print("📝 输入登录信息...")
            email_input = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "login"))
            )
            email_input.clear()
            email_input.send_keys(self.config.IEEE_EMAIL)
            
            # 输入密码
            password_input = self.driver.find_element(By.ID, "password")
            password_input.clear()
            password_input.send_keys(self.config.IEEE_PASSWORD)
            
            # 点击登录按钮
            login_button = self.driver.find_element(By.NAME, "login")
            login_button.click()
            
            print("⏳ 等待登录...")
            time.sleep(3)
            
            # 检查是否登录成功
            if "Author" in self.driver.title or "Dashboard" in self.driver.title:
                print("✅ IEEE登录成功")
                
                # 查找稿件列表
                print("🔍 正在查找稿件...")
                time.sleep(2)
                
                try:
                    manuscript_rows = self.driver.find_elements(By.XPATH, "//table[@id='manuscriptTable']//tr[contains(@class, 'manuscriptRow')]")
                    
                    if not manuscript_rows:
                        manuscript_rows = self.driver.find_elements(By.XPATH, "//div[contains(@class, 'manuscript')]")
                    
                    print(f"📄 找到 {len(manuscript_rows)} 篇稿件")
                    
                    for row in manuscript_rows:
                        try:
                            manuscript_id = row.find_element(By.XPATH, ".//td[contains(@class, 'manuscriptId')]").text.strip()
                            title = row.find_element(By.XPATH, ".//td[contains(@class, 'title')]").text.strip()
                            status = row.find_element(By.XPATH, ".//td[contains(@class, 'status')]").text.strip()
                            
                            manuscripts.append({
                                'id': manuscript_id,
                                'title': title,
                                'status': status,
                                'source': 'IEEE',
                                'url': self.driver.current_url
                            })
                            
                            print(f"  ✓ {manuscript_id}: {title} - {status}")
                            
                        except Exception as e:
                            print(f"  ⚠️  解析稿件信息失败: {e}")
                            continue
                    
                except Exception as e:
                    print(f"⚠️  未找到稿件列表: {e}")
                    print("💡 提示：可能需要根据实际页面结构调整XPath")
                    
            else:
                print("❌ IEEE登录失败，请检查账户信息")
                
        except Exception as e:
            print(f"❌ 获取IEEE稿件失败: {e}")
        
        return manuscripts
    
    def fetch_elsevier_manuscripts(self) -> List[Dict]:
        """
        获取Elsevier稿件列表
        
        Returns:
            稿件列表
        """
        if not self.config.ELSEVIER_EMAIL or not self.config.ELSEVIER_PASSWORD:
            print("⚠️  未配置Elsevier账户，跳过")
            return []
        
        print("\n" + "=" * 50)
        print("📚 开始获取Elsevier稿件状态...")
        print("=" * 50)
        
        manuscripts = []
        
        try:
            # 访问Editorial Manager登录页面
            print("🔗 访问Editorial Manager登录页面...")
            login_url = "https://www.editorialmanager.com/login.asp"
            
            self.driver.get(login_url)
            time.sleep(2)
            
            # 输入用户名
            print("📝 输入登录信息...")
            email_input = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.NAME, "login"))
            )
            email_input.clear()
            email_input.send_keys(self.config.ELSEVIER_EMAIL)
            
            # 输入密码
            password_input = self.driver.find_element(By.NAME, "password")
            password_input.clear()
            password_input.send_keys(self.config.ELSEVIER_PASSWORD)
            
            # 点击登录按钮
            login_button = self.driver.find_element(By.XPATH, "//input[@type='submit' and @value='Login']")
            login_button.click()
            
            print("⏳ 等待登录...")
            time.sleep(3)
            
            # 检查是否登录成功
            if "Author" in self.driver.title or "Main Menu" in self.driver.title:
                print("✅ Elsevier登录成功")
                
                print("🔍 正在查找稿件...")
                
                try:
                    manuscript_links = self.driver.find_elements(By.XPATH, "//a[contains(text(), 'Submissions')]")
                    
                    for link in manuscript_links:
                        try:
                            link.click()
                            time.sleep(2)
                            
                            manuscript_rows = self.driver.find_elements(By.XPATH, "//table//tr[contains(@class, 'data')]")
                            
                            print(f"📄 找到 {len(manuscript_rows)} 篇稿件")
                            
                            for row in manuscript_rows:
                                try:
                                    cells = row.find_elements(By.TAG_NAME, "td")
                                    
                                    if len(cells) >= 3:
                                        manuscript_id = cells[0].text.strip()
                                        title = cells[1].text.strip()
                                        status = cells[2].text.strip()
                                        
                                        manuscripts.append({
                                            'id': manuscript_id,
                                            'title': title,
                                            'status': status,
                                            'source': 'Elsevier',
                                            'url': self.driver.current_url
                                        })
                                        
                                        print(f"  ✓ {manuscript_id}: {title} - {status}")
                                        
                                except Exception as e:
                                    print(f"  ⚠️  解析稿件信息失败: {e}")
                                    continue
                            
                            self.driver.back()
                            time.sleep(1)
                            
                        except Exception as e:
                            print(f"  ⚠️  处理稿件链接失败: {e}")
                            continue
                    
                except Exception as e:
                    print(f"⚠️  未找到稿件列表: {e}")
                    print("💡 提示：可能需要根据实际页面结构调整XPath")
                    
            else:
                print("❌ Elsevier登录失败，请检查账户信息")
                
        except Exception as e:
            print(f"❌ 获取Elsevier稿件失败: {e}")
        
        return manuscripts
    
    def run(self):
        """运行监控任务"""
        print("\n" + "🚀" * 25)
        print("期刊状态监控程序启动")
        print("🚀" * 25 + "\n")
        
        # 打印配置信息
        self.config.print_config()
        
        # 验证配置
        if not self.config.validate():
            print("\n❌ 配置验证失败，程序退出")
            return
        
        try:
            # 初始化浏览器
            self._init_driver()
            
            # 获取所有稿件
            all_manuscripts = []
            
            # 获取IEEE稿件
            ieee_manuscripts = self.fetch_ieee_manuscripts()
            all_manuscripts.extend(ieee_manuscripts)
            
            # 获取Elsevier稿件
            elsevier_manuscripts = self.fetch_elsevier_manuscripts()
            all_manuscripts.extend(elsevier_manuscripts)
            
            # 关闭浏览器
            self._close_driver()
            
            # 显示结果
            print("\n" + "=" * 50)
            print(f"📊 本次共获取 {len(all_manuscripts)} 篇稿件")
            print("=" * 50)
            
            if all_manuscripts:
                # 对比状态变化
                print("\n🔍 正在对比状态变化...")
                changed_manuscripts = self.storage.compare_and_update(all_manuscripts)
                
                # 发送通知
                if changed_manuscripts:
                    print(f"\n📬 检测到 {len(changed_manuscripts)} 篇稿件状态变化")
                    self.notifier.send_change_notification(changed_manuscripts)
                else:
                    print("\n✅ 所有稿件状态无变化")
            else:
                print("\n⚠️  未获取到任何稿件，请检查账户配置或页面结构")
            
            print("\n" + "✅" * 25)
            print("监控任务完成")
            print("✅" * 25 + "\n")
            
        except Exception as e:
            print(f"\n❌ 程序执行出错: {e}")
            import traceback
            traceback.print_exc()
        finally:
            # 确保浏览器关闭
            self._close_driver()


if __name__ == '__main__':
    monitor = JournalMonitor()
    monitor.run()
