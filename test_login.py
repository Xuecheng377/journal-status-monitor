#!/usr/bin/env python3
"""
IEEE登录测试脚本
用于调试登录问题
"""

import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from config import Config

def test_ieee_login():
    config = Config()
    
    # 初始化浏览器
    print("🌐 初始化浏览器...")
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        # 访问登录页面
        print(f"🔗 访问登录页面: {config.IEEE_URL}")
        driver.get(config.IEEE_URL)
        time.sleep(5)
        
        print(f"📝 当前页面标题: {driver.title}")
        print(f"🔗 当前页面URL: {driver.current_url}")
        
        # 查找登录表单元素
        print("\n🔍 查找登录表单元素...")
        
        # 查找用户名输入框
        print("  查找用户名输入框...")
        try:
            # 尝试多种方式
            email_input = None
            try:
                email_input = driver.find_element(By.ID, "login")
                print("  ✅ 通过ID找到用户名输入框")
            except:
                try:
                    email_input = driver.find_element(By.NAME, "login")
                    print("  ✅ 通过NAME找到用户名输入框")
                except:
                    email_input = driver.find_element(By.XPATH, "//input[@type='text']")
                    print("  ✅ 通过XPATH找到用户名输入框")
            
            email_input.clear()
            email_input.send_keys(config.IEEE_EMAIL)
            print(f"  ✅ 已输入用户名")
            
        except Exception as e:
            print(f"  ❌ 查找用户名输入框失败: {e}")
            # 打印页面源代码的前1000个字符
            print("\n📄 页面源代码片段:")
            print(driver.page_source[:1000])
            raise
        
        # 查找密码输入框
        print("  查找密码输入框...")
        try:
            password_input = None
            try:
                password_input = driver.find_element(By.ID, "password")
                print("  ✅ 通过ID找到密码输入框")
            except:
                try:
                    password_input = driver.find_element(By.NAME, "password")
                    print("  ✅ 通过NAME找到密码输入框")
                except:
                    password_input = driver.find_element(By.XPATH, "//input[@type='password']")
                    print("  ✅ 通过XPATH找到密码输入框")
            
            password_input.clear()
            password_input.send_keys(config.IEEE_PASSWORD)
            print(f"  ✅ 已输入密码")
            
        except Exception as e:
            print(f"  ❌ 查找密码输入框失败: {e}")
            raise
        
        # 查找登录按钮
        print("  查找登录按钮...")
        try:
            login_button = None
            try:
                login_button = driver.find_element(By.XPATH, "//button[contains(text(), 'Log In')]")
                print("  ✅ 通过XPATH(button text)找到登录按钮")
            except:
                try:
                    login_button = driver.find_element(By.XPATH, "//input[@value='Log In']")
                    print("  ✅ 通过XPATH(input value)找到登录按钮")
                except:
                    login_button = driver.find_element(By.XPATH, "//button[@type='submit']")
                    print("  ✅ 通过XPATH(submit button)找到登录按钮")
            
            login_button.click()
            print("  ✅ 已点击登录按钮")
            
        except Exception as e:
            print(f"  ❌ 查找登录按钮失败: {e}")
            raise
        
        # 等待登录完成
        print("\n⏳ 等待登录完成...")
        time.sleep(5)
        
        print(f"📝 登录后页面标题: {driver.title}")
        print(f"🔗 登录后页面URL: {driver.current_url}")
        
        # 查找Author按钮
        print("\n🔍 查找Author按钮...")
        try:
            author_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.LINK_TEXT, "Author"))
            )
            print("✅ 找到Author按钮")
            author_button.click()
            time.sleep(5)
            
            print(f"📝 作者仪表板页面标题: {driver.title}")
            print(f"🔗 作者仪表板页面URL: {driver.current_url}")
            
            # 查找稿件表格
            print("\n🔍 查找稿件表格...")
            time.sleep(3)
            
            # 尝试查找表格
            tables = driver.find_elements(By.TAG_NAME, "table")
            print(f"📊 找到 {len(tables)} 个表格")
            
            for i, table in enumerate(tables):
                rows = table.find_elements(By.TAG_NAME, "tr")
                print(f"  表格 {i+1}: {len(rows)} 行")
                if len(rows) > 0:
                    # 打印第一行（表头）
                    headers = rows[0].find_elements(By.TAG_NAME, "th")
                    if headers:
                        header_texts = [h.text for h in headers]
                        print(f"    表头: {header_texts}")
                    
                    # 打印第二行（数据）
                    if len(rows) > 1:
                        cells = rows[1].find_elements(By.TAG_NAME, "td")
                        if cells:
                            cell_texts = [c.text[:30] for c in cells]  # 限制长度
                            print(f"    第一行数据: {cell_texts}")
            
            print("\n✅ 测试完成！")
            
        except Exception as e:
            print(f"❌ 查找Author按钮失败: {e}")
            raise
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        
    finally:
        print("\n🔒 关闭浏览器...")
        driver.quit()

if __name__ == "__main__":
    test_ieee_login()
