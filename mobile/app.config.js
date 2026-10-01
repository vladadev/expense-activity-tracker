// Two apps from one codebase.
//
// The redesign has to be lived with for weeks before anyone else sees it, and
// over-the-air updates go to a channel both phones listen to. So the design
// build gets its own Android package name, which Android treats as a
// completely separate app: it installs alongside the real one instead of
// replacing it, keeps its own icon and its own updates, and the app the
// household actually uses carries on untouched.
//
// Same server, same account, same data — only the face differs. When the
// redesign is finished it moves to the real channel and arrives for everyone
// at once.
//
//   eas build --profile preview   -> Duo Tracker,  channel: preview
//   eas build --profile design    -> Pond (test),  channel: design
//
// app.json became this file because a package name cannot vary in JSON.

const IS_DESIGN = process.env.APP_VARIANT === 'design';

const base = require('./app.json').expo;

module.exports = () => ({
  ...base,
  name: IS_DESIGN ? 'Pond (test)' : base.name,
  android: {
    ...base.android,
    package: IS_DESIGN ? `${base.android.package}.design` : base.android.package,
    // google-services.json is keyed by package name, and the design build has a
    // different one — the Google plugin fails the build outright on "no
    // matching client". Left out here, which costs the design build push
    // notifications from the server; reminders scheduled on the phone still
    // work. To get push back, add the .design package as a second app in the
    // Firebase project and replace the file with the one that holds both.
    ...(IS_DESIGN ? { googleServicesFile: undefined } : {}),
    adaptiveIcon: {
      ...base.android.adaptiveIcon,
      // A different colour behind the icon, so the two are told apart on the
      // home screen at a glance rather than by reading the label.
      backgroundColor: IS_DESIGN ? '#0E7C66' : base.android.adaptiveIcon.backgroundColor,
    },
  },
  splash: {
    ...base.splash,
    backgroundColor: IS_DESIGN ? '#07382F' : base.splash.backgroundColor,
  },
  backgroundColor: IS_DESIGN ? '#07382F' : base.backgroundColor,
  extra: {
    ...base.extra,
    // Screens can tell which build they are running in — useful for a marker
    // that must never appear in the real app.
    variant: IS_DESIGN ? 'design' : 'production',
  },
});
