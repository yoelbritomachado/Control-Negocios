---
name: research-ui-trend
description: Research and reverse-engineer high-fidelity UI trends (e.g., Apple Liquid Glass) for web implementation.
---

# UI Trend Research (Reverse Engineering)

This skill guides you through the process of searching for and analyzing advanced UI design trends to replicate them in CSS/Tailwind.

## Usage
Run this skill when asked to "research how to make X effect" or "find how Apple does X".

## Steps

1.  **Search Strategy (Web)**:
    *   Use `search_web` to find technical breakdowns.
    *   **Keywords**: Combine the trend name with technical terms.
        *   *Example*: "Apple iOS 26 liquid glass css", "glassmorphism advanced techniques 2024", "figma to css liquid effect".
    *   **Sources**: Prioritize hits from:
        *   CSS-Tricks, Smashing Magazine, Codrops.
        *   CodePen (look for "Liquid Glass", "iOS 18/26 concept").
        *   Dribbble/Behance *comments* or *related articles* (often link to code).
        *   Apple Developer Design Videos (WWDC recaps on "Visual Intelligence" or "Materials").

2.  **Analyze the Technical Stack**:
    *   Identify the key CSS properties used.
    *   **Common patterns for Glass/Liquid**:
        *   **Lighting**: `box-shadow` (multiple layers, inner/drop), `radial-gradient` (for spotlights).
        *   **Material**: `backdrop-filter: blur()`, `backdrop-filter: saturate()`.
        *   **Borders**: `border-image`, `mask-image` (for fading borders).
        *   **Refraction**: `mix-blend-mode: overlay/soft-light`.
        *   **Animation**: `transition`, `transform: scale/perspective`.

3.  **Synthesize Implementation Plan**:
    *   Review the code/concepts found.
    *   **Draft a CSS Utility Class** in your scratchpad that combines these properties.
    *   **Map to Tailwind**: Convert raw CSS to Tailwind arbitrary values (e.g., `bg-[rgba(255,255,255,0.1)]`) or custom classes.

4.  **Verification**:
    *   Create a small HTML/CSS test artifact (or update a component) to verify the look matches the *reference image* provided by the user.

## Example Output
"I found that the 'Liquid Glass' effect relies on three layers of `box-shadow`: a sharp white rim light (`inset 0 1px ...`), a broad soft glow (`inset 0 0 20px...`), and a chromatic aberration edge using colored shadows. Here is the CSS to replicate it..."
