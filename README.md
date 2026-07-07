# Expense & Activity Tracker

Personal MERN + Expo (React Native) app for tracking shared/personal expenses and activities.

## Structure
- `backend/` — Express + Mongoose API (JWT auth, expenses, events, stats)
- `mobile/` — Expo (React Native) app

## Running locally

### Backend
```
cd backend
npm install
cp .env.example .env   # then fill in MONGODB_URI, JWT_SECRET, seed user credentials
npm run seed            # creates the 2 user accounts (one time)
npm run dev
```

### Mobile
```
cd mobile
npm install
npx expo start
```
Scan the QR code with the **Expo Go** app on your Android phone. Make sure your phone
and PC are on the same WiFi network, and that `mobile/src/config/env.js` points at
your PC's LAN IP address (find it with `ipconfig`), not `localhost`.
