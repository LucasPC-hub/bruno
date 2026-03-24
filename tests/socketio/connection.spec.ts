import { expect, test } from '../../playwright';
import { buildSocketIOCommonLocators } from '../utils/page/locators';

const MAX_CONNECTION_TIME = 3000;
const BRU_REQ_NAME = /^sio-test-request$/;

test.describe.serial('socketio', () => {
  test('socketio requests are visible', async ({ pageWithUserData: page, restartApp }) => {
    await page.locator('#sidebar-collection-name').click();

    expect(page.locator('span.item-name').filter({ hasText: BRU_REQ_NAME })).toBeVisible();
  });

  test('socketio connects', async ({ pageWithUserData: page, restartApp }) => {
    const locators = buildSocketIOCommonLocators(page);

    // Attempt a connection for the specified request
    await page.getByTitle(BRU_REQ_NAME).click();
    await locators.connectionControls.connect().click();

    // See if the socket connected by monitoring the opposite state
    await expect(locators.connectionControls.disconnect()).toBeAttached({
      timeout: MAX_CONNECTION_TIME
    });
  });

  test('socketio closes', async ({ pageWithUserData: page, restartApp }) => {
    const locators = buildSocketIOCommonLocators(page);
    await locators.connectionControls.disconnect().click();

    // See if the socket disconnected by monitoring the opposite state
    await expect(locators.connectionControls.connect()).toBeVisible();
  });

  test('socketio connection events were recorded', async ({ pageWithUserData: page, restartApp }) => {
    const locators = buildSocketIOCommonLocators(page);

    // Hard validate the received messages to confirm the connection state
    await expect(locators.messages().first().getByText('Connected to http://')).toBeAttached();
    await expect(locators.messages().nth(1).getByText('Disconnected')).toBeAttached();
  });
});
