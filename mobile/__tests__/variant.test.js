const path = require('path');

// The contract that decides which app a phone is running.
//
// Every screen of the redesign is gated on IS_DESIGN, which reads
// extra.variant off the manifest, which comes from here. On 5 October 2026 a
// build went out with this answering "production" on the design channel, and
// the entire redesign disappeared from the phone at once — no crash, no error,
// just a year-old app wearing the new icon. The publishing chain is guarded in
// scripts/ota.mjs; this guards the answer that chain is carrying.

const CONFIG = path.join(__dirname, '..', 'app.config.js');

function configFor(variant) {
  const had = Object.prototype.hasOwnProperty.call(process.env, 'APP_VARIANT');
  const before = process.env.APP_VARIANT;
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;

  // jest.resetModules and not require.cache: jest keeps its own registry, and
  // clearing the wrong one leaves the first answer standing for every later
  // call — which is how this test passed while asserting nothing.
  jest.resetModules();
  const config = require(CONFIG)();

  if (had) process.env.APP_VARIANT = before;
  else delete process.env.APP_VARIANT;
  return config;
}

describe('app.config.js', () => {
  it('makes the design build when APP_VARIANT says design', () => {
    const c = configFor('design');
    expect(c.extra.variant).toBe('design');
    expect(c.name).toBe('Pond (test)');
  });

  it('makes the real app when APP_VARIANT is unset', () => {
    const c = configFor(undefined);
    expect(c.extra.variant).toBe('production');
    expect(c.name).not.toBe('Pond (test)');
  });

  it('makes the real app for any other value, rather than guessing', () => {
    for (const value of ['', 'Design', 'DESIGN', 'preview', 'true']) {
      expect(configFor(value).extra.variant).toBe('production');
    }
  });

  it('gives the two builds different Android packages, so one never replaces the other', () => {
    const design = configFor('design');
    const real = configFor(undefined);
    expect(design.android.package).not.toBe(real.android.package);
    expect(design.android.package.startsWith(real.android.package)).toBe(true);
  });

  it('leaves the rest of app.json alone', () => {
    const design = configFor('design');
    const real = configFor(undefined);
    expect(design.slug).toBe(real.slug);
    expect(design.version).toBe(real.version);
    expect(design.extra.eas.projectId).toBe(real.extra.eas.projectId);
  });
});
