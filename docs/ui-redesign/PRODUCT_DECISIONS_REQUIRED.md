# Product decisions required

These need owner approval. Runtime behavior was not changed.

1. **Owner approval required.** Sidebar label «إدارة الجهات المستفيدة» opens neighborhood representatives. Audit C1. No authoritative replacement was found, so the label and route stay as they are.
2. **Owner approval required.** `assistant_admin` lands on `/receiver` after login, while the menu starts at the dashboard. `App.jsx` sets that home path. No written business reason was found, so the landing route stays as it is. Audit C3.
3. **Owner approval required.** Login copy says «جمعية إكرام لخدمة ضيوف الرحمن». Official documents use `AssociationIdentity`, whose fallback matches the letterhead name. Neither string was rewritten.
4. Hijri dates and QR codes are still absent. There is no approved source for either.
