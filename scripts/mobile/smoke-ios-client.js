// Loaded only into the simulator smoke build.
(async function smoke() {
  const api = 'https://127.0.0.1:18443';
  const delay = () => new Promise((resolve) => setTimeout(resolve, 100));
  const find = async (lookup, label) => {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const value = lookup();
      if (value) return value;
      await delay();
    }
    throw new Error('Timed out waiting for ' + label);
  };
  const visible = (el) => el.getClientRects().length > 0;
  const button = (label, scope = document) => find(
    () => [...scope.querySelectorAll('button')].find((el) => visible(el) && !el.disabled
      && (el.getAttribute('aria-label') || el.textContent.trim()) === label), label,
  );
  const input = (selector) => find(() => document.querySelector(selector), selector);
  function fill(el, text) {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  let error = null;
  try {
    await find(() => window.Capacitor?.getPlatform() === 'ios', 'the iOS bridge');
    (await button('Map')).click();
    await find(() => document.querySelector('.community-map'), 'the community map');
    // Leave the map mounted while the resources effect runs.
    await new Promise((resolve) => setTimeout(resolve, 700));
    (await button('Ask for help')).click();
    const survey = await input('.help-survey');
    (await input('.help-survey input[value="other"]')).click();
    (await button('Next', survey)).click();
    fill(await input('.help-survey textarea'), 'Synthetic request from the simulator');
    (await button('Next', survey)).click();
    (await button('Send request', survey)).click();
    await find(() => survey.textContent.includes('cf-EXAMPL'), 'the server request code');
    (await button('Me')).click();
    const staff = await find(() => [...document.querySelectorAll('button')]
      .find((el) => visible(el) && el.textContent.trim().startsWith('Staff sign in')), 'Staff sign in');
    staff.click();
    fill(await input('input[type="password"]'), 'synthetic-staff-key');
    (await button('Sign in')).click();
    await find(() => document.querySelector('table[aria-label="Incoming request dispatch table"]'), 'the coordinator queue');
  } catch (err) {
    error = String(err);
  }
  await fetch(api + '/smoke-result', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ error }),
  });
})();
