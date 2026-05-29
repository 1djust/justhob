#!/bin/bash
# For full development documentation, see: ../DEVELOPMENT.md

echo "Starting DBUS session and unlocking dummy keyring for WSL2..."

# We use dbus-run-session to wrap the flutter run command.
# The -- sh -c '...' lets us run multiple commands inside the dbus session.
dbus-run-session -- sh -c '
  echo "password" | gnome-keyring-daemon --unlock
  echo "Keyring unlocked. Starting Flutter Linux desktop app..."
  flutter run -d linux
'
