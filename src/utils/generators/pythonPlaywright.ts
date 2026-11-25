import { FormSchema, AutomationSettings } from '../../types/form';
import { USER_TENANT_ID, USER_OWNER_ID, USER_FORM_ID } from '../defaultForm';

export function generatePlaywrightScript(schema: FormSchema, settings: AutomationSettings): string {
  const isBatch = settings.executionMode === 'batch_csv';
  const csvFile = settings.csvFileName || 'form_data.csv';

  return `"""
Automated 2-Page Microsoft Forms Submitter using Playwright
Target Form: ${schema.title}
Form URL: ${schema.formUrl}
Pagination: 2 Pages (Page 1 -> Next button -> Page 2 -> Submit button)

Requirements:
  pip install playwright pandas requests
  playwright install chromium
"""

import sys
import os
import time
import random
import logging
import json
${isBatch ? 'import pandas as pd' : ''}
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger("MSFormsAutomator")

FORM_URL = "${schema.formUrl}"
HEADLESS = ${settings.headless ? 'True' : 'False'}
TIMEOUT_MS = ${settings.timeoutSeconds * 1000}
TAKE_SCREENSHOTS = ${settings.takeScreenshots ? 'True' : 'False'}

def human_delay(min_s=0.2, max_s=0.7):
    """Simulates realistic pauses between actions to prevent anti-bot throttling."""
    ${settings.humanTypingDelay ? 'time.sleep(random.uniform(min_s, max_s))' : 'pass'}

def wait_and_click_next(page):
    """
    CRITICAL PAGINATION HANDLER:
    1. Locates the 'Next' button on Page 1.
    2. Clicks the button.
    3. Explicitly waits for Page 2 elements to hydrate into the DOM.
       Microsoft Forms uses client-side transitions, so checking for the 'Back'
       button or Page 2 question container is required to avoid premature interaction.
    """
    logger.info("--> Navigating from Page 1 to Page 2...")
    
    # Robust multi-fallback locator for the Next button in Microsoft Forms
    next_button = page.locator(
        'button[data-automation-id="nextButton"], '
        'button:has-text("Next"), '
        'button[aria-label="Next"]'
    ).first
    
    if not next_button.is_visible(timeout=5000):
        raise RuntimeError("Next button not visible. Check if required fields on Page 1 are missing or invalid.")
    
    next_button.scroll_into_view_if_needed()
    human_delay(0.2, 0.4)
    next_button.click()
    
    # 1. Wait for Back button to appear (only exists on page 2+)
    page.wait_for_selector(
        'button[data-automation-id="backButton"], button:has-text("Back")',
        state="visible",
        timeout=10000
    )
    
    # 2. Wait for question items to hydrate
    page.wait_for_selector('div[data-automation-id="questionItem"]', state="visible", timeout=10000)
    
    # Small hydration grace period for CSS slide animations
    page.wait_for_timeout(450)
    logger.info("✓ Successfully transitioned to Page 2 (DOM Hydrated)")

def fill_page_1(page, data):
    """Fills all fields on Page 1."""
    logger.info("Filling Page 1 fields...")
    
${schema.page1.questions.map((q, idx) => {
  const fieldKey = q.id;
  const qNum = q.number;
  if (q.type === 'dropdown') {
    return `    # Question ${qNum}: ${q.title} (Dropdown)
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey}:
        q_elem = page.locator('div[data-automation-id="questionItem"]').nth(${idx})
        combobox = q_elem.locator('div[role="combobox"], button[role="combobox"], div[data-automation-id="selectQuestionDropdown"], input[role="combobox"]').first
        combobox.scroll_into_view_if_needed()
        combobox.click()
        human_delay(0.2, 0.4)
        option = page.locator(f'div[role="option"]:has-text("{val_${fieldKey}}"), span:has-text("{val_${fieldKey}}")').first
        option.scroll_into_view_if_needed()
        option.click()
        human_delay()`;
  } else if (q.type === 'text' || q.type === 'textarea') {
    return `    # Question ${qNum}: ${q.title}
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey}:
        q_elem = page.locator('div[data-automation-id="questionItem"]').nth(${idx})
        text_input = q_elem.locator('input[data-automation-id="textInput"], textarea[data-automation-id="textInput"], input[type="text"]').first
        text_input.click()
        text_input.fill(val_${fieldKey})
        human_delay()`;
  } else if (q.type === 'radio') {
    return `    # Question ${qNum}: ${q.title} (Radio Choice)
    choice_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if choice_${fieldKey}:
        q_elem = page.locator('div[data-automation-id="questionItem"]').nth(${idx})
        option_elem = q_elem.locator(f'label:has-text("{choice_${fieldKey}}"), div[data-automation-id="choiceItem"]:has-text("{choice_${fieldKey}}")').first
        option_elem.scroll_into_view_if_needed()
        option_elem.click()
        human_delay()`;
  } else if (q.type === 'checkbox') {
    return `    # Question ${qNum}: ${q.title} (Multi-select Checkbox)
    cb_val_${fieldKey} = str(data.get("${fieldKey}", "${Array.isArray(q.defaultValue) ? q.defaultValue.join(';') : (q.defaultValue || '')}"))
    if cb_val_${fieldKey}:
        q_elem = page.locator('div[data-automation-id="questionItem"]').nth(${idx})
        for item in [x.strip() for x in cb_val_${fieldKey}.split(';') if x.strip()]:
            chk = q_elem.locator(f'label:has-text("{item}"), div[data-automation-id="choiceItem"]:has-text("{item}")').first
            chk.scroll_into_view_if_needed()
            chk.click()
            human_delay(0.2, 0.4)`;
  } else if (q.type === 'date') {
    return `    # Question ${qNum}: ${q.title} (Date)
    date_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if date_${fieldKey}:
        q_elem = page.locator('div[data-automation-id="questionItem"]').nth(${idx})
        date_input = q_elem.locator('input[data-automation-id="dateInput"], input[type="text"]').first
        date_input.click()
        date_input.fill(date_${fieldKey})
        human_delay()`;
  } else {
    return `    # Question ${qNum}: ${q.title}
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey}:
        page.locator('div[data-automation-id="questionItem"]').nth(${idx}).locator('input').first.fill(val_${fieldKey})`;
  }
}).join('\n\n')}

def fill_page_2(page, data):
    """Fills all fields on Page 2."""
    logger.info("Filling Page 2 fields...")
    
${schema.page2.questions.map((q, idx) => {
  const fieldKey = q.id;
  const qNum = q.number;
  if (q.type === 'dropdown') {
    return `    # Question ${qNum}: ${q.title} (Dropdown)
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey}:
        q_elem = page.locator('div[data-automation-id="questionItem"]').nth(${idx})
        combobox = q_elem.locator('div[role="combobox"], button[role="combobox"], div[data-automation-id="selectQuestionDropdown"], input[role="combobox"]').first
        combobox.scroll_into_view_if_needed()
        combobox.click()
        human_delay(0.2, 0.4)
        option = page.locator(f'div[role="option"]:has-text("{val_${fieldKey}}"), span:has-text("{val_${fieldKey}}")').first
        option.scroll_into_view_if_needed()
        option.click()
        human_delay()`;
  } else if (q.type === 'text' || q.type === 'textarea') {
    return `    # Question ${qNum}: ${q.title}
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey}:
        q_elem = page.locator('div[data-automation-id="questionItem"]').nth(${idx})
        text_input = q_elem.locator('input[data-automation-id="textInput"], textarea[data-automation-id="textInput"], textarea').first
        text_input.click()
        text_input.fill(val_${fieldKey})
        human_delay()`;
  } else if (q.type === 'radio') {
    return `    # Question ${qNum}: ${q.title} (Radio Choice)
    choice_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if choice_${fieldKey}:
        q_elem = page.locator('div[data-automation-id="questionItem"]').nth(${idx})
        option_elem = q_elem.locator(f'label:has-text("{choice_${fieldKey}}"), div[data-automation-id="choiceItem"]:has-text("{choice_${fieldKey}}")').first
        option_elem.scroll_into_view_if_needed()
        option_elem.click()
        human_delay()`;
  } else {
    return `    # Question ${qNum}: ${q.title}
    val_${fieldKey} = str(data.get("${fieldKey}", "${q.defaultValue || ''}"))
    if val_${fieldKey}:
        page.locator('div[data-automation-id="questionItem"]').nth(${idx}).locator('input').first.fill(val_${fieldKey})`;
  }
}).join('\n\n')}

def submit_form(page):
    """
    Submits the 2-page Microsoft Form and verifies response confirmation.
    """
    logger.info("Submitting response...")
    submit_btn = page.locator(
        'button[data-automation-id="submitButton"], '
        'button:has-text("Submit"), '
        'div[data-automation-id="buttonWrapper"] button:has-text("Submit")'
    ).first
    
    submit_btn.scroll_into_view_if_needed()
    human_delay(0.2, 0.5)
    submit_btn.click()
    
    # Wait for Microsoft Forms confirmation screen
    logger.info("Waiting for submission confirmation receipt...")
    page.wait_for_selector(
        'div[data-automation-id="thankYouMessage"], '
        'div.thank-you-page-root, '
        'text="Your response was submitted"',
        state="visible",
        timeout=15000
    )
    logger.info("✓ SUBMISSION SUCCESSFUL: Verified thank you confirmation.")
    
    if TAKE_SCREENSHOTS:
        timestamp = int(time.time())
        page.screenshot(path=f"submission_success_{timestamp}.png")
        logger.info(f"Saved confirmation screenshot: submission_success_{timestamp}.png")

def process_single_submission(browser, row_data, submission_idx=1):
    """Opens a fresh browser context and carries out the 2-page submission."""
    context = browser.new_context(
        viewport={'width': 1280, 'height': 850},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    )
    page = context.new_page()
    page.set_default_timeout(TIMEOUT_MS)
    
    try:
        logger.info(f"\\n================ SUBMISSION #{submission_idx} ================")
        logger.info(f"Opening form URL: {FORM_URL}")
        page.goto(FORM_URL, wait_until="networkidle")
        
        # Step 1: Fill Page 1
        fill_page_1(page, row_data)
        
        # Step 2: Handle Pagination (Click Next & Wait)
        wait_and_click_next(page)
        
        # Step 3: Fill Page 2
        fill_page_2(page, row_data)
        
        # Step 4: Submit
        submit_form(page)
        return True
        
    except Exception as e:
        logger.error(f"❌ Error during submission #{submission_idx}: {str(e)}")
        if TAKE_SCREENSHOTS:
            try:
                page.screenshot(path=f"error_submission_{submission_idx}.png")
                logger.info(f"Saved error screenshot to error_submission_{submission_idx}.png")
            except Exception:
                pass
        return False
    finally:
        context.close()

def main():
    logger.info("Starting Microsoft Forms 2-Page Automator (Playwright)")
    
    ${isBatch ? `# Load data from CSV
    if not os.path.exists("${csvFile}"):
        logger.error(f"Batch file '${csvFile}' not found. Please create it or generate one from the dashboard.")
        sys.exit(1)
        
    df = pd.read_csv("${csvFile}")
    records = df.to_dict(orient="records")
    logger.info(f"Loaded {len(records)} records from ${csvFile}")` : `# Single test payload
    records = [{
${schema.page1.questions.map(q => `        "${q.id}": "${q.defaultValue || ''}",`).join('\n')}
${schema.page2.questions.map(q => `        "${q.id}": "${Array.isArray(q.defaultValue) ? q.defaultValue.join(';') : (q.defaultValue || '')}",`).join('\n')}
    }]
    logger.info("Running single submission with SOAR form parameters.")`}
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=HEADLESS,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox"
            ]
        )
        
        success_count = 0
        for i, record in enumerate(records, start=1):
            success = process_single_submission(browser, record, submission_idx=i)
            if success:
                success_count += 1
            
            # Anti-throttling delay between multiple submissions
            if i < len(records):
                delay = random.uniform(2.0, 4.0)
                logger.info(f"Cooling down {delay:.1f}s before next submission...")
                time.sleep(delay)
                
        browser.close()
        logger.info(f"All done! Completed {success_count}/{len(records)} submissions successfully.")

if __name__ == "__main__":
    main()
`;
}
