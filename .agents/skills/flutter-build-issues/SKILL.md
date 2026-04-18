---
name: flutter-build-issues
description: Troubleshooting guide for Flutter Android build errors, Kotlin version mismatches, and Gradle cache corruption.
---

# Flutter Android Build Troubleshooting

This document outlines common Android build failures in Flutter projects, specifically regarding Kotlin version mismatches and Gradle cache corruption, and provides the verified solutions.

## Issue 1: "Cannot access built-in declaration 'kotlin.Any'"

### Symptoms
When running `flutter build apk`, the build fails during the Kotlin compilation phase with errors similar to:
```
e: file:///C:/Users/USER/AppData/Local/Pub/Cache/hosted/pub.dev/package_info_plus-9.0.1/android/src/main/kotlin/dev/fluttercommunity/plus/packageinfo/PackageInfoPlugin.kt:16:1 Cannot access built-in declaration 'kotlin.Any'. Ensure that you have a dependency on the Kotlin standard library
```

### Root Cause
This error almost always indicates that the downloaded Kotlin Standard Library JAR file in the global Gradle cache is corrupted (e.g., `zip END header not found`), preventing the compiler from reading the foundational Kotlin types.

### Incorrect Attempted Fix
Do **NOT** downgrade the `org.jetbrains.kotlin.android` plugin version in `android/settings.gradle.kts` (e.g., to `1.9.24`). 
If you downgrade, modern Flutter plugins (like `share_plus` or `package_info_plus`) that are compiled with newer Kotlin metadata (e.g., `2.2.0`) will fail to compile with errors like:
```
Class 'kotlin.Unit' was compiled with an incompatible version of Kotlin. The actual metadata version is 2.2.0, but the compiler version 1.9.0 can read versions up to 2.0.0.
```

### Correct Solution
You must delete the corrupted global Gradle cache for Kotlin and force a re-download, while keeping the Kotlin plugin version up to date (>= `2.1.0`).

1. **Ensure Kotlin version is updated:**
   In `android/settings.gradle.kts`, ensure the plugin is up to date:
   ```kotlin
   id("org.jetbrains.kotlin.android") version "2.1.0" apply false
   ```

2. **Clear the Corrupted Global Gradle Cache:**
   Run the following in PowerShell to delete the cached Kotlin artifacts:
   ```powershell
   Remove-Item -Recurse -Force $env:USERPROFILE\.gradle\caches\modules-2\files-2.1\org.jetbrains.kotlin -ErrorAction SilentlyContinue
   ```

3. **Clear Project-Level Caches:**
   From the root of your Flutter project (`tenant_app`):
   ```powershell
   flutter clean
   Remove-Item -Recurse -Force .gradle -ErrorAction SilentlyContinue
   cd android
   .\gradlew clean
   cd ..
   ```

4. **Rebuild the Application:**
   ```powershell
   flutter pub get
   flutter build apk --release
   ```

## Issue 2: Transient Network Errors During Build

### Symptoms
```
Could not download kotlin-gradle-plugin-1.8.0-gradle76.jar
Connection reset
```

### Solution
Flutter's Gradle runner will typically automatically retry the build when it detects network artifacts failing to download. If it hard-fails, running the `flutter build apk --release` command a second time is usually sufficient to bypass the transient connection reset. No cache clearing is required.
