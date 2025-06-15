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

### Custom Hooks
- `hooks/useDrawing.ts` - Manages line drawing state and history
- `hooks/useTouch.ts` - Handles touch gestures and haptic feedback
- `hooks/useZoomPan.ts` - Controls canvas zoom and pan functionality

### Drawing Modes
The editor operates in three sequential modes:
1. **Move Mode** - Pan and zoom the canvas
2. **Adjust Mode** - Fine-tune line thickness
3. **Draw Mode** - Draw censoring lines

### Mobile-First Features
- Loupe magnifier for precise touch drawing
- Haptic feedback via Vibration API
- Dynamic positioning to avoid edge overflow
- Touch-optimized UI controls