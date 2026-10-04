// Shipping an over-the-air update, with the variant held on from end to end.
//
// This exists because of a real failure, on 5 October 2026: the design channel
// was given a build of the *production* variant. Every screen of the redesign
// is gated on IS_DESIGN, which reads extra.variant out of the manifest, so the
// whole redesign vanished from the phone in one go and the app looked a year
// old again.
//
// The trap is that four different commands each evaluate app.config.js:
//
//   expo export                 builds the bundle
//   sentry-expo-upload-sourcemaps  can re-export while it works
//   eas update                  re-bundles unless told not to, AND builds the
//                               manifest that actually carries extra.variant
//
// Setting APP_VARIANT on only one of them is not a partial fix, it is no fix:
// the manifest is written by the last of them. So the variant is set once here,
// for the whole chain, and the chain is checked at both ends — the export must
// stay the single Android bundle we made, and the channel must afterwards serve
// the variant we asked for. A silent wrong answer is the thing being prevented,
// so neither check is allowed to pass quietly.
//
//   node scripts/ota.mjs design "message"
//   node scripts/ota.mjs preview "message"

import { execFileSync } from 'child_process';
import { readFileSync, rmSync, existsSync } from 'fs';

const CHANNELS = {
  design: { variant: 'design', name: 'Pond (test)' },
  preview: { variant: 'production', name: 'Duo Tracker' },
};

const [channel, ...rest] = process.argv.slice(2);
const message = rest.join(' ').trim();
const want = CHANNELS[channel];

if (!want) {
  console.error(`usage: node scripts/ota.mjs <${Object.keys(CHANNELS).join('|')}> "message"`);
  process.exit(2);
}
if (!message) {
  console.error('a message is required: it is the only thing that says what a bundle id means later');
  process.exit(2);
}

// APP_VARIANT is read by app.config.js. Every child process inherits it.
const env = { ...process.env, APP_VARIANT: want.variant === 'design' ? 'design' : '' };
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', env, shell: true });

const platformsInDist = () => {
  const meta = JSON.parse(readFileSync('dist/metadata.json', 'utf8'));
  return Object.keys(meta.fileMetadata).sort();
};

// A bundle for a platform we did not ask for means something re-exported behind
// us, with its own idea of the config — which is exactly how the variant was
// lost. Android only, because that is the only platform this app ships to.
const expectAndroidOnly = (after) => {
  const got = platformsInDist();
  if (got.length !== 1 || got[0] !== 'android') {
    throw new Error(`${after}: dist holds [${got}], so something re-exported it — the variant in it cannot be trusted`);
  }
  console.log(`  ✓ ${after}: dist is the Android bundle we made`);
};

console.log(`\n→ ${channel}: building as ${want.variant}\n`);

if (existsSync('dist')) rmSync('dist', { recursive: true, force: true });

run('npx', ['expo', 'export', '--dump-sourcemap', '--platform', 'android']);
expectAndroidOnly('after export');

run('npx', ['sentry-expo-upload-sourcemaps', 'dist']);
expectAndroidOnly('after sourcemaps');

// --input-dir and --skip-bundler so the bundle just checked is the bundle that
// ships, instead of one eas builds again out of sight.
run('npx', [
  'eas-cli',
  'update',
  '--branch',
  channel,
  '--input-dir',
  'dist',
  '--skip-bundler',
  '--message',
  JSON.stringify(message),
  '--non-interactive',
]);

// The end of the chain, and the only check that speaks for the phone: ask the
// channel for the manifest a phone would be given, and read the variant out of
// the answer. Everything above can be right and this still be wrong.
const projectId = JSON.parse(readFileSync('app.json', 'utf8')).expo.extra.eas.projectId;
const runtimeVersion = JSON.parse(readFileSync('app.json', 'utf8')).expo.version;

const res = await fetch(`https://u.expo.dev/${projectId}`, {
  headers: {
    'expo-platform': 'android',
    'expo-channel-name': channel,
    'expo-runtime-version': runtimeVersion,
    'expo-protocol-version': '1',
    accept: 'multipart/mixed',
  },
});
const served = await res.text();
const variant = served.match(/"variant":"([a-z]+)"/)?.[1];
const name = served.match(/"name":"([^"]+)"/)?.[1];

console.log(`\n  channel ${channel} now serves: ${name} / variant ${variant}`);

if (variant !== want.variant) {
  console.error(
    `\n✗ WRONG BUILD ON ${channel.toUpperCase()}: serving "${variant}", expected "${want.variant}".` +
      `\n  A phone on this channel will run the other app's screens. Publish again before walking away.\n`
  );
  process.exit(1);
}

console.log(`✓ ${channel} is serving ${want.name}\n`);
