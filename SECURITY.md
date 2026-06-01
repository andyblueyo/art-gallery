# Security & Data Disposal: gallery-club (v0.1.0)

## 1. Supported Versions
We only support and patch the current active version.

| Version | Supported | Notes |
| :--- | :---: | :--- |
| **v0.1.0** | ✅ Yes | Current Next.js 14 / Supabase build. |
| < v0.1.0 | ❌ No | Legacy/experimental. |

---

##. How to Report a Bug
Found a security flaw? Please help us fix it safely by viewing the options below.

* **Where to report:** Email us privately at emailing security@galleryclub.online

* DO NOT open public GitHub issues for security findings

* 3: Data & Privacy

  Gallery club Stores:
  User Auth: Supabase Auth using bcrypt (passwords hashes, not stored)

  Artworks: User-Uploaded files in supabase storage
  Analytics: Anon static link only page views & heart (no tracking).

  All user data can be removed via the dashboard section.



How to construct: Share a brief description and the steps or script used to trigger the bug (attack surface, steps etc. 
Timeline: We will acknowledge your email within 3-4 days.
  * If accepted, we aim to release a fix within **30 days** and credit you in our release notes!

**Please note that the current state of the environment is static, meaning wherever you left off inside of the link (your own) is where you will return. 
