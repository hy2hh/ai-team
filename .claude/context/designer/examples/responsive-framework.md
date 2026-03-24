<!-- Extracted from .claude/agents/designer.md -->

# Responsive Design Framework — CSS Example

```css
/* Mobile First Approach */
.container {
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding-left: var(--space-4);
  padding-right: var(--space-4);
}

/* Small devices (640px and up) */
@media (min-width: 640px) {
  .container { max-width: 640px; }
  .sm\:grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
}

/* Medium devices (768px and up) */
@media (min-width: 768px) {
  .container { max-width: 768px; }
  .md\:grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
}

/* Large devices (1024px and up) */
@media (min-width: 1024px) {
  .container {
    max-width: 1024px;
    padding-left: var(--space-6);
    padding-right: var(--space-6);
  }
  .lg\:grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
}

/* Extra large devices (1280px and up) */
@media (min-width: 1280px) {
  .container {
    max-width: 1280px;
    padding-left: var(--space-8);
    padding-right: var(--space-8);
  }
}
```
