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
            login_url = self.config.IEEE_URL
            print(f"🎯 目标网址: {login_url}")
            
            self.driver.get(login_url)
            time.sleep(2)
            
            # 输入用户名
            print("📝 输入登录信息...")
            try:
                # 尝试多种方式查找用户名输入框
                email_input = None
                try:
                    email_input = WebDriverWait(self.driver, 5).until(
                        EC.presence_of_element_located((By.ID, "login"))
                    )
                except:
                    try:
                        email_input = self.driver.find_element(By.NAME, "login")
                    except:
                        try:
                            email_input = self.driver.find_element(By.XPATH, "//input[@type='text' or @type='email']")
                        except:
                            email_input = self.driver.find_element(By.XPATH, "//input[contains(@placeholder, 'User') or contains(@placeholder, 'ID')]")
                
                email_input.clear()
                email_input.send_keys(self.config.IEEE_EMAIL)
                print("✅ 用户名已输入")
                
                # 输入密码
                password_input = None
                try:
                    password_input = self.driver.find_element(By.ID, "password")
                except:
                    try:
                        password_input = self.driver.find_element(By.NAME, "password")
                    except:
                        password_input = self.driver.find_element(By.XPATH, "//input[@type='password']")
                
                password_input.clear()
                password_input.send_keys(self.config.IEEE_PASSWORD)
                print("✅ 密码已输入")
                
                # 点击登录按钮
                login_button = None
                try:
                    # 方式1：通过按钮文本查找
                    login_button = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Log In')]")
                    print("✅ 通过按钮文本找到登录按钮")
                except:
                    try:
                        # 方式2：通过input value查找
                        login_button = self.driver.find_element(By.XPATH, "//input[@value='Log In']")
                        print("✅ 通过input value找到登录按钮")
                    except:
                        try:
                            # 方式3：通过name属性查找
                            login_button = self.driver.find_element(By.NAME, "login")
                            print("✅ 通过name属性找到登录按钮")
                        except:
                            try:
                                # 方式4：查找所有button和input，然后过滤
                                buttons = self.driver.find_elements(By.XPATH, "//button | //input[@type='submit'] | //input[@type='button']")
                                for btn in buttons:
                                    btn_text = btn.text or btn.get_attribute('value') or ''
                                    if 'log in' in btn_text.lower():
                                        login_button = btn
                                        print(f"✅ 通过遍历找到登录按钮: {btn_text}")
                                        break
                                if not login_button:
                                    raise Exception("未找到登录按钮")
                            except:
                                # 方式5：直接按Enter键
                                print("⚠️  未找到登录按钮，尝试按Enter键")
                                password_input.send_keys("\n")  # 按Enter键
                                login_button = None
                
                if login_button:
                    login_button.click()
                    print("✅ 已点击登录按钮")
                else:
                    print("✅ 已按Enter键提交")
                
            except Exception as e:
                print(f"❌ 登录输入失败: {e}")
                print(f"📝 当前页面标题: {self.driver.title}")
                print(f"🔗 当前页面URL: {self.driver.current_url}")
                raise
            
            print("⏳ 等待登录...")
            time.sleep(3)
            
            # 检查是否登录成功
            if "ScholarOne" in self.driver.title or "Manuscripts" in self.driver.title:
                print("✅ IEEE登录成功")
                
                # 点击Author按钮进入作者仪表板
                print("👉 点击Author按钮...")
                try:
                    author_button = WebDriverWait(self.driver, 10).until(
                        EC.element_to_be_clickable((By.LINK_TEXT, "Author"))
                    )
                    author_button.click()
                    time.sleep(3)
                    print("✅ 已进入作者仪表板")
                except Exception as e:
                    print(f"⚠️  未找到Author按钮，尝试其他方式: {e}")
                    # 尝试通过其他方式查找Author链接
                    try:
                        author_link = self.driver.find_element(By.XPATH, "//a[contains(text(), 'Author') or contains(@href, 'author')]")
                        author_link.click()
                        time.sleep(3)
                    except:
                        print("⚠️  无法找到Author入口，尝试直接查找稿件")
                
                # 查找稿件列表
                print("🔍 正在查找稿件...")
                time.sleep(2)
                
                try:
                    # 根据截图，稿件表格的列顺序是：STATUS, ID, TITLE, CREATED, SUBMITTED
                    manuscript_rows = []
                    
                    # 方式1：查找带有data属性的表格行
                    manuscript_rows = self.driver.find_elements(By.XPATH, "//table//tr[@class='data' or @class='data-even' or @class='data-odd']")
                    
                    if not manuscript_rows:
                        # 方式2：查找包含manuscript的表格行
                        manuscript_rows = self.driver.find_elements(By.XPATH, "//table//tr[contains(@class, 'manuscript')]")
                    
                    if not manuscript_rows:
                        # 方式3：查找包含稿件信息的所有表格行（排除表头）
                        all_rows = self.driver.find_elements(By.XPATH, "//table//tr[td]")
                        # 过滤掉表头行
                        manuscript_rows = [row for row in all_rows if len(row.find_elements(By.TAG_NAME, "td")) >= 3]
                    
                    print(f"📄 找到 {len(manuscript_rows)} 行数据")
                    
                    if len(manuscript_rows) == 0:
                        print("⚠️  未找到稿件列表，可能需要调整XPath")
                        print("📝 当前页面标题:", self.driver.title)
                        print("🔗 当前页面URL:", self.driver.current_url)
                    
                    for idx, row in enumerate(manuscript_rows):
                        try:
                            cells = row.find_elements(By.TAG_NAME, "td")
                            print(f"  行 {idx+1}: 找到 {len(cells)} 列")
                            
                            if len(cells) < 3:
                                print(f"    跳过：列数不足")
                                continue
                            
                            # 根据截图，列顺序是：STATUS(0), ID(1), TITLE(2), CREATED(3), SUBMITTED(4)
                            # STATUS列可能包含多个元素，需要提取最后的状态信息
                            status_cell = cells[0] if len(cells) > 0 else None
                            status = "未知状态"
                            if status_cell:
                                # 尝试查找状态按钮或链接
                                status_elements = status_cell.find_elements(By.XPATH, ".//a | .//button | .//span")
                                if status_elements:
                                    # 获取最后一个元素的文本（通常是状态）
                                    for elem in status_elements:
                                        elem_text = elem.text.strip()
                                        if elem_text and elem_text not in ['Contact Journal', 'EIC:', 'ADM:']:
                                            status = elem_text
                                else:
                                    status = status_cell.text.strip()
                                    # 如果包含多行，取最后一行
                                    if '\n' in status:
                                        lines = [l.strip() for l in status.split('\n') if l.strip()]
                                        status = lines[-1] if lines else "未知状态"
                            
                            # ID列
                            manuscript_id = ""
                            if len(cells) > 1:
                                id_cell = cells[1]
                                # 尝试查找id_cell中的所有文本
                                manuscript_id = id_cell.text.strip()
                                # 如果为空，尝试查找子元素
                                if not manuscript_id:
                                    id_elements = id_cell.find_elements(By.XPATH, ".//*")
                                    for elem in id_elements:
                                        elem_text = elem.text.strip()
                                        if elem_text:
                                            manuscript_id = elem_text
                                            break
                            
                            # TITLE列
                            title = ""
                            if len(cells) > 2:
                                title_cell = cells[2]
                                # 尝试查找title_cell中的所有文本
                                title = title_cell.text.strip()
                                # 如果为空，尝试查找链接或其他元素
                                if not title:
                                    title_elements = title_cell.find_elements(By.XPATH, ".//a | .//span | .//div")
                                    for elem in title_elements:
                                        elem_text = elem.text.strip()
                                        if elem_text and len(elem_text) > 5:  # 过滤掉太短的文本
                                            title = elem_text
                                            break
                            
                            print(f"    原始数据: STATUS=[{status}], ID=[{manuscript_id}], TITLE=[{title[:50] if title else ''}]")
                            
                            # 过滤掉空行、表头行或非稿件行
                            if not manuscript_id or not title:
                                print(f"    跳过：ID或标题为空")
                                continue
                            if manuscript_id.lower() in ['manuscript', 'id', '#', 'status']:
                                print(f"    跳过：表头行 (ID={manuscript_id})")
                                continue
                            if status.lower() in ['status', 'id', 'title']:
                                print(f"    跳过：表头行 (STATUS={status})")
                                continue
                            
                            manuscripts.append({
                                'id': manuscript_id,
                                'title': title,
                                'status': status,
                                'source': 'IEEE',
                                'url': self.driver.current_url
                            })
                            
                            print(f"  ✓ [{status}] {manuscript_id}: {title}")
                            
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
        if not self.config.ELSEVIER_EMAIL or not self.config.ELSEVIER_PASSWORD or not self.config.ELSEVIER_URL:
            print("⚠️  未配置Elsevier账户或期刊网址，跳过")
            return []
        
        print("\n" + "=" * 50)
        print("📚 开始获取Elsevier稿件状态...")
        print("=" * 50)
        
        manuscripts = []
        
        try:
            # 访问Editorial Manager登录页面
            print("🔗 访问Editorial Manager登录页面...")
            login_url = self.config.ELSEVIER_URL
            print(f"🎯 目标网址: {login_url}")
            
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
