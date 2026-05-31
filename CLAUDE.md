# Project Rules

## Git
- Do NOT run git commands
- Do NOT commit, push, or pull
- User handles all version control manually

## General
- Do not re-read files already in context
- Make targeted changes only

## Screenshots  
- Do NOT take screenshots
- Do NOT use screencapture or any screen capture commands
- User will take screenshots and upload them manually

## Token Saving
- Do not re-read files already in context
- Do not run the dev server to test
- Do not install packages without asking first
- Make the minimum changes needed to fix the issue

# Critical Files — Do Not Modify

## src/lib/supabase/client.ts
Must use singleton pattern. Do NOT remove the `let client` variable.

## src/lib/supabase/middleware.ts
The `setAll` function must NOT create a new NextResponse. See WARNING comment in file.

## src/components/auth/AuthForm.tsx
Login uses a server action from `src/app/login/actions.ts`. Do NOT revert to client-side signInWithPassword.

## src/app/login/actions.ts
This file must exist. Do NOT delete it.