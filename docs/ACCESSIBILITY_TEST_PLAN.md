# MauShot Accessibility & UI/UX Test Plan

## Test Environment Setup

### Required Tools
1. **Screen Readers**:
   - Windows: NVDA (free) or JAWS (paid)
   - Mac: VoiceOver (built-in)
   - Windows 10/11: Narrator (built-in)

2. **Browsers**:
   - Chrome/Edge (primary)
   - Firefox (secondary)
   - Safari (Mac only)

3. **Accessibility Testing Tools**:
   - axe DevTools Extension
   - Lighthouse (Chrome DevTools)
   - WAVE Extension
   - Keyboard only

## Test Scenarios

### 1. Main Window (index.html)

#### Keyboard Navigation
- [ ] Tab to "Select Area" button - focus indicator visible
- [ ] Tab to "Full Screen" button - focus indicator visible
- [ ] Tab to "Open Gallery" button - focus indicator visible
- [ ] Enter/Space activates each button
- [ ] Tab order is logical
- [ ] Focus visible with blue outline and shadow

#### Screen Reader
- [ ] Window title announced: "MauShot"
- [ ] Buttons announced with labels: "Select Area", "Full Screen", "Open Gallery"
- [ ] Keyboard shortcuts section read as "Keyboard shortcuts reference"
- [ ] Status bar text: "App running in system tray"

#### Visual Feedback
- [ ] Hover effects visible on all buttons
- [ ] Active states clearly shown
- [ ] Loading states show spinner animation
- [ ] Focus indicators are visible and clear

### 2. Selection Window (selection.html)

#### Keyboard Navigation
- [ ] Tab to "Full Screen" button
- [ ] Escape key cancels selection
- [ ] Enter key confirms selection
- [ ] Focus indicators visible throughout

#### Screen Reader
- [ ] Instructions announced: "Mouse Drag to select area"
- [ ] Selection dimensions announced while dragging
- [ ] Capture action announced: "Capturing selected area"
- [ ] Cancel action announced: "Selection cancelled"
- [ ] Info panel updates are announced

#### Visual Feedback
- [ ] Selection box clearly visible
- [ ] Dimensions display updates in real-time
- [ ] Button hover effects visible
- [ ] Focus indicators clear

### 3. Preview Window (preview.html)

#### Tool Selection
- [ ] Click tool buttons - active state visible
- [ ] Keyboard shortcuts work (R, A, T, H, B, V)
- [ ] Tool changes announced to screen reader
- [ ] Focus follows tool selection
- [ ] aria-pressed attributes updated

#### Canvas Interaction
- [ ] Mouse drag creates annotations
- [ ] Annotations visible immediately
- [ ] Undo (Ctrl+Z) removes last annotation
- [ ] Delete removes selected annotation
- [ ] Clear all (Ctrl+Del) removes all

#### Form Controls
- [ ] Color picker accessible with keyboard
- [ ] Line width selector keyboard accessible
- [ ] Blur amount selector keyboard accessible
- [ ] All controls have proper labels

#### Action Buttons
- [ ] Copy button shows loading state
- [ ] Save button shows loading state
- [ ] Success/error messages announced
- [ ] All buttons have visible focus

#### Keyboard Shortcuts
- [ ] Ctrl+C copies to clipboard
- [ ] Ctrl+S saves screenshot
- [ ] Ctrl+Z undoes last action
- [ ] Ctrl+N starts new screenshot
- [ ] Escape closes window
- [ ] Delete removes annotation

### 4. Gallery Window (gallery.html)

#### Navigation
- [ ] Bottom nav items keyboard accessible
- [ ] Arrow keys work in context menu
- [ ] Escape closes context menu
- [ ] Active nav item clearly indicated

#### Screenshot Cards
- [ ] Cards keyboard accessible
- [ ] Focus visible on cards
- [ ] Enter/Space opens preview
- [ ] Quick action buttons accessible
- [ ] Delete button shows focus

#### Preview Modal
- [ ] Opens with keyboard
- [ ] Focus trapped in modal
- [ ] Escape closes modal
- [ ] Action buttons accessible
- [ ] Image alt text provided

#### Empty State
- [ ] Shows when no screenshots
- [ ] Message is clear
- [ ] Announced to screen reader
- [ ] FAB button accessible

## Accessibility Audit Checklist

### WCAG 2.1 Level AA Compliance

#### Perceivable
- [ ] Alt text for all images
- [ ] Captions for video content (N/A - no video)
- [ ] Color contrast ratios met (minimum 4.5:1)
- [ ] Resize text up to 200% works
- [ ] No reliance on color alone

#### Operable
- [ ] All functionality keyboard accessible
- [ ] No keyboard trap
- [ ] Sufficient time limits (N/A - no limits)
- [ ] No flashing content (3 flashes/second)
- [ ] Help and documentation available

#### Understandable
- [ ] Language of page declared (lang="en")
- [ ] Consistent navigation
- [ ] Error identification and description
- [ ] Labels and instructions clear

#### Robust
- [ ] Compatible with assistive technologies
- [ ] Valid HTML markup
- [ ] ARIA attributes used correctly

## Screen Reader Test Scripts

### NVDA (Windows)
```
1. Launch MauShot
2. Press NVDA+Ctrl+K to open keyboard help
3. Test each window with:
   - Tab through all interactive elements
   - Use arrow keys in lists/menus
   - Press Enter on buttons
   - Listen to announcements
4. Verify all actions are announced
5. Check focus tracking is accurate
```

### VoiceOver (Mac)
```
1. Launch MauShot
2. Press Cmd+F5 to toggle VoiceOver
3. Test each window with:
   - VO+Right arrow through elements
   - VO+Space to activate
   - Listen to descriptions
4. Verify all images described
5. Check dynamic content announced
```

## Keyboard Navigation Test

### Tab Order Test
1. Start at first interactive element
2. Press Tab repeatedly through entire window
3. Verify logical order
4. Verify focus visible on each element
5. Test Shift+Tab for reverse order

### Shortcut Test
| Shortcut | Expected Action | Pass/Fail |
|----------|----------------|-----------|
| Ctrl+Shift+A | Open area selection | |
| Ctrl+Shift+F | Full screen capture | |
| Ctrl+Shift+G | Open gallery | |
| R | Rectangle tool | |
| A | Arrow tool | |
| T | Text tool | |
| H | Highlight tool | |
| B | Blur tool | |
| V | Select tool | |
| Ctrl+C | Copy to clipboard | |
| Ctrl+S | Save screenshot | |
| Ctrl+Z | Undo | |
| Ctrl+N | New screenshot | |
| Delete | Delete annotation | |
| Ctrl+Del | Clear all | |
| Escape | Close/cancel | |

## Visual Feedback Test

### Button States
For each button in all windows:
1. Hover - visual change visible
2. Click/focus - focus indicator visible
3. Active - state change visible
4. Loading - spinner animation (if applicable)

### Tool Feedback (Preview Window)
1. Select tool - button highlighted
2. Draw on canvas - annotation visible
3. Select annotation - selection indicator visible
4. Undo - annotation removed
5. Clear all - all removed

## Cross-Platform Testing

### Windows 10/11
- [ ] Test with Narrator
- [ ] Test with NVDA
- [ ] Test high contrast mode
- [ ] Test different screen sizes

### Mac
- [ ] Test with VoiceOver
- [ ] Test high contrast mode
- [ ] Test different screen sizes

## Automated Testing

### Lighthouse Audit
Run in Chrome DevTools:
```
1. Open DevTools (F12)
2. Go to Lighthouse tab
3. Select "Accessibility" only
4. Click "Analyze page load"
5. Score should be 95+
```

### axe DevTools
```
1. Open DevTools (F12)
2. Go to axe DevTools tab
3. Click "Scan ALL of my page"
4. Zero violations should be found
```

## Bug Reporting Template

If accessibility issues are found, report using:

```
**Issue Title**: [Brief description]

**Window**: [index.html/selection.html/preview.html/gallery.html]

**Severity**: [Critical/High/Medium/Low]

**Steps to Reproduce**:
1.
2.
3.

**Expected Behavior**: [What should happen]

**Actual Behavior**: [What actually happens]

**Environment**:
- OS: [Windows/Mac/Linux]
- Browser: [Chrome/Edge/Firefox/Safari]
- Screen Reader: [NVDA/JAWS/VoiceOver/Narrator]
- MauShot Version: [version number]

**Screenshot/Screencast**: [If applicable]
```

## Regression Testing

After any changes, re-test:
1. [ ] All keyboard shortcuts still work
2. [ ] All screen reader announcements work
3. [ ] All focus indicators visible
4. [ ] All loading states show
5. [ ] All tool feedback works

## Sign-off Criteria

Accessibility fixes considered complete when:
- [ ] All P1 issues resolved
- [ ] All P2 issues resolved
- [ ] All P3 issues resolved
- [ ] Lighthouse score 95+
- [ ] axe DevTools zero violations
- [ ] Keyboard navigation fully functional
- [ ] Screen reader fully functional
- [ ] All visual feedback working
- [ ] Documentation complete

## Continuous Monitoring

### Regular Testing Schedule
- Weekly: Automated accessibility scans
- Monthly: Manual keyboard/screen reader testing
- Per Release: Full accessibility audit

### Metrics to Track
- Lighthouse accessibility score
- axe DevTools violation count
- User-reported accessibility issues
- Screen reader compatibility issues

---

**Remember**: Accessibility is ongoing. Test regularly and include accessibility in all new feature development.
