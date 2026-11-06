# Roadmap

- [x] Fix white screen when signed-out visitors open a listing detail page (root cause: seller profile view unreadable for anon; exposed PII-safe `public_seller_profiles` view, switched reads, added null guards)
- [ ] Correct the malformed stored PayFast merchant key secret (22 chars; should be the 13-char key provided earlier) and remove the temporary `payfast-env-check` diagnostic function
- [ ] Republish the app so the listing-detail fix reaches the published site (published site still runs the old bundle)
