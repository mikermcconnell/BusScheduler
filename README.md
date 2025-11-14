# Scheduler2 - Bus Route Scheduling Application

A professional bus route scheduling application that automates the conversion of raw travel time data into formatted bus schedules.

## Quick Start

1. **Install**: `npm install`
2. **Run**: `npm start`
3. **Test**: Upload `example_schedule/Raw_Data.csv`

## Complete Documentation

📖 **[See agents.md for complete documentation](./agents.md)**

The agents.md file contains comprehensive information about:
- Detailed setup and configuration
- Architecture and technical implementation
- Feature documentation and usage guides
- API reference and troubleshooting
- Security implementation and testing strategies

## Project Status

✅ **Production Ready** - MVP+ with advanced features  
🔒 **Security Hardened** - Comprehensive security mitigations  
⚡ **Performance Optimized** - Handles 500+ trips efficiently  
☁️ **Cloud Integrated** - Firebase Firestore with offline support  

## TOD Optimization Feature Flags

- `REACT_APP_TOD_SOLVER` & `REACT_APP_TOD_SOLVER_STAGGER` — enable the solver-based rebalancing engine and instruct it to evaluate staggered start/stop variants for each heuristic shift. Turn both on to reduce surplus vehicle-hours without relaxing union rules.
- `REACT_APP_TOD_TRIM_EXCESS` — runs the post-processing trimmer that shaves surplus coverage after optimization and powers the **Trim Excess** action inside the Shift Optimization tab. Keep it enabled in production to prevent +38 hour drift.

---

**Version**: 2.1.0  
**Last Updated**: January 2025  
**Tech Stack**: React 19 + TypeScript 5.9 + Material-UI v7
