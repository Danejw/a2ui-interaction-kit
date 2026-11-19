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
    console.log('[diagnostic ERROR]', await page.locator('.alert').allTextContents());
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
  if (page.viewportSize()?.width && page.viewportSize()!.width < 791) {
    await page.getByRole('tab',{name:/Event trace/}).click();
  }
  await expect(page.getByText('User interaction').first()).toBeVisible();
  await expect(page.getByText('A2UI surface update').first()).toBeVisible();
});

test('simulated backend failure is visible and retry succeeds', async ({page}) => {
  await page.getByRole('button',{name:'Error & Recovery'}).click();
  const card=page.locator('[data-item-id="retry-01"]');
  await expect(card).toBeVisible();
  await card.getByRole('button',{name:'Item actions'}).click();
  await card.getByRole('menuitem',{name:'Dismiss'}).click();
  await expect(page.locator('.alert.error')).toContainText('Simulated backend failure');
  await expect(card).toBeVisible();
  await card.getByRole('button',{name:'Item actions'}).click();
  await card.getByRole('menuitem',{name:'Dismiss'}).click();
  await expect(card).toHaveCount(0);
});

test('permission denial cannot remove an item', async ({page}) => {
  await page.getByRole('button',{name:'Permission Denied'}).click();
  const card=page.locator('[data-item-id="restricted-01"]');
  await expect(card).toBeVisible();
  await card.getByRole('button',{name:'Item actions'}).click();
  await card.getByRole('menuitem',{name:'Dismiss'}).click();
  await expect(page.locator('.alert.error')).toContainText('Permission denied');
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
  await card.getByRole('button',{name:'Item actions'}).click();
  await card.getByRole('menuitem',{name:'Dismiss'}).click();
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

test('the A2UI data explorer sorts, filters, selects and expands real data', async ({page}) => {
  await page.getByRole('button',{name:'Review Board'}).click();
  const explorer=page.getByRole('region',{name:'Agent activity overview table'});
  await expect(explorer.getByRole('table')).toBeVisible();
  await explorer.getByRole('button',{name:'Sort by Duration'}).click();
  await page.getByRole('searchbox',{name:'Search table rows'}).fill('Beta');
  await expect(explorer.getByText('Agent Beta')).toBeVisible();
  await expect(explorer.getByText('Agent Alpha')).toHaveCount(0);
  await explorer.getByRole('button',{name:'View details for Agent Beta'}).click();
  await expect(explorer.getByText('Three shortlisted candidates')).toBeVisible();
  await explorer.getByRole('checkbox',{name:'Select Agent Beta'}).check();
  await expect(page.locator('.a2ui-data-table__footer')).toContainText('1 selected');
});

test('mobile viewport does not overflow horizontally', async ({page},testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'Mobile-only layout');
  const widths=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport+1);
});

test('menu closes on Escape and returns focus to its trigger', async ({page}) => {
  const card=page.locator('[data-item-id="match-01"]');
  const trigger=card.getByRole('button',{name:'Item actions'});
  await trigger.click();
  await expect(card.getByRole('menuitem',{name:'Prioritize'})).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(card.getByRole('menuitem',{name:'Dismiss'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(card.getByRole('menuitem',{name:'Dismiss'})).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('card swipe background is concealed until an actual swipe begins', async ({page}) => {
  const metrics=await page.locator('[data-item-id="match-01"]').evaluate(card => {
    const body=card.querySelector('.a2ui-interaction-item__body') as HTMLElement;
    const hint=card.querySelector('.a2ui-interaction-item__swipe-hint') as HTMLElement;
    return {
      cardPadding:getComputedStyle(card).paddingLeft,
      bodyRight:body.getBoundingClientRect().right,
      hintRight:hint.getBoundingClientRect().right,
      swipe:getComputedStyle(body).transform
    };
  });
  expect(metrics.cardPadding).toBe('0px');
  expect(metrics.bodyRight).toBeGreaterThanOrEqual(metrics.hintRight-2);
  expect(metrics.swipe).toBe('matrix(1, 0, 0, 1, 0, 0)');
});

test('A2UI rendered surface heading has readable text contrast', async ({page}) => {
  const styles=await page.locator('.surface a2ui-basic-text .a2ui-text').first().evaluate(element => ({
    foreground:getComputedStyle(element).color,
    background:getComputedStyle(element.closest('.device-frame') as Element).backgroundColor,
  }));
  expect(styles.foreground).not.toBe('rgb(238, 238, 238)');
  expect(styles.foreground).toBe('rgb(53, 71, 97)');
});

test('mobile card controls meet a 44px touch-target goal with gesture guidance', async ({page},testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'),'Phone-specific touch check');
  const card=page.locator('[data-item-id="match-01"]');
  const target=card.getByRole('button',{name:'Item actions'});
  const bounds=await target.boundingBox();
  expect(bounds?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
  const primary=card.getByRole('button',{name:/Review/});
  const primaryBounds=await primary.boundingBox();
  expect(primaryBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
  await expect(page.getByText('Swipe a card left to dismiss')).toBeVisible();
});

test('pending feedback is host-authoritative, then error state restores without dismissal', async ({page}) => {
  await page.getByRole('button',{name:'Error & Recovery'}).click();
  await expect(page.locator('[data-item-id="retry-01"]')).toBeVisible();
  await page.locator('summary.controls-title').click();
  await page.getByLabel('Simulated latency').selectOption('900');
  const card = page.locator('[data-item-id="retry-01"]');
  await card.getByRole('button',{name:'Item actions'}).click();
  await card.getByRole('menuitem',{name:'Dismiss'}).click();
  await expect(card).toHaveAttribute('data-feedback-phase','pending');
  await expect(card.getByText('Waiting for simulated host')).toBeVisible();
  await expect(card.getByRole('button',{name:'Item actions'})).toBeDisabled();
  await expect(card).toHaveAttribute('data-feedback-phase','error');
  await expect(card.getByText('Simulated backend failure')).toBeVisible();
  await expect(card).toBeVisible();
  await card.getByRole('button',{name:'Item actions'}).click();
  await card.getByRole('menuitem',{name:'Dismiss'}).click();
  await expect(card).toHaveCount(0);
});

test('priority reorders the list only after host acknowledgement', async ({page}) => {
  const target=page.locator('[data-item-id="ingest-02"]');
  const collection=page.locator('.surface .a2ui-interaction-item');
  await expect(collection.first()).toHaveAttribute('data-item-id','match-01');
  await target.getByRole('button',{name:'Prioritize',exact:true}).click();
  await expect(collection.first()).toHaveAttribute('data-item-id','ingest-02');
  await expect(target.getByRole('button',{name:'Prioritized'})).toBeVisible();
  await expect(target).toHaveAttribute('data-feedback-phase','success');
  await expect(page.getByText('Priority saved').first()).toBeVisible();
});

test('touch drag follows a leftward gesture and springs back on cancel', async ({page}) => {
  const card=page.locator('[data-item-id="match-01"]');
  await card.dispatchEvent('pointerdown',{pointerType:'touch',clientX:270,clientY:155});
  await card.dispatchEvent('pointermove',{pointerType:'touch',clientX:235,clientY:155});
  await expect(card).toHaveClass(/is-dragging/);
  const shift=await card.locator('.a2ui-interaction-item__body').evaluate(e=>getComputedStyle(e).transform);
  expect(shift).not.toBe('matrix(1, 0, 0, 1, 0, 0)');
  await card.dispatchEvent('pointercancel',{pointerType:'touch',clientX:235,clientY:155});
  await expect(card).not.toHaveClass(/is-dragging/);
  await expect(card).toBeVisible();
  await card.dispatchEvent('pointerdown',{pointerType:'touch',clientX:270,clientY:155});
  await card.dispatchEvent('pointerup',{pointerType:'touch',clientX:100,clientY:155});
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('button',{name:/Undo dismiss/})).toBeVisible();
});

test('reduced-motion mode disables card entrance animation', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  const animation=await page.locator('[data-item-id="match-01"]').evaluate(e=>getComputedStyle(e).animationDuration);
  expect(animation).toBe('0s');
});

test('vertical touch scrolling is never mistaken for a dismiss gesture', async ({page}) => {
  const card=page.locator('[data-item-id="match-01"]');
  await card.dispatchEvent('pointerdown',{pointerType:'touch',clientX:260,clientY:160});
  await card.dispatchEvent('pointermove',{pointerType:'touch',clientX:250,clientY:255});
  await card.dispatchEvent('pointerup',{pointerType:'touch',clientX:250,clientY:255});
  await expect(card).toBeVisible();
  await expect(card).not.toHaveClass(/is-dragging|is-committing/);
  await expect(page.getByRole('button',{name:/Undo dismiss/})).toHaveCount(0);
});

test('rapid AG-UI surface updates do not produce view-transition interruption errors', async ({page}) => {
  const errors: string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.getByRole('button',{name:'Streaming Updates'}).click();
  await expect(page.locator('[data-item-id="stream-03"]')).toBeVisible();
  await page.locator('[data-item-id="stream-02"]').getByRole('button',{name:'Prioritize'}).click();
  await expect(page.locator('[data-item-id="stream-02"]').getByRole('button',{name:'Prioritized'})).toBeVisible();
  expect(errors.filter(e=>e.toLowerCase().includes('viewtransition')||e.includes('Transition was skipped'))).toEqual([]);
});
