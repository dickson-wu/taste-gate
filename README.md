# Taste Gate for Pinterest

Stop judging hundreds of Pinterest images by "I feel" and "I think". Write your taste down once (an AI chat does the writing for you), and Taste Gate checks every pin as you scroll:

- 🟢 **Green** fits your taste
- 🟠 **Orange** is unsure: worth a quick look
- 🔴 **Red** breaks your taste (hover to see why)

You skip the red ones and pick references from what's left, so finding references for AI image generation takes minutes instead of half an hour of scrolling and decision fatigue.

Taste Gate isn't one-size-fits-all. You don't have to describe your taste either: **you show it**. Vote keep or flag on pins for about 20 minutes, export your votes, and an AI chat (Claude, ChatGPT or similar) studies them, asks you a few questions, and writes your taste as rules for Taste Gate.

It looks at images with **Jev by TypeSafe**, using **your own Jev key**. Checking 1,000 images costs about **7–8 US cents**.

---

## Contents

1. [Install (5 minutes)](#1-install-5-minutes)
2. [Use it on Pinterest](#2-use-it-on-pinterest)
3. [Teach it your taste: vote, then let AI learn from your votes](#3-teach-it-your-taste-vote-then-let-ai-learn-from-your-votes)
4. [Quick changes](#4-quick-changes)
5. [Check it's safe before you install](#5-check-its-safe-before-you-install)
6. [Something not working?](#6-something-not-working)
7. [Costs and privacy](#7-costs-and-privacy)
8. [Update or remove](#8-update-or-remove)

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

## 2. Use it on Pinterest

Taste Gate works straight away with a basic **starting taste**: avoid studio shots, a product must be in the shot, avoid illustrations and 3D renders, avoid websites and design layouts. Section 3 turns it into *your* taste.

1. Search Pinterest as usual. Each pin gets a coloured edge as it's checked (the bar at the bottom shows progress).
2. **Hover a pin** to see why it got its colour, plus two buttons: **Should keep** and **Should flag**.
3. Use the **bar at the bottom** to filter: click **Green** to see only pins that fit; click **Green** and **Orange** to see both. Other pins are covered with a glass card showing their colour and reason, with a **Show** button. **All** shows everything again.
4. **Open a pin** and Taste Gate looks for other photos **from the same shoot** (same person, outfit, set or branding). They get a green edge, move to the top of the grid below the pin and appear in a **From this shoot** row next to it. Your taste doesn't apply to these: if you liked the pin, you'll want the rest of the shoot.

The popup's **Checked pins** button shows every pin it has checked, with filters, your votes, and how often it agrees with you.

---

## 3. Teach it your taste: vote, then let AI learn from your votes

You don't need to know how to describe your taste. Most people can't; they just know it when they see it. So you **show** it instead: vote on pins, and an AI chat works out the rules from your votes.

### Step 1: Vote (about 20 minutes)

Browse Pinterest for the kind of images you need. Hover pins and press:

- **Should keep** on any pin you'd actually use as a reference
- **Should flag** on any pin you wouldn't use

Vote on pins of **every colour**, not just the ones it got wrong: the green ones you love, the green ones you'd never use, the red ones it was right about. Don't overthink it: go with your gut. Aim for **40 or more votes**, with a good mix of keeps and flags.

### Step 2: Export your votes and copy your taste

- In the popup or **Settings, Step 3**, press **Export votes**. You get a spreadsheet (CSV): every pin with your vote, what Taste Gate decided, Jev's score for each check, and a link to the image.
- In **Settings, Step 2**, press **Copy my taste**.

### Step 3: Let AI study your votes

Open a capable AI chat: **Claude (Opus or Sonnet)** or **ChatGPT** work well; you don't need the most expensive models. Attach the CSV, paste the prompt below, and paste your taste where it says.

The AI looks at what your kept pins have in common and what your flagged pins have in common, asks you a few short questions about what it found, and writes your taste as rules.

### Step 4: Paste the new taste back

In **Settings, Step 2**, press **Paste new taste from AI**, paste the block and press **Use this taste**. Pins you've already checked are re-scored straight away, for free, and **Checked pins** shows how often it now agrees with you.

**Repeat** whenever you notice it getting things wrong: vote on a few more pins, export, and run the prompt again. Each round gets closer to your taste.

### Learn-my-taste prompt

```text
You are helping me teach "Taste Gate", a Chrome extension that checks Pinterest images against my taste.
I can't fully describe my taste, so I showed it instead: I voted on pins. Your job is to work out my taste
from my votes, check it with me, and write it as rules the extension can use.

Attached is a CSV of pins it checked. Columns:
- your vote: "keep" = I'd use this as a reference. "flag" = I wouldn't. Empty = I didn't vote.
- verdict and reason: what Taste Gate decided with my current taste (keep = green, unsure = orange, flag = red).
- "score: ..." columns: Jev's probability (0 to 1) for each check. Higher = more likely true.
- pin and image: links to the pin and its picture.

How Taste Gate decides:
1. My own "rules" come first. "avoid" rule: its "shows" score is the chance the image breaks it.
   "need" rule: 1 minus its "matches" score is the chance it breaks it.
   Chance >= flagAt -> red; chance >= unsureAt -> orange (if nothing else is red).
2. If "product shot" >= productShotMin: red only if "design layout" >= designSure or
   "not a photo" >= notPhotoSure; otherwise green.
3. Otherwise, of the checks switched on (design layout, not a photo, no product, studio set, and the
   food checks if foodDrink is on), the highest score >= flagAt -> red, >= unsureAt -> orange, else green.

Do this in order:
1. LOOK at the pictures. Open the image links of my voted pins (as many as you can, keeps and flags).
   If you can't open image links, say so and ask me to upload screenshots of about 10 kept and
   10 flagged pins instead. Don't guess my taste from the scores alone.
2. Describe what my KEPT pins have in common and what my FLAGGED pins have in common: setting, light,
   colours, people, product, composition, mood, style. Point out where I'm consistent and where I'm not.
3. Count how many of my votes my current taste already agrees with (my "flag" = red,
   my "keep" = green or orange), and list where it disagrees with me.
4. Interview me: ask ONE short question at a time about the patterns you found, to check what really
   makes a picture good or bad for me (for example "You flagged these 4 outdoor shots. Was it the harsh
   light, or that there's no product?"). Show 2-3 pin links as examples with each question.
   Wait for my answer each time. Max 6 questions.
5. Write my taste: switch the ready-made checks on/off, write my own rules (max 8; each short, 2-8 words,
   about ONE thing you can SEE in a picture, not a feeling), and pick the strictness.
   "avoid" = flag pictures that show this. "need" = flag pictures that don't match this.
   Strictness: relaxed = flagAt 0.7 / unsureAt 0.45, balanced = 0.6 / 0.35, strict = 0.5 / 0.25.
   Don't make it stricter than my votes ask for.
6. Show me: my taste in 5 plain bullet points, agreement before -> your estimate after, and each change
   in one line. Note that new rules mean pins get checked again for them (it costs a little).
7. Then give me the complete new taste as ONE JSON block in exactly the same format as my current
   taste (no comments), ready to paste into Taste Gate.

My current taste:
<PASTE YOUR TASTE HERE>
```

---

## 4. Quick changes

Already know something you want changed? Copy your taste, paste it into an AI chat with one of these, and paste the answer back:

- *"Here's my Taste Gate taste. Add an **avoid** rule for **neon lighting**, and give me the full block back."*
- *"Add a **need** rule: **a person in the shot**. Full block back, please."*
- *"Too many good pins are going red. Make it more **relaxed**. Full block back."*
- *"Switch off the **product** check: I'm collecting mood images, not product shots. Full block back."*

Tips for rules that work:

- Short and about **one thing you can see**: "avoid: neon lighting" works better than "avoid images that feel too nightclub-like".
- Use **avoid** for things that must never appear, **need** for things every image should have. Too many "need" rules makes most pins red.
- Up to 8 rules. Each rule adds a little to the cost of checking new pins.

---

## 5. Check it's safe before you install

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

## 6. Something not working?

| What you see | What to do |
|---|---|
| No coloured edges on Pinterest | Refresh the Pinterest tab. Check Taste Gate is switched on in the popup. |
| Bar says **Add your Jev key in Taste Gate settings** | Open settings (popup, top-right button) and save your key. |
| Bar says **Jev key rejected** | The key is wrong or expired. Copy it again from typesafe.ai and save it. |
| Bar says **Extension updated: refresh this page** | You reloaded or updated Taste Gate. Refresh the Pinterest tab. |
| Bar says **Jev error: try again soon** | TypeSafe had a problem or you hit a limit. Wait a minute and refresh. |
| A pin never gets a colour, or hover says **Image unavailable** | Pinterest didn't give the image (videos and some ads). Nothing to fix. |
| **Paste new taste** says the block isn't valid | Copy the AI's whole block again, from the first `{` to the last `}`. Ask the AI to "give the block again with no comments". |
| Too much red, or not enough | Vote on more pins and run the learn-my-taste prompt again (section 3), or use a quick change (section 4). |
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

## 7. Costs and privacy

- **Cost:** you pay TypeSafe directly for Jev. Checking a pin costs about $0.000075 (about 7–8 cents per 1,000 pins). Opening a pin costs a little more because it also looks for photos from the same shoot. Each rule of your own adds a little to each new pin. Pins are never paid for twice: results are saved and re-scored for free when you change your taste.
- **Spending** shows in the popup and on the settings page.
- **Privacy:** pin images go to TypeSafe to be checked. Your key, taste, votes and results stay in your browser. Nothing is sent to the author of this extension or anyone else.

---

## 8. Update or remove

- **Update:** download the new ZIP, replace the files in your folder, then press the reload arrow on Taste Gate in `chrome://extensions` and refresh Pinterest. Your taste, votes and results are kept.
- **Remove:** press **Remove** on Taste Gate in `chrome://extensions`. This deletes your key, taste and saved results from the browser.

---

## Licence

Free to use, change and share under the [MIT licence](LICENSE).
