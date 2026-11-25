import { FormSchema, AutomationSettings } from '../../types/form';

export function generateSeleniumScript(schema: FormSchema, settings: AutomationSettings): string {
  const isBatch = settings.executionMode === 'batch_csv';
  const csvFile = settings.csvFileName || 'form_data.csv';

  return `"""
Automated 2-Page Microsoft Forms Submitter using Selenium WebDriver
Target Form: ${schema.title}
Form URL: ${schema.formUrl}

Requirements:
  pip install selenium pandas webdriver-manager
"""

import sys
import os
import time
import random
import logging
${isBatch ? 'import pandas as pd' : ''}
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

logging.basicConfig(level=logging.INFO, format='[%(asctime)s] [%(levelname)s] %(message)s')
logger = logging.getLogger("MSFormsSelenium")

FORM_URL = "${schema.formUrl}"
HEADLESS = ${settings.headless ? 'True' : 'False'}
TIMEOUT_SECONDS = ${settings.timeoutSeconds}

def init_driver():
    """Initializes modern Chrome WebDriver with anti-detection flags."""
    options = Options()
    if HEADLESS:
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1280,850")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=options
    )
    return driver

def wait_and_click_next(driver, wait):
    """
    CRITICAL PAGINATION LOGIC:
    1. Finds the 'Next' button on Page 1.
    2. Clicks it.
    3. Explicitly waits for Page 2's 'Back' button or Question elements to load in DOM.
    """
    logger.info("--> Transitioning from Page 1 to Page 2...")
    next_btn = wait.until(
        EC.element_to_be_clickable((
            By.CSS_SELECTOR,
            "button[data-automation-id='nextButton'], button[aria-label='Next'], button:has-text('Next')"
        ))
    )
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", next_btn)
    time.sleep(0.3)
    next_btn.click()
    
    # Wait for Page 2 marker: the 'Back' button or second page question container
    logger.info("Waiting for Page 2 DOM elements to hydrate...")
    wait.until(
        EC.visibility_of_element_located((
            By.CSS_SELECTOR,
            "button[data-automation-id='backButton'], button:has-text('Back')"
        ))
    )
    # Extra brief delay for CSS transition completion
    time.sleep(0.5)
    logger.info("✓ Page 2 loaded successfully.")

def fill_page_1(driver, wait, data):
    """Fills questions on Page 1."""
    logger.info("Filling Page 1...")
    q_items = driver.find_elements(By.CSS_SELECTOR, "div[data-automation-id='questionItem']")
    
${schema.page1.questions.map((q, idx) => {
  const fieldKey = q.id;
  const qNum = q.number;
  if (q.type === 'dropdown') {
    return `    # Question ${qNum}: ${q.title} (Dropdown)
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey} and len(q_items) > ${idx}:
        combobox = q_items[${idx}].find_element(By.CSS_SELECTOR, "div[role='combobox'], div[data-automation-id='selectQuestionDropdown'], input")
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", combobox)
        combobox.click()
        time.sleep(0.3)
        opt = driver.find_element(By.XPATH, f"//div[@role='option'][contains(., '{val_${fieldKey}}')] | //span[contains(., '{val_${fieldKey}}')]")
        driver.execute_script("arguments[0].click();", opt)
        time.sleep(0.2)`;
  } else if (q.type === 'text' || q.type === 'textarea') {
    return `    # Question ${qNum}: ${q.title}
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey} and len(q_items) > ${idx}:
        elem = q_items[${idx}].find_element(By.CSS_SELECTOR, "input, textarea")
        elem.clear()
        elem.send_keys(val_${fieldKey})
        time.sleep(0.2)`;
  } else if (q.type === 'date') {
    return `    # Question ${qNum}: ${q.title} (Date)
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey} and len(q_items) > ${idx}:
        elem = q_items[${idx}].find_element(By.CSS_SELECTOR, "input[data-automation-id='dateInput'], input[type='text'], input")
        elem.clear()
        elem.send_keys(val_${fieldKey})
        time.sleep(0.2)`;
  } else if (q.type === 'radio') {
    return `    # Question ${qNum}: ${q.title} (Radio)
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey} and len(q_items) > ${idx}:
        option_xpath = f".//*[contains(text(), '{val_${fieldKey}}') or @value='{val_${fieldKey}}']"
        opt = q_items[${idx}].find_element(By.XPATH, option_xpath)
        driver.execute_script("arguments[0].click();", opt)
        time.sleep(0.2)`;
  } else if (q.type === 'checkbox') {
    return `    # Question ${qNum}: ${q.title} (Checkbox)
    val_${fieldKey} = str(data.get("${fieldKey}", "${Array.isArray(q.defaultValue) ? q.defaultValue.join(';') : (q.defaultValue || '')}"))
    if val_${fieldKey} and len(q_items) > ${idx}:
        for item in [x.strip() for x in val_${fieldKey}.split(';') if x.strip()]:
            chk = q_items[${idx}].find_element(By.XPATH, f".//*[contains(text(), '{item}')]")
            driver.execute_script("arguments[0].click();", chk)
            time.sleep(0.15)`;
  } else {
    return `    # Question ${qNum}: ${q.title}
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey} and len(q_items) > ${idx}:
        q_items[${idx}].find_element(By.CSS_SELECTOR, "input").send_keys(val_${fieldKey})`;
  }
}).join('\n\n')}

def fill_page_2(driver, wait, data):
    """Fills questions on Page 2."""
    logger.info("Filling Page 2...")
    q_items = driver.find_elements(By.CSS_SELECTOR, "div[data-automation-id='questionItem']")
    
${schema.page2.questions.map((q, idx) => {
  const fieldKey = q.id;
  const qNum = q.number;
  if (q.type === 'dropdown') {
    return `    # Question ${qNum}: ${q.title} (Dropdown)
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey} and len(q_items) > ${idx}:
        combobox = q_items[${idx}].find_element(By.CSS_SELECTOR, "div[role='combobox'], div[data-automation-id='selectQuestionDropdown'], input")
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", combobox)
        combobox.click()
        time.sleep(0.3)
        opt = driver.find_element(By.XPATH, f"//div[@role='option'][contains(., '{val_${fieldKey}}')] | //span[contains(., '{val_${fieldKey}}')]")
        driver.execute_script("arguments[0].click();", opt)
        time.sleep(0.2)`;
  } else if (q.type === 'text' || q.type === 'textarea') {
    return `    # Question ${qNum}: ${q.title}
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey} and len(q_items) > ${idx}:
        elem = q_items[${idx}].find_element(By.CSS_SELECTOR, "input, textarea")
        elem.clear()
        elem.send_keys(val_${fieldKey})
        time.sleep(0.2)`;
  } else if (q.type === 'radio') {
    return `    # Question ${qNum}: ${q.title} (Radio)
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey} and len(q_items) > ${idx}:
        opt = q_items[${idx}].find_element(By.XPATH, f".//*[contains(text(), '{val_${fieldKey}}')]")
        driver.execute_script("arguments[0].click();", opt)
        time.sleep(0.2)`;
  } else if (q.type === 'checkbox') {
    return `    # Question ${qNum}: ${q.title} (Checkbox)
    val_${fieldKey} = str(data.get("${fieldKey}", "${Array.isArray(q.defaultValue) ? q.defaultValue.join(';') : (q.defaultValue || '')}"))
    if val_${fieldKey} and len(q_items) > ${idx}:
        for item in [x.strip() for x in val_${fieldKey}.split(';') if x.strip()]:
            chk = q_items[${idx}].find_element(By.XPATH, f".//*[contains(text(), '{item}')]")
            driver.execute_script("arguments[0].click();", chk)
            time.sleep(0.15)`;
  } else if (q.type === 'rating') {
    return `    # Question ${qNum}: ${q.title} (Rating)
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || '5'}"))
    if val_${fieldKey} and len(q_items) > ${idx}:
        stars = q_items[${idx}].find_elements(By.CSS_SELECTOR, "span[data-automation-id='ratingItem'], div[role='radiogroup'] span")
        idx_to_click = min(int(val_${fieldKey}) - 1, len(stars) - 1)
        if idx_to_click >= 0 and idx_to_click < len(stars):
            stars[idx_to_click].click()
            time.sleep(0.2)`;
  } else {
    return `    # Question ${qNum}: ${q.title}
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey} and len(q_items) > ${idx}:
        q_items[${idx}].find_element(By.CSS_SELECTOR, "input").send_keys(val_${fieldKey})`;
  }
}).join('\n\n')}

def submit_and_confirm(driver, wait):
    """Submits the form and checks for the completion message."""
    logger.info("Submitting form...")
    submit_btn = wait.until(
        EC.element_to_be_clickable((
            By.CSS_SELECTOR,
            "button[data-automation-id='submitButton'], button:has-text('Submit')"
        ))
    )
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", submit_btn)
    time.sleep(0.3)
    submit_btn.click()
    
    # Confirmation screen
    wait.until(
        EC.visibility_of_element_located((
            By.XPATH,
            "//*[contains(text(), 'Your response was submitted') or @data-automation-id='thankYouMessage']"
        ))
    )
    logger.info("✓ Verified response submission confirmation.")

def main():
    logger.info("Starting Selenium Microsoft Forms Submitter")
    driver = init_driver()
    wait = WebDriverWait(driver, TIMEOUT_SECONDS)
    
    ${isBatch ? `if not os.path.exists("${csvFile}"):
        logger.error(f"Cannot find batch file: ${csvFile}")
        return
    df = pd.read_csv("${csvFile}")
    records = df.to_dict(orient="records")` : `records = [{
${schema.page1.questions.map(q => `        "${q.id}": "${q.defaultValue || ''}",`).join('\n')}
${schema.page2.questions.map(q => `        "${q.id}": "${Array.isArray(q.defaultValue) ? q.defaultValue.join(';') : (q.defaultValue || '')}",`).join('\n')}
    }]`}
    
    try:
        for idx, row in enumerate(records, start=1):
            logger.info(f"Processing submission #{idx} of {len(records)}...")
            driver.get(FORM_URL)
            time.sleep(1.5) # Wait for initial hydration
            
            fill_page_1(driver, wait, row)
            wait_and_click_next(driver, wait)
            fill_page_2(driver, wait, row)
            submit_and_confirm(driver, wait)
            
            if idx < len(records):
                delay = random.uniform(2.0, 4.0)
                logger.info(f"Waiting {delay:.1f}s before next entry...")
                time.sleep(delay)
                
        logger.info("All records processed successfully!")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
`;
}
