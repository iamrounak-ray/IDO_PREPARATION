# IDO Practice Room

A practice website for the **WBPSC Industrial Development Officer (IDO)** exam, 2026 pattern:

- **Daily quiz**: unlimited questions in all 7 subjects, instant right/wrong with an explanation, missed questions come back later.
- **Tests**: 100-question timed mock in the exam format (−0.25 per wrong answer), sectional tests, and the real **2019** and **2007** IDO papers, each with a question-by-question evaluation.
- **Profile**: progress charts per subject with any date range.
- **Sign-in**: profiles are tied to an email address and a password. A new user needs a one-time passcode from you; a returning user signs in with email and password. Progress syncs across phones and computers.

It is a static website (HTML, CSS and JavaScript only), so it runs on **GitHub Pages** for free. Sign-in and syncing use **Google Firebase** (free plan).

---

## What's in this folder

| Path | What it is |
| --- | --- |
| `index.html` | The website |
| `css/styles.css` | Styles (works on laptops, Android and iPhone) |
| `js/config.js` | **Your Firebase settings go here** (step 2) |
| `js/bank.js`, `js/gen.js`, `js/pyq.js` | Question bank, question generators, previous year papers |
| `js/bank-extra.js` | Extra questions added over time (new ones go at the end of each section) |
| `js/app.js`, `js/profile.js` | The app: quiz, tests, results, profile charts, sign-in screens |
| `js/cloud.js` | Firebase sign-in and sync |
| `firestore.rules` | Database security rules (step 4) |
| `admin/passcode-hash.html` | Helper page for making new passcodes (step 5) |

---

## Setup (about 20 minutes, one time)

### Step 1 – Put the folder on GitHub and turn on GitHub Pages

1. On github.com, create a new **public** repository, for example `ido-practice`.
2. Click **Add file → Upload files**, drag in **everything inside this folder** (keep the `css`, `js` and `admin` folders), and click **Commit changes**.
3. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After a minute your site is live at `https://YOUR-GITHUB-NAME.github.io/ido-practice/`.

At this point the site already works, but without sync: progress is saved only in each browser. Continue to turn on email sign-in and sync.

### Step 2 – Create a Firebase project and copy its settings

1. Go to <https://console.firebase.google.com>, click **Create a project**, give it a name (e.g. `ido-practice`). Google Analytics is not needed.
2. On the project page, click the **Web** icon (`</>`) to add a web app. Give it any nickname. You do **not** need Firebase Hosting.
3. Firebase shows a `firebaseConfig = { ... }` block. Open `js/config.js`, and replace `null` with that block, so it reads `window.FIREBASE_CONFIG = { apiKey: "...", ... };`
4. Upload the changed `js/config.js` to GitHub (open the file on GitHub → pencil icon → paste → **Commit**).

### Step 3 – Turn on email/password sign-in

1. In Firebase, in the left panel: **Security → Authentication → Get started**.
2. **Sign-in method → Email/Password → Enable** and Save. (The *Email link* option is not needed.)
3. **Settings → Authorized domains → Add domain**: add `YOUR-GITHUB-NAME.github.io`.

### Step 4 – Create the database and paste the security rules

1. In the left panel: **Databases & Storage → Firestore → Create database**. Choose **Standard edition**, keep the database ID as `(default)`, pick a location near you (e.g. `asia-south1` Mumbai) and **Production mode**.
2. Open the **Rules** tab, delete what is there, paste the whole of `firestore.rules`, and click **Publish**.

### Step 5 – Add the passcodes

Passcodes are stored only as one-way codes ("document IDs"), so they can't be read from the website.

1. In **Databases & Storage → Firestore → Data**, click **Start collection**, name it `codes`.
2. For the first document, set **Document ID** to the ID below, add a field `note` (string) such as `first passcode`, and save. Add the second one the same way.

| Passcode | Document ID to create in `codes` |
| --- | --- |
| 301125 | `67224e1769078ec61e27300b91d57462060f1aae2248b7edfc12d2deae3aa834` |
| 162330 | `235b7bb5a818070658516324721a1e43c4816f9c8c3c19fe7cfa0ea394b93046` |

**New passcodes later:** open `admin/passcode-hash.html` on your site (e.g. `https://YOUR-GITHUB-NAME.github.io/ido-practice/admin/passcode-hash.html`), type the new passcode, and add the document ID it shows to `codes` the same way. Each passcode works **once** for everyone; after it is used it can never be used again.

### Step 6 – Try it

Open your site, choose **New user**, enter a name, your email, a 6-digit password and passcode `301125`. You're in. On another phone or laptop, choose **Returning user** and sign in with the same email and password: the same progress appears.

---

## How sign-in works

- **New user**: name + email + a 6-digit password they choose + your passcode → the profile is created and the passcode is used up.
- **Returning user**: email + 6-digit password. No passcode, and no email is sent.
- **Forgot password**: on the Returning user screen, type the email and tap *Forgot password?*; Firebase emails a reset link.
- Each device stays signed in until the person taps **Sign out**.
- Only the owner of a profile can read or change it.

## Limits on the free Firebase plan

- Password sign-in sends no emails, so there is no daily sign-in limit.
- Password-reset emails: 150 per day.
- Database: 50,000 reads and 20,000 writes per day, far more than a few users need.
- Check the current limits at <https://firebase.google.com/docs/auth/limits> and <https://firebase.google.com/pricing>.

## Good to know

- If a password-reset email doesn't arrive, check Spam/Promotions. You can change its sender name and text under **Security → Authentication → Templates**.
- "Fresh questions written by Claude" only works when the page is opened inside Claude; on GitHub the quiz uses the built-in question bank and the unlimited generators.
- Progress is synced a second or two after each answer, and immediately when the page is closed or hidden.
- If you leave `js/config.js` as `null`, the site still works with on-device profiles (passcodes 301125 and 162330 each work once per device).
- West Bengal policy questions reflect November 2026. Scheme names can change; edit `js/bank.js` to update them.
