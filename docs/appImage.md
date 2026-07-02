# SocialStream.ninja AppImage Sandbox Error Fix

![image](https://github.com/user-attachments/assets/841ffc65-c799-489a-a16c-8b2aa26fcbe2)

## Problem
When running the SocialStream.ninja AppImage, users may encounter this error:
```
FATAL:setuid_sandbox_host.cc(163): The SUID sandbox helper binary was found, but is not configured correctly. Rather than run without sandboxing I'm aborting now. You need to make sure that /tmp/.mount_socialRwnnm/chrome-sandbox is owned by root and has mode 4755.
```

## Solution
Create an AppArmor profile to allow the application to run with unprivileged namespaces:

1. Create a file at `/etc/apparmor.d/obsidianappimage` (or appropriate name for your app) with:
```
# This profile allows everything and only exists to give the
# application a name instead of having the label "unconfined"

abi <abi/4.0>,
include <tunables/global>

profile obsidianappimage /path/to/YourAppImage flags=(default_allow) {
  userns,
  
  # Site-specific additions and overrides. See local/README for details.
  include if exists <local/obsidianappimage>
}
```

2. Replace `/path/to/YourAppImage` with the actual path to your AppImage file

3. Save the file and run:
```
sudo systemctl reload apparmor.service
```

4. If that doesn't work, reboot your system

This solution allows AppImages that use Chrome/Electron to run without SUID sandbox configuration issues on systems with restricted user namespaces.

![image](https://github.com/user-attachments/assets/1a4620a5-24d1-46a3-82cb-cef569bcc8d1)
