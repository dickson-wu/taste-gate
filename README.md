# Taste Gate for Pinterest

Stop judging hundreds of Pinterest images by "I feel" and "I think". Write your taste down once (an AI chat does the writing for you), and Taste Gate checks every pin as you scroll:

- 🟢 **Green** fits your taste
- 🟠 **Orange** is unsure: worth a quick look
- 🔴 **Red** breaks your taste (hover to see why)

You skip the red ones and pick references from what's left, so finding references for AI image generation takes minutes instead of half an hour of scrolling and decision fatigue.

Taste Gate isn't one-size-fits-all. It starts with a simple starting taste, and **you make it yours with an AI chat** (Claude, ChatGPT or similar): the AI interviews you, writes your taste, and later improves it from the pins you voted on.

It looks at images with **Jev by TypeSafe**, using **your own Jev key**. Checking 1,000 images costs about **7–8 US cents**.

---

## Contents

1. [Install (5 minutes)](#1-install-5-minutes)
2. [Set up your taste with AI](#2-set-up-your-taste-with-ai)
3. [Use it on Pinterest](#3-use-it-on-pinterest)
4. [Make it smarter: improve your taste from your votes](#4-make-it-smarter-improve-your-taste-from-your-votes)
5. [Quick changes](#5-quick-changes)
6. [Check it's safe before you install](#6-check-its-safe-before-you-install)
7. [Something not working?](#7-something-not-working)
8. [Costs and privacy](#8-costs-and-privacy)
9. [Update or remove](#9-update-or-remove)

---

## 1. Install (5 minutes)

You need **Google Chrome** (or Edge, Brave or another Chrome-based browser) on a computer, and a **Jev key** from [typesafe.ai](https://typesafe.ai).

### Easiest: let an AI walk you through it

Open Claude, ChatGPT or any AI chat and paste this:

```text
Walk me through installing a Chrome extension from GitHub, one step at a time.
Wait for me to say "done" after each step before giving the next one.
The extension: Taste Gate for Pinterest, at https://github.com/dickson-wu/taste-gate
Steps to cover:
1. Download the repository as a ZIP from GitHub (green "Code" button, then "Download ZIP").
2. Unzip it into a folder I will keep (not Downloads, which I might clean up), for example Documents/taste-gate.
3. Open chrome://extensions and switch on "Developer mode" (top right).
4. Click "Load unpacked" and pick the unzipped folder: the one that directly contains manifest.json.
5. Pin the extension to the toolbar (puzzle-piece icon, then the pin).
6. On the Taste Gate settings page that opens, paste my Jev key from typesafe.ai and press Save key.
My computer is: <Windows / Mac>. My browser is: <Chrome / Edge / Brave>.
If I get stuck, ask me what I see on screen.
```

### Or follow the steps yourself

1. On this GitHub page, click the green **Code** button, then **Download ZIP**.
2. Unzip it into a folder you'll keep, for example `Documents/taste-gate`. Chrome runs the extension from this folder, so don't delete or move it later.
3. In Chrome, go to `chrome://extensions`.
4. Turn on **Developer mode** (switch in the top-right corner).
5. Click **Load unpacked** and choose the unzipped folder: the one with `manifest.json` directly inside it. If you see a folder inside a folder (like `taste-gate-main/taste-gate-main`), pick the inner one.
6. Taste Gate's settings page opens by itself. Paste your **Jev key** and press **Save key**.
7. Click the puzzle-piece icon in Chrome's toolbar and pin **Taste Gate**, so it's one click away.

Chrome may show a "Disable developer mode extensions" message when it starts. That's normal for extensions installed this way: close it, don't press Disable.

---

## 2. Set up your taste with AI

Taste Gate comes with a simple **starting taste**: avoid studio shots, avoid illustrations and 3D renders, avoid websites and design layouts, and a product must be in the shot. You can see it in **Settings, Step 2**. To make it fit *your* brand:

1. In **Settings, Step 2**, press **Copy my taste**.
2. Open a capable AI chat. **Claude (Opus or Sonnet)** or **ChatGPT** work well; you don't need the most expensive models.
3. Paste the prompt below, and paste your taste where it says.
4. Answer the AI's questions. It helps a lot to share 3–5 images you love and 3–5 you'd never use (screenshots or links), if your AI can look at images.
5. The AI gives you a new taste block. In **Settings, Step 2**, press **Paste new taste from AI**, paste it and press **Use this taste**.

### Setup prompt

```text
Help me set up "Taste Gate", a Chrome extension that checks Pinterest images against my taste
while I search for references (for photoshoots, mood boards and AI image generation).

Interview me first. Ask ONE question at a time and wait for my answer. Cover:
1. What brand or project this is for, and what the images will be used for.
2. What a perfect reference image looks like for me (setting, light, people, product, mood).
3. What I never want to see (and why), even if it looks nice.
4. Whether a product must be in the picture, and what counts as my product.
5. Whether studio shots, illustrations/3D renders, website or design layouts, or food are OK.
6. How strict it should be: would I rather see a few bad images, or miss a few good ones?
If I share example images, describe what they have in common before going on.
Then summarise my taste in 5 bullet points and ask me to confirm.

After I confirm, write my taste as ONE JSON block in exactly this format:
{
  "taste_gate_settings": 1,
  "checks": {
    "studio": true,      // flag people posing on a plain studio backdrop or built studio set (product photography is always allowed)
    "product": true,     // flag images with no product in them (clothes, bags, accessories don't count as products)
    "photo": true,       // flag illustrations, cartoons and 3D renders of shops/rooms (posters built on a real photo are fine)
    "design": true,      // flag websites, shop pages, newsletters, app screens, slides, colour palettes
    "foodDrink": false   // flag in-your-face food shots, and food shown without a drink
  },
  "rules": [
    { "kind": "avoid", "text": "neon lighting" },
    { "kind": "need", "text": "warm, natural daylight" }
  ],
  "flagAt": 0.6, "unsureAt": 0.35,
  "productShotMin": 0.45, "designSure": 0.7, "notPhotoSure": 0.95
}
Rules for writing it:
- "rules": at most 8. "avoid" = flag images that show this. "need" = flag images that don't match this.
  Each rule short (2-8 words) and about ONE thing you can SEE in the picture, not a feeling.
  Don't repeat what a check already covers.
- Strictness: relaxed = flagAt 0.7 / unsureAt 0.45, balanced = 0.6 / 0.35, strict = 0.5 / 0.25.
- Leave productShotMin, designSure and notPhotoSure as they are unless I ask.
- No comments in the final block. Give me only the block after a one-line summary.

My current taste:
<PASTE YOUR TASTE HERE>
```

---

## 3. Use it on Pinterest

1. Search Pinterest as usual. Each pin gets a coloured edge as it's checked (the bar at the bottom shows progress).
2. **Hover a pin** to see why it got its colour.
3. Use the **bar at the bottom** to filter: click **Green** to see only pins that fit; click **Green** and **Orange** to see both. Other pins are covered with a glass card showing their colour and reason, with a **Show** button. **All** shows everything again.
4. **Open a pin** and Taste Gate looks for other photos **from the same shoot** (same person, outfit, set or branding). They get a green edge, move to the top of the grid below the pin and appear in a **From this shoot** row next to it. Your taste doesn't apply to these: if you liked the pin, you'll want the rest of the shoot.
5. When Taste Gate gets one wrong, hover the pin and press **Should keep** or **Should flag**. These votes are how you teach it your taste (next section).

The popup's **Checked pins** button shows every pin it has checked, with filters, your votes, and how often it agrees with you.

---

## 4. Make it smarter: improve your taste from your votes

About 20 minutes of voting is usually enough for a big improvement.

1. **Vote.** While you browse, press **Should keep** or **Should flag** on pins it got wrong. Aim for 30 or more. Votes on pins it got right help too.
2. **Export.** In the popup or **Settings, Step 3**, press **Export votes**. You get a spreadsheet (CSV) of your votes, with Jev's score for every check on every pin.
3. **Copy your taste.** **Settings, Step 2**, **Copy my taste**.
4. **Ask an AI.** Attach the CSV to a chat with Claude or ChatGPT and paste the prompt below, with your taste where it says.
5. **Paste the new taste back** (**Settings, Step 2**, **Paste new taste from AI**). Pins you've already checked are re-scored straight away, for free, and **Checked pins** shows the new agreement.

Repeat whenever it drifts from your taste.

### Improve prompt (the AI interviews you about your votes)

```text
You are helping me improve "Taste Gate", a Chrome extension that flags Pinterest images against my taste.
Attached is a CSV of pins it checked. Columns:
- verdict: what it decided (keep = green, unsure = orange, flag = red), and reason.
- your vote: my correction. "keep" = should be green, "flag" = should be red. Empty = I didn't vote.
- "score: ..." columns: Jev's probability (0 to 1) for each check. Higher = more likely true.
- pin and image: links to the pin and its picture (open the image links if you can see images).

How Taste Gate decides:
1. My own "rules" come first. "avoid" rule: its "shows" score is the chance the image breaks it.
   "need" rule: 1 minus its "matches" score is the chance it breaks it.
   Chance >= flagAt -> red; chance >= unsureAt -> orange (if nothing else is red).
2. If "product shot" >= productShotMin: red only if "design layout" >= designSure or
   "not a photo" >= notPhotoSure; otherwise green.
3. Otherwise, of the checks switched on (design layout, not a photo, no product, studio set, and the
   food checks if foodDrink is on), the highest score >= flagAt -> red, >= unsureAt -> orange, else green.

Do this in order:
1. Count how many of my votes my current taste already agrees with (my "flag" = red,
   my "keep" = green or orange), and list the pins where we disagree.
2. Group the disagreements into patterns (for example "flags images that are actually outdoors",
   "keeps images with no product"). For each pattern, show 2-3 example pin links.
3. Interview me: ask ONE question at a time about each pattern, to find what I really mean
   (what exactly makes these good or bad for me?). Wait for my answers. Max 6 questions.
4. Propose the smallest changes that agree with more of my votes: switch checks on/off,
   add/remove/reword my rules (max 8, short, about something visible), or change strictness.
   Don't make it stricter overall than my votes ask for: compare the red count before and after.
   New or reworded rules mean pins get checked again for them (it costs a little).
5. Show: agreement before -> after, red count before -> after, and each change in one plain line.
6. Then give me the complete new taste as ONE JSON block in exactly the same format as my current
   taste (no comments), ready to paste into Taste Gate.

My current taste:
<PASTE YOUR TASTE HERE>
```

---

## 5. Quick changes

You don't always need a full interview. Copy your taste, paste it into an AI chat with one of these, and paste the answer back:

- *"Here's my Taste Gate taste. Add an **avoid** rule for **neon lighting**, and give me the full block back."*
- *"Add a **need** rule: **a person in the shot**. Full block back, please."*
- *"Too many good pins are going red. Make it more **relaxed**. Full block back."*
- *"It keeps flagging outdoor shots with plain skies as studio. What should I change? Give me the full block back."*
- *"Switch off the **product** check: I'm collecting mood images, not product shots. Full block back."*

Tips for rules that work:

- Short and about **one thing you can see**: "avoid: neon lighting" works better than "avoid images that feel too nightclub-like".
- Use **avoid** for things that must never appear, **need** for things every image should have. Too many "need" rules makes most pins red.
- Up to 8 rules. Each rule adds a little to the cost of checking new pins.

---

## 6. Check it's safe before you install

You're installing code from the internet, so it's worth a check. The whole extension is a few small files you can read.

**What it can access** (from `manifest.json`):

- **Pinterest pages only**: it runs on `pinterest.com` and nowhere else.
- **`api.typesafe.ai`**: to send pin images to Jev and get the scores back.
- **`i.pinimg.com`**: to download pin images (Pinterest's image server).
- **Storage**: your key, taste, votes and results, kept in your browser only.

It has no access to your other tabs, history, passwords or other websites. Its own pages (popup, settings) load the Urbanist font from Google Fonts; nothing else is sent anywhere.

**Ask an AI to review it.** Download the ZIP, unzip it, and give an AI chat the files (or this GitHub link if it can read web pages) with this prompt:

```text
Review this Chrome extension's code for safety before I install it.
Check: what websites it can access (manifest.json), every place it sends data (fetch calls),
whether it reads anything outside Pinterest, how it stores my API key, and anything suspicious
or obfuscated. Give me a short plain-English verdict and list anything I should worry about.
```

---

## 7. Something not working?

| What you see | What to do |
|---|---|
| No coloured edges on Pinterest | Refresh the Pinterest tab. Check Taste Gate is switched on in the popup. |
| Bar says **Add your Jev key in Taste Gate settings** | Open settings (popup, top-right button) and save your key. |
| Bar says **Jev key rejected** | The key is wrong or expired. Copy it again from typesafe.ai and save it. |
| Bar says **Extension updated: refresh this page** | You reloaded or updated Taste Gate. Refresh the Pinterest tab. |
| Bar says **Jev error: try again soon** | TypeSafe had a problem or you hit a limit. Wait a minute and refresh. |
| A pin never gets a colour, or hover says **Image unavailable** | Pinterest didn't give the image (videos and some ads). Nothing to fix. |
| **Paste new taste** says the block isn't valid | Copy the AI's whole block again, from the first `{` to the last `}`. Ask the AI to "give the block again with no comments". |
| Too much red, or not enough | Vote on the wrong ones and use the improve prompt (section 4), or a quick change (section 5). |
| No **From this shoot** row on a pin | It only appears on a pin's own page, after the pins below it load. Scroll down a little. |
| **Load unpacked** says "Manifest file is missing" | You picked the outer folder. Pick the folder with `manifest.json` directly in it. |
| The bottom bar disappeared | Refresh the page. |

Still stuck? Ask an AI chat:

```text
I'm using the Taste Gate Chrome extension (code: https://github.com/dickson-wu/taste-gate) on Pinterest.
The problem: <describe what you did and what you see>.
Ask me questions one at a time to find the cause. You can ask me to open chrome://extensions
and tell you about any red "Errors" button on Taste Gate, or to right-click the page,
choose Inspect, open the Console tab and copy any red lines that mention Taste Gate.
```

---

## 8. Costs and privacy

- **Cost:** you pay TypeSafe directly for Jev. Checking a pin costs about $0.000075 (about 7–8 cents per 1,000 pins). Opening a pin costs a little more because it also looks for photos from the same shoot. Each rule of your own adds a little to each new pin. Pins are never paid for twice: results are saved and re-scored for free when you change your taste.
- **Spending** shows in the popup and on the settings page.
- **Privacy:** pin images go to TypeSafe to be checked. Your key, taste, votes and results stay in your browser. Nothing is sent to the author of this extension or anyone else.

---

## 9. Update or remove

- **Update:** download the new ZIP, replace the files in your folder, then press the reload arrow on Taste Gate in `chrome://extensions` and refresh Pinterest. Your taste, votes and results are kept.
- **Remove:** press **Remove** on Taste Gate in `chrome://extensions`. This deletes your key, taste and saved results from the browser.
