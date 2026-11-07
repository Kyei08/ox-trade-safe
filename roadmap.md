# Roadmap

- [x] Fix white screen when signed-out visitors open a listing detail page (root cause: seller profile view unreadable for anon; exposed PII-safe `public_seller_profiles` view, switched reads, added null guards)
- [ ] Correct the malformed stored PayFast merchant key secret (22 chars; should be the 13-char key provided earlier); secure update was declined
- [ ] Republish the app so the listing-detail fix reaches the published site (published site still runs the old bundle)
- [ ] Assess Hostinger domain on Vercel as an alternative to Lovable custom-domain hosting; explain prerequisites and proceed only with DNS access details, never account passwords
- [x] Diagnose blank custom domain on GitHub Pages; add a production build-and-deploy workflow with SPA fallback
- [ ] Verify GitHub Pages repository settings and Hostinger DNS using the user's public domain (not yet provided)
