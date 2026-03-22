# Accessibility Quick Reference Guide for MauShot Developers

## Quick Checklist for New Features

When adding new features to MauShot, ensure you check these items:

### HTML Elements
- [ ] All interactive elements are keyboard accessible
- [ ] All images have appropriate `alt` text
- [ ] All form controls have labels (`aria-label` or `<label>`)
- [ ] Proper heading hierarchy (h1 -> h2 -> h3)
- [ ] Semantic HTML with landmark roles
- [ ] Buttons have descriptive text or aria-label

### Interactive Elements
- [ ] Visible focus indicators (`.user-is-tabbing` class)
- [ ] Hover and active states for all buttons
- [ ] Loading states for async operations
- [ ] Error states with proper messaging
- [ ] Success feedback for completed actions

### Screen Reader Support
- [ ] Dynamic content uses ARIA live regions
- [ ] Modals have `role="dialog"` and `aria-modal="true"`
- [ ] Tooltips have proper ARIA attributes
- [ ] State changes are announced
- [ ] Hidden content uses `.visually-hidden` class

### Keyboard Navigation
- [ ] All functionality available via keyboard
- [ ] Logical tab order
- [ ] Skip links for long pages
- [ ] Escape key closes modals/menus
- [ ] Arrow keys for lists/menus

## Common Patterns

### Button with Accessibility
```html
<button
  class="btn"
  aria-label="Descriptive label"
  aria-pressed="false"
  title="Tooltip text">
  <svg aria-hidden="true" viewBox="0 0 24 24">...</svg>
  <span class="label">Button Text</span>
</button>
```

### Form Control with Label
```html
<div class="form-group">
  <label for="control-id" class="visually-hidden">Label Text</label>
  <input
    id="control-id"
    type="text"
    aria-label="Label Text"
    aria-required="true">
</div>
```

### Live Region for Announcements
```html
<div id="live-region" role="status" aria-live="polite" aria-atomic="true" class="visually-hidden"></div>

<script>
function announce(message) {
  const liveRegion = document.getElementById('live-region');
  liveRegion.textContent = '';
  setTimeout(() => { liveRegion.textContent = message; }, 100);
}
</script>
```

### Modal Dialog
```html
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
  aria-hidden="true">
  <h2 id="modal-title">Modal Title</h2>
  <p id="modal-description">Modal description</p>
  <!-- Content -->
</div>
```

### Focus Trap for Modals
```javascript
const focusableElements = container.querySelectorAll(
  'a[href], button:not([disabled]), textarea:not([disabled]), ' +
  'input[type="text"]:not([disabled]), select:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])'
);

const firstFocusable = focusableElements[0];
const lastFocusable = focusableElements[focusableElements.length - 1];

container.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;

  if (e.shiftKey && document.activeElement === firstFocusable) {
    e.preventDefault();
    lastFocusable.focus();
  } else if (!e.shiftKey && document.activeElement === lastFocusable) {
    e.preventDefault();
    firstFocusable.focus();
  }
});
```

## CSS Classes Reference

### Utility Classes
```css
/* Hide visually but keep accessible */
.visually-hidden { /* ... */ }

/* Keyboard navigation focus */
body.user-is-tabbing *:focus-visible { /* ... */ }

/* Loading state */
.loading { /* ... */ }

/* Skip link */
.skip-link { /* ... */ }
```

### Using the Shared Accessibility Styles
```html
<link rel="stylesheet" href="renderer/accessibility-styles.css">
```

## JavaScript Functions Reference

### AccessibilityManager Class
```javascript
// Announce to screen readers
AccessibilityManager.announceToScreenReader('Message');

// Ensure image has alt text
AccessibilityManager.ensureImageAltText(imgElement, 'Description');

// Label form control
AccessibilityManager.labelFormControl(inputElement, 'Label');

// Create focus trap
const focusTrap = AccessibilityManager.createFocusTrap(modalElement);
focusTrap.activate();
focusTrap.deactivate();

// Announce loading/success/error
AccessibilityManager.announceLoading('Loading message');
AccessibilityManager.announceSuccess('Success message');
AccessibilityManager.announceError('Error message');
```

## Testing Checklist

### Manual Testing
- [ ] Navigate entire app with keyboard only
- [ ] Test with screen reader (NVDA/JAWS/VoiceOver)
- [ ] Test with high contrast mode
- [ ] Test with reduced motion preference
- [ ] Test with different screen sizes
- [ ] Test all interactive elements with mouse and keyboard

### Automated Testing
- [ ] Run axe DevTools scan
- [ ] Run Lighthouse accessibility audit
- [ ] Check for color contrast issues
- [ ] Verify all images have alt text
- [ ] Verify all form controls have labels

## Common Accessibility Issues to Avoid

### Don't Do This
```html
<!-- Missing alt text -->
<img src="icon.png">

<!-- No label for input -->
<input type="text">

<!-- Div used as button -->
<div onclick="doSomething()">Click me</div>

<!-- Hidden content not accessible -->
<div style="display:none">Important info</div>
```

### Do This Instead
```html
<!-- Proper alt text -->
<img src="icon.png" alt="Descriptive text">

<!-- Labeled input -->
<input type="text" aria-label="Field description">

<!-- Real button element -->
<button onclick="doSomething()">Click me</button>

<!-- Visually hidden but accessible -->
<div class="visually-hidden" aria-live="polite">Important info</div>
```

## Accessibility Attributes Quick Guide

| Attribute | Usage | Example |
|-----------|-------|---------|
| `alt` | Image descriptions | `<img alt="Screenshot preview">` |
| `aria-label` | Label for interactive elements | `<button aria-label="Close">` |
| `aria-labelledby` | Reference to label element | `<div aria-labelledby="title">` |
| `aria-describedby` | Reference to description | `<input aria-describedby="help">` |
| `aria-hidden="true"` | Hide from screen readers | `<svg aria-hidden="true">` |
| `aria-live` | Announce dynamic content | `<div aria-live="polite">` |
| `aria-atomic` | Announce entire region | `<div aria-atomic="true">` |
| `aria-pressed` | Toggle button state | `<button aria-pressed="true">` |
| `aria-expanded` | Expandable state | `<button aria-expanded="false">` |
| `aria-current` | Current item | `<a aria-current="page">` |
| `role` | Explicit role | `<div role="dialog">` |
| `tabindex` | Focus management | `<div tabindex="0">` |

## Color Contrast Requirements

- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text (18px+)**: Minimum 3:1 contrast ratio
- **Interactive elements**: Minimum 3:1 contrast ratio
- **Current colors used**:
  - Primary blue: #0078d4
  - Text: #e0e0e0 on #1e1e1e background
  - All meet WCAG AA requirements

## Resources

### Internal Documentation
- `docs/ACCESSIBILITY_UI_UX_FIXES.md` - Complete fix documentation
- `renderer/accessibility-fixes.js` - Accessibility utilities
- `renderer/accessibility-styles.css` - Shared accessibility styles

### External Resources
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Accessibility Checklist](https://webaim.org/standards/wcag/checklist)
- [axe DevTools](https://www.deque.com/axe/devtools/)

## Getting Help

If you encounter accessibility issues or have questions:
1. Check this quick reference guide
2. Review the complete fixes documentation
3. Test with screen reader/keyboard
4. Consult WCAG guidelines
5. Use accessibility testing tools

---

Remember: Accessibility is not a feature, it's a fundamental aspect of good web development. Every new feature should be accessible by default.
