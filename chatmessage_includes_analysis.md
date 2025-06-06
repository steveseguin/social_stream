# Chat Message .includes() Analysis for HTML Sanitization

## Overview
This document analyzes all occurrences of `.chatmessage.includes()` in the codebase to identify where HTML sanitization might be missing and where using `data.textContent` or `data.textonly` would be more appropriate.

## Key Findings

### 1. background.js

#### Line 3659: Filter Events Toggle
```javascript
if (settings.filterevents.textsetting.split(",").some(v => (v.trim() && message.chatmessage.includes(v))))
```
**Issue**: Checking raw HTML content for event filtering
**Recommendation**: Should use `message.textContent` or `message.textonly` to avoid HTML tags interfering with matches

#### Line 4077 & 4688: Translation Check
```javascript
if (data.chatmessage.includes(miscTranslations.said))
```
**Issue**: Checking for translation text in raw HTML
**Recommendation**: Use `data.textContent` to ensure HTML doesn't interfere

#### Line 8368: Relay All Check
```javascript
if (settings.relayall && data.chatmessage && !data.event && tab && data.chatmessage.includes(miscTranslations.said))
```
**Issue**: Same translation check issue
**Recommendation**: Use `data.textContent`

#### Line 8458: Bot Reply Message Matching
```javascript
const messageMatches = isFullMatch ? 
  data.chatmessage === command :
  data.chatmessage.includes(command);
```
**Issue**: Bot commands matching against raw HTML
**Recommendation**: Critical - should use `data.textContent` to prevent HTML injection in commands

#### Line 8528 & 8535: Highlight Event/Word
```javascript
if (eventTexts.some(text => data.chatmessage.includes(text)))
if (wordTexts.some(text => data.chatmessage.includes(text)))
```
**Issue**: Highlighting based on raw HTML content
**Recommendation**: Use `data.textContent` for accurate word matching

#### Line 8544: Donation Detection
```javascript
if (data.chatmessage.includes(". Thank you") && data.chatmessage.includes(" donated "))
```
**Issue**: Detecting donation messages in raw HTML
**Recommendation**: Use `data.textContent` for reliable detection

#### Lines 8605-8610: Giphy Trigger Hiding
```javascript
if (data.chatmessage.includes("#" + word + " " + order))
```
**Issue**: String replacement on raw HTML
**Recommendation**: Need careful handling - may need both HTML and text versions

### 2. dock.html

#### Line 7458: Events Only Filter
```javascript
if (eventsOnly.some(v => !data.chatmessage.includes(v)))
```
**Issue**: Event filtering on raw HTML
**Recommendation**: Use `data.textContent` or ensure `data.textonly` is available

#### Line 7529: Filter Events
```javascript
if (filterEvents.some(v => data.chatmessage.includes(v)))
```
**Issue**: Same as above
**Recommendation**: Use `data.textContent`

#### Line 8465: TTS Command Detection
```javascript
if (TTS.ttscommand && data.chatmessage && data.chatmessage.includes(TTS.ttscommand+" "))
```
**Issue**: Critical - command detection in raw HTML
**Recommendation**: Must use `data.textContent` to prevent HTML injection

#### Lines 8481 & 8485: Bot Actions (!highlight, !pass)
```javascript
if (triggerState && data.chatmessage.includes("!highlight"))
if ((passTTS || passTTSMod) && data.chatmessage.includes("!pass"))
```
**Issue**: Critical - bot commands in raw HTML
**Recommendation**: Must use `data.textContent` for security

### 3. events.html

#### Line 397: Gift Subs Only Filter
```javascript
if (giftSubsOnly && (!data.event || !data.chatmessage.includes("gifted")))
```
**Issue**: Event detection in raw HTML
**Recommendation**: Use `data.textContent`

### 4. custom_actions.js

#### Line 122: Question Detection
```javascript
if (data.chatmessage.includes("?") && !data.bot)
```
**Issue**: Looking for "?" in raw HTML
**Recommendation**: Use `data.textContent` to avoid HTML entities

### 5. sources/tiktok.js

Multiple instances (lines 799, 859, 867, 869, 874, 903, 977, 1028, 1036, 1038, 1043) checking for:
- "joined"
- "shared"
- "followed"
- "liked"
- Gift messages with images

**Issue**: These are checking event messages that may contain HTML
**Recommendation**: Mixed - some may need HTML content (for images), others should use text-only

## Priority Recommendations

### Critical Security Issues (Must Fix):
1. **Bot command detection** (background.js:8458, dock.html:8465,8481,8485)
   - These MUST use `data.textContent` to prevent HTML injection attacks
   - Example attack: `<img src=x onerror="alert('XSS')">!command`

2. **TTS command detection** (dock.html:8465)
   - Critical for preventing TTS abuse through HTML injection

### High Priority (Functionality Issues):
1. **Event filtering** (background.js:3659, dock.html:7458,7529)
   - Will miss matches if HTML tags are present
   - Should use `data.textContent`

2. **Word/event highlighting** (background.js:8528,8535)
   - Inaccurate highlighting with HTML present

### Medium Priority (Edge Cases):
1. **Translation detection** (background.js:4077,4688,8368)
2. **Donation detection** (background.js:8544)
3. **Question detection** (custom_actions.js:122)

### Special Handling Required:
1. **Giphy trigger replacement** (background.js:8605-8610)
   - Needs to modify the HTML, not just check text
   - May need a more sophisticated approach

2. **TikTok event messages** (sources/tiktok.js)
   - Some contain important HTML (gift images)
   - Need case-by-case evaluation

## Implementation Strategy

1. Ensure `data.textContent` or `data.textonly` is consistently available across all message objects
2. Update critical security issues first (bot commands, TTS)
3. Update filtering and detection logic to use text-only content
4. Create helper functions for common patterns
5. Add tests to ensure HTML injection is prevented

## Example Fix Pattern

```javascript
// Before (vulnerable):
if (data.chatmessage.includes("!command")) {
    // process command
}

// After (secure):
if (data.textContent && data.textContent.includes("!command")) {
    // process command
}
// OR
if (data.textonly && data.textonly.includes("!command")) {
    // process command
}
```