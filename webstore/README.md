# Chrome Web Store package review

[`candidate/`](candidate/) is the patched **3.50.17** review candidate. It starts from the installed Web Store package and selectively incorporates current beta source updates and security fixes while retaining its Web Store exclusions.

See [`UPDATE_REVIEW.md`](UPDATE_REVIEW.md) for the server-mode diagnosis, backport scope, preserved restrictions, validation, and remaining deployment limits. [`candidate.sha256.json`](candidate.sha256.json) records every candidate file. Load `candidate/` as an unpacked extension for review; do not load the parent `webstore/` folder.

The focused follow-up fixes and verification are recorded in [`FOLLOWUP_REVIEW.md`](FOLLOWUP_REVIEW.md).

## Original installed package

`3.50.10/` is an unchanged copy of the installed Social Stream Ninja extension package.

- Extension ID: `cppibjhfemifednoimlblfcmjgfhfjeg`
- Manifest version: `3.50.10`
- Copied at (UTC): `2026-09-26T21:19:36.457134+00:00`
- Source: `C:\Users\darkhorse\AppData\Local\Google\Chrome\User Data\Default\Extensions\cppibjhfemifednoimlblfcmjgfhfjeg\3.50.10_0`
- Verification: all 773 packaged files match the installed originals by relative path, size, and SHA-256.
- Inventory and provenance: [`3.50.10.sha256.json`](3.50.10.sha256.json).

This snapshot includes the installed manifest and Chrome package metadata. It contains packaged files only; Chrome profile settings and extension storage were not copied.

Compare the original [`popup.js`](3.50.10/popup.js) with the candidate [`popup.js`](candidate/popup.js), especially `handleBothParam`.
