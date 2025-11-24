# Family Guardian 360° - Projeto

## Overview
Family Guardian 360° is a professional family management and protection system offering real-time location tracking, built with Flask, SQLite3, and responsive HTML5. Its purpose is to provide families with tools for safety, communication, and oversight, including real-time geolocation, battery monitoring, and emergency alerts. The project aims to be a comprehensive solution for family safety and coordination, leveraging modern web technologies for an app-like experience without requiring native installation.

## User Preferences
I want the agent to use a clear and objective communication style. When making changes, prioritize iterative development, focusing on one feature or fix at a time. Before implementing major changes or new features, I prefer to be consulted to discuss the approach. I value detailed explanations for complex solutions or architectural decisions. Do not make changes to the `render.yaml` file.

## System Architecture
The system is built on a Flask backend using pure SQLite3 for the database. The frontend is developed with HTML5, CSS3, and JavaScript (ES6+), adopting a mobile-first, responsive design approach. Key UI/UX decisions include a complete dark mode theme with a floating toggle button, optimized colors for OLED, and a modern visual design with user chips and floating buttons for quick actions on maps.

**Technical Implementations:**
- **Backend:** Python + Flask with Flask-SocketIO for real-time communication.
- **Database:** SQLite3 with pure SQL queries and optimized indices; no ORM is used. Automatic cleanup of old data (24h) is implemented.
- **Frontend:** Utilizes Leaflet.js for interactive maps, Chart.js for data visualization, and integrates various browser APIs: Geolocation API, Battery API, and Notifications API.
- **Real-time Communication:** Socket.IO enables bidirectional communication for instant location updates, real-time messaging, and emergency broadcasts.
- **PWA Features:** Configured with a Service Worker for offline functionality (cache-first strategy) and a Web App Manifest for installability on mobile and desktop.
- **Data Export:** Supports CSV export for locations and PDF reports via ReportLab.
- **Deployment:** Optimized for Render using Gunicorn + gevent-websocket, with a dedicated `render.yaml` file for deployment configuration.

**Feature Specifications:**
- **Authentication:** Secure system using bcrypt.
- **User Registration:** Public registration is disabled. New users can only be created through:
  1. **Kirvano Payment Integration:** Automatic user creation after successful payment/subscription activation
  2. **Administrative Creation:** Super Admins can create Family Admins, and Family Admins can create members within their families
- **Kirvano Integration:** Full webhook integration for payment processing, subscription management, and automatic user provisioning. Handles events: subscription.created, subscription.activated, payment.approved, payment.failed, subscription.cancelled, and subscription.expired.
- **Family Management:** Creation and administration of family units with granular permission levels.
- **User Hierarchy:** Three access levels: Super Admin (full system control, promotes Family Admins), Family Admin (manages family members, creates users, sets permissions), and Member (basic system access). A 'Supervisor' role within a family allows specific permissions configured by the Family Admin.
- **Geolocation & Monitoring:** Real-time location tracking and battery level monitoring with visual indicators and alerts. Map popups now display street addresses via reverse geocoding (Nominatim API) with intelligent caching to prevent rate limiting.
- **Geofencing:** Creation of virtual "safe zones" with configurable radii and alerts for entry/exit.
- **Messaging:** Family-specific messaging system.
- **Panic Button:** Instant emergency alert system.
- **Notifications:** Local browser notifications for emergencies, low battery, and geofencing events.
- **Dashboard:** Interactive dashboard with Chart.js graphs for battery history, activity statistics, and location history, along with summary cards.
- **Location History:** Advanced trajectory visualization with playback animation and filtering options.
- **Data Export:** Export of location data in CSV format.
- **Live Camera Streaming (NEW):** Real-time camera access using WebRTC technology. Admins and authorized users can request live video feed from family members' devices. Features include:
  - Peer-to-peer video streaming via WebRTC for minimal server load
  - Permission-based access control (Super Admin, Family Admin, and Supervisors with location permission)
  - User consent required - members must accept camera requests
  - Real-time notifications for camera access requests
  - Automatic stream termination when connection is lost

## External Dependencies
- **Leaflet.js:** Interactive mapping library.
- **Chart.js:** JavaScript charting library for data visualization.
- **ReportLab:** Python library for generating PDF documents.
- **Socket.IO:** Library for real-time, bidirectional communication between web clients and servers.
- **Browser Native APIs:**
    - Geolocation API
    - Battery API
    - Notifications API
    - Service Worker API
    - Web App Manifest (for PWA functionality)
- **bcrypt:** Password hashing library for secure authentication.