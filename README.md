# Our Little Space — Supabase version 💗

## 1. Install
Run:
`npm install`

## 2. Environment
Copy `.env.example` to `.env` and put your Supabase project URL and publishable key in it.

## 3. Database
Open Supabase → SQL Editor and run the complete `supabase.sql` file.

Also make sure **Authentication → Providers → Anonymous Sign-Ins** is enabled.

## 4. Run
`npm run dev`

## 5. Important
Never put a Supabase secret/service-role key in `.env` for this frontend. Use the publishable key only.

This version implements real Supabase anonymous authentication, room creation/joining, persistent messages, realtime message INSERT/DELETE subscriptions, replies and reactions UI.
