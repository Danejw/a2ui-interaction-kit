import {test, expect} from '@playwright/test';

test.beforeEach(async ({page}) => {
  page.on('pageerror', error => console.log('[pageerror]', error.message));
  page.on('console', message => {if (message.type() === 'error') console.log('[console.error]', message.text());});
  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Mission Control'})).toBeVisible();
  await expect(page.locator('[data-item-id="match-01"]')).toBeVisible();
});

test.afterEach(async ({page}, info) => {
  if (info.status !== info.expectedStatus) {
    console.log('[diagnostic DOM]', (await page.locator('body').innerText()).slice(0,3500));
    console.log('[diagnostic HTML]', (await page.locator('[data-testid="rendered-surfaces"]').innerHTML()).slice(0,2500));
  }
});

test('A2UI item expands, prioritizes, dismisses and undoes', async ({page}) => {
  const card = page.locator('[data-item-id="match-01"]');
  await card.getByRole('button',{name:'More'}).click();
  await expect(card.getByText('Compare qualifications')).toBeVisible();
  await card.getByRole('button',{name:'Prioritize',exact:true}).click();
  await expect(card.getByRole('button',{name:'Prioritized'})).toBeVisible();
  await card.getByRole('button',{name:'Item actions'}).click();
  await card.getByRole('menuitem',{name:'Dismiss'}).click();
  await expect(page.locator('[data-item-id="match-01"]')).toHaveCount(0);
  await page.getByRole('button',{name:'Undo dismiss'}).click();
  await expect(page.locator('[data-item-id="match-01"]')).toBeVisible();
});

test('A2UI outbound actions and AG-UI activity updates appear in inspector', async ({page}) => {
  await page.locator('[data-item-id="match-01"]').getByRole('button',{name:'Select'}).click();
  await expect(page.locator('[data-item-id="match-01"]').getByRole('button',{name:'Selected'})).toBeVisible();
  await expect(page.getByText('User interaction').first()).toBeVisible();
  await expect(page.getByText('A2UI surface update').first()).toBeVisible();
});

test('simulated backend failure is visible and retry succeeds', async ({page}) => {
  await page.getByRole('button',{name:'Error & Recovery'}).click();
  const card=page.locator('[data-item-id="retry-01"]');
  await expect(card).toBeVisible();
  await card.getByRole('button',{name:'Dismiss'}).click();
  await expect(page.getByRole('alert')).toContainText('Simulated backend failure');
  await expect(card).toBeVisible();
  await card.getByRole('button',{name:'Dismiss'}).click();
  await expect(card).toHaveCount(0);
});

test('permission denial cannot remove an item', async ({page}) => {
  await page.getByRole('button',{name:'Permission Denied'}).click();
  const card=page.locator('[data-item-id="restricted-01"]');
  await expect(card).toBeVisible();
  await card.getByRole('button',{name:'Dismiss'}).click();
  await expect(page.getByRole('alert')).toContainText('Permission denied');
  await expect(card).toBeVisible();
});

test('multiple surfaces remain independent', async ({page}) => {
  await page.getByRole('button',{name:'Multiple Surfaces'}).click();
  await expect(page.locator('[data-surface-id="alpha"]')).toBeVisible();
  await expect(page.locator('[data-surface-id="beta"]')).toBeVisible();
  await page.locator('[data-item-id="left-01"]').getByRole('button',{name:'Item actions'}).click();
  await page.locator('[data-item-id="left-01"]').getByRole('menuitem',{name:'Dismiss'}).click();
  await expect(page.locator('[data-item-id="left-01"]')).toHaveCount(0);
  await expect(page.locator('[data-item-id="right-01"]')).toBeVisible();
});

test('touch gesture dispatches dismiss through React pointer handlers', async ({page}) => {
  const card=page.locator('[data-item-id="match-01"]');
  await card.dispatchEvent('pointerdown',{pointerType:'touch',clientX:260,clientY:150});
  await card.dispatchEvent('pointerup',{pointerType:'touch',clientX:100,clientY:150});
  await expect(card).toHaveCount(0);
});

test('keyboard users can trigger interactions without gestures', async ({page}) => {
  const card=page.locator('[data-item-id="match-01"]');
  const button=card.getByRole('button',{name:'More'});
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(card.getByText('Compare qualifications')).toBeVisible();
});

test('resets the scenario to its initial authoritative state', async ({page}) => {
  const card=page.locator('[data-item-id="match-01"]');
  await card.getByRole('button',{name:'Dismiss'}).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button',{name:'Reset lab'}).click();
  await expect(page.locator('[data-item-id="match-01"]')).toBeVisible();
});

test('semantic card variants produce distinct contextual actions', async ({page}) => {
  const approval=page.locator('[data-item-id="match-01"]');
  await expect(approval.locator('.a2ui-interaction-item__category')).toContainText('Approval');
  await expect(approval.getByRole('button',{name:/Review/})).toBeVisible();
  await page.getByRole('button',{name:'Notification Inbox'}).click();
  const notice=page.locator('[data-item-id="notice-01"]');
  await expect(notice.locator('.a2ui-interaction-item__category')).toContainText('Notification');
  await expect(notice.getByRole('button',{name:/Read/})).toBeVisible();
  await page.getByRole('button',{name:'Review Board'}).click();
  await expect(page.locator('[data-item-id="report-01"]').locator('.a2ui-interaction-item__category')).toContainText('Report');
});

test('the inspector shows acknowledgement and verified state changes', async ({page},testInfo) => {
  const card=page.locator('[data-item-id="match-01"]');
  await card.getByRole('button',{name:'Prioritize'}).click();
  if (testInfo.project.name.includes('mobile')) {
    await page.getByRole('tab',{name:/Event trace/}).click();
  }
  await expect(page.getByText('Host confirmed the mutation').first()).toBeVisible();
  await page.getByRole('button',{name:'State synchronization'}).last().click();
  await expect(page.getByText('Verified state changes')).toBeVisible();
  await expect(page.locator('.state-diff')).toContainText('prioritized false');
});

test('mobile layout separates live preview and event trace into accessible tabs', async ({page},testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only interface');
  await expect(page.getByRole('tab',{name:/Live preview/})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab',{name:/Event trace/}).click();
  await expect(page.getByRole('tab',{name:/Event trace/})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('heading',{name:/Protocol inspector/})).toBeVisible();
  await expect(page.locator('[data-testid="rendered-surfaces"]')).toBeHidden();
  await page.getByRole('tab',{name:/Live preview/}).click();
  await expect(page.locator('[data-item-id="match-01"]')).toBeVisible();
});

test('secondary actions are keyboard accessible through an explicit menu', async ({page}) => {
  const card=page.locator('[data-item-id="match-01"]');
  await card.getByRole('button',{name:'Item actions'}).focus();
  await page.keyboard.press('Enter');
  await expect(card.getByRole('menuitem',{name:'Dismiss'})).toBeVisible();
  await card.getByRole('menuitem',{name:'Dismiss'}).focus();
  await page.keyboard.press('Enter');
  await expect(card).toHaveCount(0);
});
