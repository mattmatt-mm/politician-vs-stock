# **Design System: Fintech Minimalist Grid**

This design system is inspired by high-end quantitative finance dashboards and modern fintech interfaces. It prioritizes rigid structural layouts, monochromatic high-contrast palettes, and sophisticated typography pairings.

## **1. Color Palette (Monochromatic Zinc)**
*   **Base Background:** Off-White (`#F2F2F2`).
*   **Dividers & Borders:** Zinc Light (`#E4E4E7`).
*   **Primary Text:** Ink Black (`#09090B`).
*   **Secondary Text:** Muted Zinc (`#71717A`).
*   **Accent (Growth):** Emerald (`#10B981`) - used sparingly for positive return data.
*   **Accent (Danger):** Rose (`#E11D48`) - used sparingly for negative return data.

## **2. Typography (The High-Low Pairing)**
*   **Display Font:** **Instrument Sans** (Bold) for headings and logic.
*   **Emphasis Font:** **Instrument Serif** (Italic) for specific emphasis on market sentiment or calls to action.
*   **Body Font:** **Inter** for dense data and candlestick metadata.

### **Typography Usage Snippet**
```css
.display-header {
  font-family: 'Instrument Sans', sans-serif;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.emphasis-italic {
  font-family: 'Instrument Serif', serif;
  font-style: italic;
  font-weight: 400;
}
```

## **3. The "Grid Canvas" System**
The interface uses a rigid grid defined by `1px` borders rather than elevated cards. At every major layout intersection, a `4px` circular "dot" marker is placed to emphasize the structural precision.

### **Intersection Pattern (CSS Extraction)**
```css
.grid-cell {
  position: relative;
  border: 1px solid var(--zinc-200);
  background: white;
}

/* The Intersection Dot */
.grid-cell::after {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  background: var(--zinc-300);
  border-radius: 50%;
  bottom: -3px;
  right: -3px;
  z-index: 2;
}
```

## **4. Component Language**
*   **Charts:** Single-pixel stroke width for all paths. No area gradients unless at very low opacity (3%).
*   **Icons:** Contained within `32px` light gray capsules (`#F4F4F5`) with a `radius-sm`.
*   **Spacing:** Tight, 4pt based scaling used to create a "dense but breathable" data view.

## **5. Iconography**
*   **Style:** Lucide icons, monochromatic.
*   **Logo:** The `app_logo.svg` remains centered as the primary branding anchor.

