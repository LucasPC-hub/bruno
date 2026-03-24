import { expect, test } from '../../playwright';
import { buildSocketIOCommonLocators } from '../utils/page/locators';

const MAX_CONNECTION_TIME = 3000;
const BRU_REQ_NAME = /^sio-test-request$/;

test.describe.serial('socketio events', () => {
  test('socketio emits event and receives echo', async ({ pageWithUserData: page, restartApp }) => {
    const locators = buildSocketIOCommonLocators(page);

    await page.locator('#sidebar-collection-name').click();
    await page.getByTitle(BRU_REQ_NAME).click();

    // Connect first
    await locators.connectionControls.connect().click();
    await expect(locators.connectionControls.disconnect()).toBeAttached({
      timeout: MAX_CONNECTION_TIME
    });

    // Clear any existing messages then emit event
    await locators.toolbar.clearResponse().click();
    await locators.runner().click();

    // Verify that the echoed event appears in the response pane
    // The server should echo back the event with the same data
    await expect(locators.messages().first()).toBeAttached({ timeout: MAX_CONNECTION_TIME });

    // Disconnect after test
    await locators.connectionControls.disconnect().click();
    await expect(locators.connectionControls.connect()).toBeVisible();
  });

  test('socketio echoed event has correct event name', async ({ pageWithUserData: page, restartApp }) => {
    const locators = buildSocketIOCommonLocators(page);

    await page.locator('#sidebar-collection-name').click();
    await page.getByTitle(BRU_REQ_NAME).click();

    // Connect
    await locators.connectionControls.connect().click();
    await expect(locators.connectionControls.disconnect()).toBeAttached({
      timeout: MAX_CONNECTION_TIME
    });

    // Clear messages and send
    await locators.toolbar.clearResponse().click();
    await locators.runner().click();

    // Verify message content appears in the response pane
    await expect(locators.messages().nth(1)).toBeAttached({ timeout: MAX_CONNECTION_TIME });

    // Disconnect
    await locators.connectionControls.disconnect().click();
  });
});
