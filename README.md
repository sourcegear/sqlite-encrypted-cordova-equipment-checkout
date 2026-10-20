# Encrypted Equipment Checkout (Cordova)

This sample is a plain Cordova application that stores equipment checkout records in an encrypted SQLite database. It demonstrates the published `@sqlite-encrypted/cordova` package, SEE activation validation, keyed database open, a checked schema read, and searchable CRUD.

The database passphrase is entered on the device and retained only in memory. For a production application, store or derive it with platform security appropriate to your threat model.

## Prerequisites

- Node.js 22 or later
- An Android or iOS Cordova toolchain (including JDK 17 or later for Android)
- A standalone Gradle command for Android
- A SQLite.Encrypted activation key for the target platform

You can request an evaluation key at [sqlite.sourcegear.com/#evaluation](http://sqlite.sourcegear.com/#evaluation).

## Install

The checked-in `.npmrc` routes the `@sqlite-encrypted` scope to the SourceGear package server.

```powershell
cd sqlite-encrypted-cordova-equipment-checkout
npm install
```

Set the activation key before preparing or running the native project. Pass the raw hexadecimal key accepted by `activateSEE`; do not add the `see-` PRAGMA prefix.

```powershell
$env:SQLITE_ENCRYPTED_ACTIVATION_KEY = 'your-activation-key'
```

The configuration script writes the key to an ignored generated JavaScript file. It is packaged into the native application, so treat the built app as licensed software and do not commit the generated file.

## Android

Add the platform once:

```powershell
npm run add:android
```

The setup command installs the scoped npm package explicitly because the Cordova plugin ID (`sqlite-encrypted-cordova`) is intentionally different from its npm package name.

Cordova uses a standalone `gradle` command once to create the generated Android wrapper. The sample launcher automatically reuses a Gradle distribution already present under `~/.gradle/wrapper/dists`. If none is cached, install Gradle, add its `bin` directory to `PATH`, and verify it before continuing:

```powershell
gradle --version
```

The launcher also adds the installed Android SDK's command-line tools, platform tools, and emulator directories to the child process. This makes tools such as `apkanalyzer` available without permanently changing your system `PATH`.

Then run it on an emulator or connected device:

```powershell
npm run android
```

To build an APK without launching it:

```powershell
npm run build:android
```

## iOS

On macOS, add the platform once:

```bash
export SQLITE_ENCRYPTED_ACTIVATION_KEY='your-activation-key'
npm run add:ios
```

Then run the app:

```bash
npm run ios
```

## What to look at

- `www/js/database.js` wraps the Cordova callbacks, calls `activateSEE`, validates activation with a temporary keyed database, and owns all SQL.
- `www/js/app.js` contains the UI state and event handling.
- `scripts/configure.mjs` injects `SQLITE_ENCRYPTED_ACTIVATION_KEY` without committing it.
- `config.xml` is the Cordova application manifest.

The real database is opened with the package's keyed `openDatabase` path. The immediate `sqlite_master` query proves that an existing database was decrypted before schema or application queries run.

