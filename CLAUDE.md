# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a privacy-focused Next.js web application for adding censoring lines (black bars) to images. The app name "Mesen" (目線) refers to the Japanese term for masking/censoring eyes or faces in photos.

## Key Commands
- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Create production build (static export)
- `npm run lint` - Run ESLint
- `npm run deploy` - Build and deploy to Vercel

## Architecture
The application is built with Next.js 15.3.3 using the App Router pattern and exports as a static site. All image processing happens client-side for privacy.

### Core Components
- `components/ImageEditor.tsx` - Main controller managing editor state and mode transitions
- `components/CanvasEditor.tsx` - Canvas rendering, drawing interface, and tool buttons
- `components/LandingPage.tsx` - Initial image selection interface
- `components/Loupe.tsx` - Magnifying glass overlay for precise touch drawing
- `components/TemporalTooltip.tsx` - Temporary tooltip component for UI hints

### Custom Hooks
- `hooks/useDrawing.ts` - Manages line drawing state, mode transitions, and loupe visibility
- `hooks/useTouch.ts` - Handles touch gestures, mode detection, and haptic feedback
- `hooks/useZoomPan.ts` - Controls canvas zoom, pan, and double-tap zoom functionality

### Type Definitions
- `types/editor.ts` - Central type definitions including DrawingMode and interfaces

### Constants
- `constants/editor.ts` - Configuration values for line thickness, delays, and thresholds

### Drawing Modes
The editor operates in five modes (DrawingMode type):
1. **None** - Initial state before mode detection
2. **Move** - Pan and zoom the canvas
3. **Adjust** - Position adjustment with loupe (preparation for drawing)
4. **Draw** - Active line drawing with loupe
5. **MoveLine** - Move existing lines with loupe assistance

### Touch Operation Flow
1. **Initial Touch** - Mode is 'none' for 100ms to detect intent
2. **Mode Detection**:
   - Near line (within LINE_HIT_EXPANSION): Enter moveLine mode
   - Movement > CLICK_DISTANCE_THRESHOLD: Enter move mode
   - No movement: Enter adjust mode → draw mode after 1 second stationary

### Loupe Features
- **Size**: 100px diameter (LOUPE_RADIUS = 50)
- **Magnification**: Current zoom × 1.5
- **Position**: Dynamically positioned to avoid viewport edges
- **Visual Feedback**:
  - Adjust mode: Semi-transparent center dot with white border animation
  - Draw mode: Opaque center dot with scale animation and pen icon
  - MoveLine mode: Shows current line position during drag

### Key Thresholds
- `ADJUST_MODE_DELAY`: 200ms - Time before entering adjust mode
- `DRAW_MODE_DELAY`: 1000ms - Stationary time before draw mode
- `CLICK_DISTANCE_THRESHOLD`: 3px - Movement threshold for click detection
- `LINE_HIT_EXPANSION`: 25px - Extended hit area for line selection
- `AUTO_THICKNESS_SCREEN_RATIO`: 0.02 - 2% of screen width for auto thickness

### Mobile-First Features
- Loupe magnifier for precise touch operations
- Haptic feedback via Vibration API
- Dynamic positioning to avoid edge overflow
- Touch-optimized UI controls
- White border countdown animation for mode transitions