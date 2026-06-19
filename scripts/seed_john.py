#!/usr/bin/env python3
"""Reset the vault to the "John" demo: a fresh person, ~a month of real journals.

This replaces the earlier demo persona entirely. Unlike ``seed_demo.py`` (which
wrote DB-only, ``is_seeded=1`` rows for the mood chart), every journal here is a
**real entry** (``is_seeded=0``): it lands in the L0 Markdown vault as the source
of truth AND is indexed into SQLite + embedded into ChromaDB, exactly the way a
genuinely-written entry flows through ``memory.capture``. So the entries are
browsable, recall-able, and editable — and the Insights screens derive from them
as real data, with no demo toggle needed.

What it does, in order:

  1. **Backs up** the current vault's data (profile + journal Markdown + eva.db)
     into ``local_vault.bak-<timestamp>/`` so the reset is reversible.
  2. **Wipes** the old data: every journal day-file, ``profile.{json,md}``, all
     index/extraction/mood/graph/chat rows, and the journal vector collection.
     (Both ``is_seeded=0`` and the old ``is_seeded=1`` demo rows go — this is a
     clean slate, not a merge.)
  3. Writes **John's profile** (``profile.json`` + ``profile.md``) via the L3 seam.
  4. Writes **~30 backdated journal entries** spread across the past month, each
     at its own time of day, with hand-authored extraction data (mood, emotions,
     themes, summary) so the entries look like they came through the real
     pipeline — no model call required.

John's arc: a man buried in his phone (9h/day, doomscrolling, takeout, isolation,
bad sleep) who, over a month, deletes the apps, starts walking then running,
cooks real food, reconnects with friends and his sister, and reads again. The
mood line trends up with believable dips and one blank day.

Usage (from anywhere):
    backend/.venv/bin/python scripts/seed_john.py
    backend/.venv/bin/python scripts/seed_john.py --no-embed   # skip ChromaDB
"""

from __future__ import annotations

import argparse
import logging
import shutil
import sys
import textwrap
from datetime import date, datetime, time, timedelta
from pathlib import Path

# Run from anywhere: make the backend package importable.
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from memory import db, graph, profile, vault, vault_dir  # noqa: E402

log = logging.getLogger("eva.seed_john")

# Demo journal photos that travel with the repo (the vault itself is gitignored,
# so they can't live there). They are copied into <vault>/journal/media/ at seed
# time and referenced from the journal Markdown as ![caption](media/<file>), so
# the entries show real images while everything still loads offline from
# loopback. Because demo_reset.py re-runs this seed, the photos are restored on
# every reset too.
_SEED_MEDIA = Path(__file__).resolve().parent / "seed_assets" / "journal_media"


def _emo(*pairs: tuple[str, float]) -> list[dict]:
    """Build the emotions list shape ([{name, intensity}, …]) tersely."""
    return [{"name": name, "intensity": intensity} for name, intensity in pairs]


# ─────────────────────────────────────────────────────────────────────────────
# John's month. Each tuple is:
#   (days_ago, (hour, minute), mood, themes, emotions, summary, body)
# `mood` is -5..5 (None for the one blank, un-scored day). `body` is the journal
# entry itself (first person, what John wrote); `summary` is the short line the
# extraction would have distilled (used by the mood tooltip + recall + graph).
# Times are spread across the day to fit each entry (1am doomscroll, 7am walk …).
# ─────────────────────────────────────────────────────────────────────────────
JOHN_DAYS: list[tuple[int, tuple[int, int], int | None, list[str], list[dict], str, str]] = [
    (33, (1, 14), -3, ["screen time", "sleep"], _emo(("anxiety", 0.6), ("fatigue", 0.7)),
     "Another night lost to the phone — nine hours of screen time and nothing to show for it.",
     """
        # The window I keep watching my life through

        It's 1am. Again. I'm still scrolling, and I told myself *one more video*
        somewhere around four hundred videos ago.

        ![1:47am — nine hours in, and I can't name a single thing I saw](media/doomscroll.jpg)

        The phone doesn't dress it up:

        > **Screen Time today — 9h 14m.**

        Nine hours. I can't remember one thing I looked at. My eyes are burning, the
        flat is dark, and the only light in the room is this one. I feel like I've
        spent the whole day pressed against a window, watching my own life happen on
        the other side of the glass.

        Tomorrow I'll do better. I know I've written that before.
        """),
    (31, (23, 40), -2, ["food", "screen time", "exercise"], _emo(("guilt", 0.5), ("numbness", 0.5)),
     "Skipped the gym, ordered takeout again, watched YouTube until 2am.",
     """
        ## Third takeout this week

        I had every intention of going to the gym tonight. Instead I lay on the
        couch and let autoplay decide my evening for me.

        The food showed up, was gone in ten minutes, and I didn't taste a bite of it.
        Then it was YouTube until 2am — that soft grey static where you're not really
        enjoying anything, just *not stopping*.

        Something is off, underneath everything. And every time it gets close enough
        to actually look at, I reach for the phone and numb it back down again.
        """),
    (30, (7, 5), -2, ["screen time", "habits"], _emo(("frustration", 0.6), ("numbness", 0.4)),
     "Checked my phone before my feet even hit the floor — two hours gone before breakfast.",
     """
        ## Two hours gone before breakfast

        I reached for the phone before I was properly awake — before my feet even hit
        the floor.

        Next time I looked up it was two hours later. I hadn't eaten. Hadn't moved.
        Hadn't done a single thing except thumb through other people's mornings while
        my own one drained away.

        > What a way to start a day.

        The part that gets me is how *normal* it felt. Like this is just how mornings
        go now.
        """),
    (29, (22, 30), -3, ["friends", "screen time", "mood"], _emo(("loneliness", 0.7), ("envy", 0.5)),
     "Felt invisible — no real conversation in days, just watching everyone else's lives.",
     """
        ## Surrounded by a thousand people I'll never meet

        It hit me tonight that I haven't had a real conversation with anyone in about
        a week. Not a text, not a comment — an actual, out-loud conversation.

        Everyone on the feed looks like they're out *living*: dinners, trips, people.
        And here I am in the dark, watching them do it, double-tapping a life I'm not
        in.

        It's a strange kind of lonely — the loneliest I've felt — and I'm never
        technically alone. There's always another face to scroll to. None of them
        know I exist.
        """),
    (28, (20, 50), -3, ["friends", "screen time"], _emo(("loneliness", 0.6), ("guilt", 0.5)),
     "Cancelled on the coworkers' drinks to stay in and watch nothing in particular.",
     """
        ## I said I was tired

        The guys asked me out for drinks after work. I said I was tired.

        I wasn't tired. I just couldn't face being *around* people, so I came home and
        stared at a screen for four hours instead — which is somehow more exhausting
        than any night out has ever been.

        I think I'm quietly disappearing, and the thing that scares me is that nobody
        has noticed yet. Least of all me.
        """),
    (27, (0, 40), -1, ["screen time", "habits"], _emo(("frustration", 0.6), ("resolve", 0.4)),
     "142 phone unlocks in one day. Something has to change.",
     """
        # I finally did the maths

        I stopped looking away from the numbers tonight and actually added them up:

        ```
        Daily average    9h 02m
        Phone unlocks    142
        Pickups / hour   ~9
        First pickup     before I'm even out of bed
        ```

        142 unlocks. More than half my waking life spent looking at a slab of glass.

        I don't want to reach the end of this year and find it was mostly *this*. I'm
        not okay with it. Something has to give — and for once I mean it enough to be a
        little angry about it.
        """),
    (26, (21, 15), 0, ["screen time", "habits"], _emo(("restlessness", 0.6), ("hope", 0.4)),
     "Deleted Instagram and TikTok off my phone. My hands keep reaching for nothing.",
     """
        ## Deleted them

        I did it. The worst offenders — **Instagram** and **TikTok** — gone off the
        phone.

        The strangest part came after: my thumb keeps going to the spot where the icon
        used to be and opening… nothing. Like a tongue going back to a missing tooth,
        over and over.

        It's uncomfortable. There's a low hum of *what do I do with my hands now*.

        I think that discomfort is the whole point. If it were easy, it wouldn't have
        had me for nine hours a day.
        """),
    (24, (18, 20), 1, ["walking", "exercise", "nature"], _emo(("calm", 0.6), ("relief", 0.4)),
     "First walk in months — just 20 minutes around the block, and the air felt good.",
     """
        # Twenty minutes, no phone

        Went for a walk after work. No podcast, no music, no phone in my hand — just me
        and the street and whatever happened to be there.

        ![The light going gold on the rooftops](media/walk.jpg)

        Only twenty minutes around the block, but I actually *noticed* things:

        - a front garden I must have passed a hundred times
        - the light going gold on the rooftops
        - how quiet my own head gets when nothing is feeding it

        I came back calmer than I've been in weeks. Funny that the cure was the most
        boring thing imaginable.
        """),
    (23, (0, 55), -1, ["screen time", "habits"], _emo(("shame", 0.6), ("frustration", 0.4)),
     "Caved and reinstalled one of the apps at midnight. The old groove is strong.",
     """
        ## The old groove is still there

        I reinstalled it. Just to *check one thing*, I said — and lost another hour
        standing in the kitchen with my coat still on.

        I felt stupid afterwards. A bit ashamed, honestly.

        But I'm trying to read it as data instead of failure: the pull is real, it's
        strong, and pretending it isn't won't get me anywhere. I deleted the app again
        before bed. Round two.
        """),
    (22, (19, 30), 0, ["sleep", "screen time", "habits"], _emo(("hope", 0.5), ("determination", 0.4)),
     "Bought a cheap alarm clock so the phone can charge outside the bedroom.",
     """
        ## A three-pound experiment

        Bought an actual alarm clock today. Three pounds. The whole point is that the
        phone now charges out in the hallway instead of six inches from my head.

        ![Analog. The phone sleeps in the hall now.](media/alarmclock.jpg)

        The logic is simple:

        > If it isn't within arm's reach, maybe I won't start *and* end the day with it.

        We'll see if I actually leave it out there at 1am, or if I go padding down the
        hall to rescue it. Small test — but it feels like reclaiming the two places the
        habit was worst: the bed and the morning.
        """),
    (21, (20, 10), 1, ["cooking", "food"], _emo(("pride", 0.5), ("calm", 0.5)),
     "Cooked an actual dinner — pasta and a salad — instead of ordering in.",
     """
        # I cooked an actual dinner

        Made dinner from scratch tonight for the first time in… I genuinely don't know
        how long.

        ![Nothing clever. Pasta, pesto, a handful of tomatoes.](media/pasta.jpg)

        Nothing clever — pasta, a bit of salad. But I *chopped* things. I stood at the
        stove and stirred, and the flat started to smell like somewhere a person
        actually lives.

        And I ate it at the table. Not the couch, not over a screen. Just me and a
        plate and ten quiet minutes. It felt almost like taking care of myself — I'd
        forgotten that was something you could *do* for yourself, not just survive.
        """),
    (20, (21, 40), 2, ["friends", "connection"], _emo(("warmth", 0.6), ("relief", 0.5)),
     "Texted Marcus after about a year. He replied right away and we made plans.",
     """
        ## I texted Marcus

        After nearly a year, I finally messaged Marcus — which is embarrassing for a
        friendship that used to be daily.

        ![Plans, finally](media/morning.jpg)

        He wrote back inside a minute:

        > *mate, where have you BEEN*

        And just like that, we're getting dinner next week. The thing I'd built into
        this huge dreaded mountain took ten seconds, and felt like setting down
        something I'd been carrying for months without noticing.
        """),
    (19, (22, 25), 1, ["reading", "habits"], _emo(("focus", 0.5), ("calm", 0.5)),
     "Picked up the book that's been on my nightstand for a year. Read 30 pages.",
     """
        ## Thirty pages

        I read tonight. *Actually* read — the book that's been gathering dust on the
        nightstand since last summer.

        ![The book that waited a year](media/reading.jpg)

        At first my attention kept skittering off, reaching for a phone that wasn't
        there. But after a few pages it settled, and then it *held*, and by the end
        I'd lost track of the time completely.

        Thirty pages. I'd missed this, and I didn't even know it was gone.
        """),
    (18, (23, 10), None, ["rest"], _emo(("tired", 0.5)),
     "A flat, blurry day. Didn't do much, didn't really track it.",
     """
        ## A grey, in-between day

        Not much to say about today.

        One of those flat, blurry days that doesn't really add up to anything — I
        didn't scroll much, but I didn't do much else either. Just tired in a way that
        sleep doesn't seem to fix.

        Some days are only for getting through, and that's allowed. I'm not going to
        score this one. I'm just going to go to bed.
        """),
    (17, (12, 30), 1, ["cooking", "food", "walking"], _emo(("calm", 0.5), ("pride", 0.4)),
     "Walked to the farmers market and cooked with real vegetables. Felt almost wholesome.",
     """
        # Market morning

        Walked to the farmers market this morning — twenty-five minutes each way — and
        came home with a bag of *actual vegetables* instead of a delivery left on the
        step.

        ![Real food, chosen by hand](media/market.jpg)

        Spent the whole afternoon on a big pot of stew. There's something steadying
        about a slow task you do entirely with your hands — chop, stir, wait, taste.

        The flat smells incredible. I feel almost wholesome, which is not a word I'd
        have used about myself a month ago.
        """),
    (16, (7, 0), 2, ["walking", "screen time", "focus"], _emo(("calm", 0.6), ("energy", 0.5)),
     "Morning walk before work, phone left at home. Clear head all morning.",
     """
        ## The mornings might be the key

        Tried something new: walked *before* work, and left the phone face-down on the
        kitchen table.

        Thirty minutes. I felt almost anxious without it at first — a phantom weight in
        my empty hand — and then, somewhere along the river path, weirdly free.

        My head stayed clear the entire morning. The kind of clear I used to have for
        free and stopped noticing I'd lost. I'm starting to think the mornings are
        where this whole thing is won or lost.
        """),
    (15, (16, 45), -1, ["work", "screen time", "mood"], _emo(("stress", 0.6), ("awareness", 0.4)),
     "Stressful day; caught myself scrolling for an hour to numb out — but I noticed it.",
     """
        ## A small win inside a bad day

        Rough one at work — a deadline moved, and a meeting that went in circles for an
        hour and arrived nowhere.

        I looked up and realised I'd been scrolling for a solid hour. The old
        anaesthetic, kicking in right on cue.

        But here's the difference, and it's the whole point:

        > I *noticed*.

        A month ago I wouldn't have. I put the phone down, made a cup of tea, and stood
        at the window for a minute. The bad day stayed bad — but I didn't pour it into
        the screen this time.
        """),
    (14, (20, 30), 2, ["friends", "connection"], _emo(("joy", 0.7), ("gratitude", 0.6)),
     "Dinner with Marcus — laughed for hours and didn't touch my phone once.",
     """
        # Dinner with Marcus

        Three hours. Two coffees after the meal. And I genuinely did not think about my
        phone once the entire time.

        ![Three hours, two coffees, phone untouched](media/dinner.jpg)

        We picked up exactly where we left off, like the missing year just folded shut.
        I'd forgotten what it feels like to laugh until your face actually aches.

        Walking home I felt *full* — and not the heavy, regretful full that takeout
        leaves. The other kind. The kind that lasts.
        """),
    (13, (19, 0), 2, ["cooking", "food", "habits"], _emo(("satisfaction", 0.6), ("calm", 0.5)),
     "Cooked a big batch of soup for the week. Starting to like this version of me.",
     """
        ## Batch day

        Made a giant pot of soup so lunches are sorted for the whole week.

        A month ago, "batch-cooking on a Sunday" would have sounded like the most
        boring sentence ever written. Tonight it felt like a quiet kind of pride —
        future-me, taken care of, by present-me.

        I'm starting to actually *like* the person doing these small, unglamorous
        things. That's new. I wanted to write it down before the feeling gets ordinary.
        """),
    (12, (7, 30), 1, ["running", "exercise"], _emo(("pride", 0.5), ("fatigue", 0.5)),
     "First proper run — couch-to-5k week one. My lungs hated me, but I did it.",
     """
        # Couch to 5K — day one

        Started a running plan today. Week one, day one.

        ![Week one, day one](media/running.jpg)

        The honest report:

        - **Run intervals:** about 90 seconds before my lungs filed a formal complaint
        - **Walk intervals:** felt like victory laps
        - **Dignity:** questionable; I'm sure I looked ridiculous

        But I finished the whole thing. The run part felt like dying and the walk part
        felt like winning, and somehow — against all reason — I already want to go
        again.
        """),
    (11, (8, 0), 3, ["sleep", "screen time"], _emo(("calm", 0.6), ("energy", 0.6)),
     "Slept eight hours for the first time in ages. Screen time down to three hours.",
     """
        # Eight hours

        I slept eight hours. Real, unbroken sleep, with the phone charging out in the
        hall where it's lived for two weeks now.

        ![Woke up before the alarm — actually rested](media/morningbed.jpg)

        I woke up *before* the alarm, feeling like a person instead of a notification
        with a pulse. Out of curiosity I checked the weekly numbers:

        ```
        This week     3h 04m / day
        A month ago   9h 02m / day
        Returned      ~6 hours a day
        ```

        I read that last line twice. Six hours a day, handed back to me.
        """),
    (10, (21, 50), 2, ["reading", "screen time"], _emo(("calm", 0.6), ("contentment", 0.5)),
     "Phone stayed in a drawer all evening while I read. Didn't even miss it.",
     """
        ## Didn't even miss it

        Put the phone in a drawer after dinner — properly out of sight — and read until
        I was sleepy.

        The remarkable part isn't that I lasted the evening. It's that I *didn't miss
        it*. Didn't think about it, didn't feel the tug at all.

        A month ago an evening like this would have felt like punishment. Tonight it
        just felt like rest. Same evening, completely different person living it.
        """),
    (9, (18, 15), 0, ["work", "exercise", "habits"], _emo(("frustration", 0.4), ("acceptance", 0.5)),
     "Missed two days of walks — work swallowed me. Not beating myself up over it.",
     """
        ## Two missed days isn't falling off

        Work ate the last two days whole. The walks didn't happen, the plan slipped.

        The old me would have taken that as proof the whole thing was a fraud and
        quietly quit — *see, you always do this*.

        Today I just… noted it. Then planned tomorrow's walk.

        > Missing two days isn't falling off. It's just two days.

        That sentence would have been impossible for me a month ago. Back at it in the
        morning.
        """),
    (8, (19, 20), 2, ["family", "connection"], _emo(("warmth", 0.6), ("gratitude", 0.5)),
     "Called my sister Sarah and talked for an hour. Realised how much I'd been hiding.",
     """
        ## An hour on the phone with Sarah

        Rang my sister. No reason, no occasion — just to talk. We were on for an hour.

        ![Her voice. An hour of it.](media/coffee.jpg)

        She told me she'd been worried. That I'd gone quiet for *months* and she hadn't
        known how to reach me. Hearing that landed somewhere deep.

        I hadn't realised how far I'd pulled back — from her, from everyone. It was so
        good to hear her voice. I'm going to do this more. I mean it this time.
        """),
    (7, (22, 40), 3, ["reading"], _emo(("pride", 0.6), ("joy", 0.5)),
     "Finished the book — first one in two years. Started another the same night.",
     """
        # Finished it

        The whole book, cover to cover — the first one I've finished in maybe two
        years.

        ![One down. Straight into the next.](media/books.jpg)

        I sat with the last page for a minute. Then I got up, pulled another off the
        shelf, and started it the same night.

        There's a hunger coming back that all the scrolling had buried — for a mind
        that stays in one place long enough to actually *go* somewhere. I think that
        might be the thing I missed most of all.
        """),
    (6, (7, 45), 2, ["running", "cooking", "reading", "habits"], _emo(("calm", 0.6), ("contentment", 0.5)),
     "Run, cook, read — the rhythm that's holding me together now.",
     """
        ## The shape of a day now

        There's a rhythm holding me together lately. Nothing dramatic — just a shape:

        - a **walk or a run** in the morning
        - something **cooked** in the evening
        - a **book** before bed, phone in the drawer

        None of it would make a highlight reel. But it's the scaffolding the phone used
        to be — except this version holds me *up* instead of hollowing me out.

        I trust it a little more every day.
        """),
    (5, (20, 0), 3, ["friends", "cooking", "connection"], _emo(("joy", 0.7), ("pride", 0.6)),
     "Group dinner — Marcus brought friends and I cooked for everyone.",
     """
        # I had people over

        Marcus came, and brought two friends I'd never met. And I cooked for all of
        them — the big stew, fresh bread, the whole spread.

        ![I cooked for all of them](media/friendsdinner.jpg)

        The flat was loud and warm and a bit chaotic, and for once I was right in the
        *middle* of it instead of hiding at the edge.

        Someone asked for the recipe.

        > I can't remember the last time I felt this useful — or this *seen*.
        """),
    (4, (17, 30), 1, ["work", "screen time", "walking"], _emo(("anxiety", 0.5), ("resolve", 0.5)),
     "Anxious work week; the old urge to vanish into the phone came back. Went for a walk instead.",
     """
        ## The undertow came back — and I swam

        Hard week, and I felt the old undertow: that pull to just dissolve into the
        screen and not come back up for air.

        The difference now is that I recognise the feeling for exactly what it is.

        So instead of going under, I laced up and walked it out — forty minutes, until
        the knot in my chest finally loosened.

        The pull doesn't vanish. I'm just getting better at *answering* it differently.
        """),
    (3, (21, 30), 3, ["screen time", "habits"], _emo(("pride", 0.6), ("gratitude", 0.6)),
     "Average screen time this week: 2h40m, down from nine. Hard to believe.",
     """
        # Two hours forty

        Checked the weekly report and had to look at it twice.

        ```
        Screen time     2h 40m / day
        One month ago   9h 00m / day
        Difference      ~6h 20m returned, every single day
        ```

        Six hours a day, handed back — for walking, cooking, Marcus, Sarah, books,
        sleep.

        And the strangest part is that it doesn't feel like *willpower* anymore. I'm
        not white-knuckling anything. It just feels like my life finally fits me,
        instead of the other way round.
        """),
    (2, (11, 0), 2, ["running", "reading", "nature"], _emo(("calm", 0.6), ("contentment", 0.6)),
     "Long Saturday run by the lake, then read in the park. No screens till evening.",
     """
        # Saturday, the way they're meant to feel

        A proper Saturday. Ran down by the lake — and I can do **three kilometres
        without stopping** now, which would have been pure fantasy a month ago.

        ![Three kilometres without stopping. Then a book in the park.](media/lake.jpg)

        Then I sat in the park and read until the light went.

        Didn't look at my phone until after dinner — and I only noticed *that* later,
        which is the whole point. It's becoming the default now, not the discipline.
        """),
    (1, (22, 0), 3, ["reflection", "growth", "habits"], _emo(("gratitude", 0.7), ("hope", 0.6)),
     "Looked back at where I was a month ago and barely recognise him.",
     """
        # One month

        I read back through this whole journal tonight, from the very first entry.

        ![Same flat, same job — but living it now](media/sunrise.jpg)

        The man at the top — nine hours of screen time, no one to call, watching
        everyone else's life through glass — I genuinely barely recognise him. And it
        was *four weeks ago*.

        Same flat. Same job. Most of the same problems, honestly.

        > But I'm living it now, instead of watching it scroll past.

        I want to remember this feeling for the next time it gets hard. Because it will
        get hard again — and when it does, I'll have this to read back to.
        """),
]


# ─────────────────────────────────────────────────────────────────────────────
# John's profile (EVA_MEMORY_ARCHITECTURE §7.2). Shaped to match the journals
# above so Eva's context lands: the goals he's stated, the patterns the entries
# show, the people he reconnected with, what helps and what trips him. Evidence
# ids are filled with REAL entry ids after the entries are written (see main()).
# ─────────────────────────────────────────────────────────────────────────────
def build_john_profile(by_theme: dict[str, list[str]]) -> dict:
    """Build John's profile.json dict, citing real entry ids by theme as evidence.

    ``by_theme`` maps a theme to the entry ids that carry it, so each goal/pattern
    points at entries that genuinely mention it — the same honesty the graph keeps.
    """

    def ev(*themes: str, limit: int = 3) -> list[str]:
        ids: list[str] = []
        for t in themes:
            ids.extend(by_theme.get(t, []))
        # De-dupe preserving order, cap so the evidence stays illustrative.
        seen: list[str] = []
        for i in ids:
            if i not in seen:
                seen.append(i)
        return seen[:limit]

    return {
        "schema_version": 1,
        "identity": {
            "stated_self": "someone trying to live more deliberately and less online",
            "principles": ["presence", "discipline", "connection"],
            "provenance": ev("screen time", "reflection"),
        },
        "goals": [
            {
                "id": "g-1a2b3c4d-0001-4e8d-9a11-1f0c2d3e4a5b",
                "text": "Cut down screen time and stay off the phone late at night",
                "status": "active", "confidence": 0.88, "last_seen": _iso_days_ago(3),
                "evidence": ev("screen time"), "source": "model",
            },
            {
                "id": "g-1a2b3c4d-0002-4e8d-9a11-1f0c2d3e4a5b",
                "text": "Exercise regularly — build up from walks to running",
                "status": "active", "confidence": 0.8, "last_seen": _iso_days_ago(2),
                "evidence": ev("running", "walking", "exercise"), "source": "model",
            },
            {
                "id": "g-1a2b3c4d-0003-4e8d-9a11-1f0c2d3e4a5b",
                "text": "Cook real food at home instead of ordering takeout",
                "status": "active", "confidence": 0.76, "last_seen": _iso_days_ago(5),
                "evidence": ev("cooking", "food"), "source": "model",
            },
            {
                "id": "g-1a2b3c4d-0004-4e8d-9a11-1f0c2d3e4a5b",
                "text": "Read books again",
                "status": "active", "confidence": 0.74, "last_seen": _iso_days_ago(2),
                "evidence": ev("reading"), "source": "model",
            },
            {
                "id": "g-1a2b3c4d-0005-4e8d-9a11-1f0c2d3e4a5b",
                "text": "Reconnect with friends and family",
                "status": "active", "confidence": 0.79, "last_seen": _iso_days_ago(5),
                "evidence": ev("friends", "family", "connection"), "source": "model",
            },
        ],
        "patterns": [
            {
                "id": "p-5e6f7a8b-0001-4d55-8a99-7b8c9d0e1f2a",
                "text": "Reaches for the phone to numb out when bored, lonely, or stressed",
                "type": "behavior", "confidence": 0.82, "last_seen": _iso_days_ago(4),
                "evidence": ev("screen time", "mood"), "source": "model",
            },
            {
                "id": "p-5e6f7a8b-0002-4d55-8a99-7b8c9d0e1f2a",
                "text": "Withdraws from people and cancels plans when his mood dips",
                "type": "behavior", "confidence": 0.7, "last_seen": _iso_days_ago(8),
                "evidence": ev("friends", "family"), "source": "model",
            },
            {
                "id": "p-5e6f7a8b-0003-4d55-8a99-7b8c9d0e1f2a",
                "text": "Drops his new routines first when work stress spikes",
                "type": "behavior", "confidence": 0.66, "last_seen": _iso_days_ago(9),
                "evidence": ev("work", "exercise"), "source": "model",
            },
        ],
        "relationships": [
            {
                "name": "Marcus", "type": "friend",
                "summary": "Close old friend John had drifted from; reconnecting has been a turning point",
                "evidence": ev("friends", "connection"), "last_seen": _iso_days_ago(5),
            },
            {
                "name": "Sarah", "type": "family",
                "summary": "His sister; had been worried about how quiet he'd gone. They're talking again",
                "evidence": ev("family"), "last_seen": _iso_days_ago(8),
            },
        ],
        "emotional_baseline": {
            "typical_mood": 2,
            "known_triggers": ["late-night scrolling", "work stress", "boredom", "loneliness"],
            "what_helps": ["a walk or a run", "cooking", "calling a friend", "reading", "sleep"],
            "evidence": ev("walking", "running", "sleep"),
        },
        "open_loops": [
            {
                "id": "o-9d0e1f2a-0001-4f77-8c11-9d0e1f2a3b4c",
                "description": "Building a steady morning routine that replaces the phone",
                "status": "updated", "opened": _iso_days_ago(26), "last_updated": _iso_days_ago(3),
                "evidence": ev("screen time", "walking", "habits"),
            },
        ],
        "watch_list": [
            {
                "pattern_id": "p-5e6f7a8b-0001-4d55-8a99-7b8c9d0e1f2a",
                "conflicting_goal_id": "g-1a2b3c4d-0001-4e8d-9a11-1f0c2d3e4a5b",
                "description": "Scrolling late at night works against both the screen-time goal and his sleep",
                "evidence": ev("screen time", "sleep"),
            },
        ],
        "anchors": [],
    }


def _iso_days_ago(n: int) -> str:
    """A YYYY-MM-DD `n` days before today (local)."""
    return (date.today() - timedelta(days=n)).isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# Backup + wipe
# ─────────────────────────────────────────────────────────────────────────────
def _backup_vault() -> Path | None:
    """Copy the current profile + journal Markdown + eva.db into a timestamped dir.

    Returns the backup directory (or None if there was nothing to back up). We copy
    only the user's irreplaceable data, not the big model/chroma dirs, so the
    backup is quick and small while still being a full restore of journals+profile.
    """
    vdir = vault_dir()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = vdir.parent / f"local_vault.bak-{stamp}"
    copied = False
    dest.mkdir(parents=True, exist_ok=True)
    for name in ("profile.json", "profile.md", "eva.db"):
        src = vdir / name
        if src.exists():
            shutil.copy2(src, dest / name)
            copied = True
    journal = vdir / "journal"
    if journal.exists() and any(journal.iterdir()):
        shutil.copytree(journal, dest / "journal", dirs_exist_ok=True)
        copied = True
    if not copied:
        dest.rmdir()
        return None
    return dest


def _copy_media() -> int:
    """Copy the repo's demo journal photos into ``<vault>/journal/media/``.

    Returns the number of files copied. The vault is gitignored, so the images
    live in the repo under ``scripts/seed_assets/journal_media/`` and are stamped
    into the vault here. ``_wipe`` only deletes ``*.md`` day files, so the media
    folder survives a re-seed; we refresh it anyway so a fresh clone gets the
    photos and the set always matches what the entries reference.
    """
    dest = vault.journal_dir() / "media"
    dest.mkdir(parents=True, exist_ok=True)
    n = 0
    if _SEED_MEDIA.is_dir():
        for src in sorted(_SEED_MEDIA.glob("*.jpg")):
            shutil.copy2(src, dest / src.name)
            n += 1
    else:
        log.warning("no seed media folder at %s; entries will reference missing images", _SEED_MEDIA)
    return n


def _wipe(no_embed: bool) -> None:
    """Delete all journal data: Markdown, profile, DB rows, and vectors."""
    vdir = vault_dir()

    # 1. L0 Markdown day files.
    journal = vault.journal_dir()
    n_md = 0
    if journal.exists():
        for p in journal.glob("*.md"):
            p.unlink()
            n_md += 1
    log.info("removed %d journal Markdown file(s)", n_md)

    # 2. Profile (will be rewritten as John's).
    for name in ("profile.json", "profile.md"):
        p = vdir / name
        if p.exists():
            p.unlink()

    # 3. L1/L2 SQLite rows. Deleting entries cascades to extractions + mood_series;
    #    the graph + chat tables are cleared explicitly. Both is_seeded 0 and 1 go.
    conn = db.get_or_create_db()
    try:
        for table in ("graph_edges", "graph_nodes", "chat_turns", "conversations", "digests", "entries"):
            conn.execute(f"DELETE FROM {table}")
        conn.commit()
    finally:
        conn.close()
    log.info("cleared SQLite index/extraction/mood/graph/chat rows")

    # 4. ChromaDB journal vectors (best-effort — skipped with --no-embed).
    if not no_embed:
        try:
            from memory import vector
            col = vector._get_collection()  # noqa: SLF001 — the seam we need
            existing = col.get()
            ids = existing.get("ids") or []
            if ids:
                col.delete(ids=ids)
            log.info("cleared %d journal vector(s) from ChromaDB", len(ids))
        except Exception as exc:  # noqa: BLE001 — embeddings are best-effort
            log.warning("could not clear ChromaDB vectors (continuing): %s", exc)


# ─────────────────────────────────────────────────────────────────────────────
# Write John's entries
# ─────────────────────────────────────────────────────────────────────────────
def _write_entries(no_embed: bool) -> tuple[int, dict[str, list[str]]]:
    """Write every John entry as a real (is_seeded=0) entry. Returns (count, by_theme).

    Each entry: L0 Markdown (via vault.save_entry with a backdated timestamp), then
    the L1 index row + a finished extraction + the mood point, then a best-effort
    L2 embedding — mirroring memory.capture for a genuinely-written entry, but with
    hand-authored extraction data so no model is needed.
    """
    today = date.today()
    by_theme: dict[str, list[str]] = {}
    seeded_for_embed: list[dict] = []
    count = 0

    conn = db.get_or_create_db()
    try:
        # Oldest first, so created_at order matches calendar order.
        for days_ago, (hh, mm), mood, themes, emotions, summary, body in sorted(
            JOHN_DAYS, key=lambda r: -r[0]
        ):
            d = today - timedelta(days=days_ago)
            when = datetime.combine(d, time(hh, mm))

            # Bodies are written as indented triple-quoted Markdown for readability
            # in this file; dedent + strip turns them back into flush-left Markdown
            # before they land in the vault (4-space indents would otherwise read as
            # code blocks).
            body_md = textwrap.dedent(body).strip()
            rec = vault.save_entry(body_md, "journal", when=when)
            db.insert_entry(
                conn, id=rec.id, date=rec.date, type=rec.type,
                text=rec.text, word_count=rec.word_count, created_at=rec.created_at,
                is_seeded=False,
            )
            db.create_pending_extraction(conn, rec.id)
            db.finalize_extraction(
                conn, rec.id,
                mood=mood, emotions=emotions, entities=[], themes=themes,
                events=[], stated_goals=[], behaviors=[], decisions=[],
                open_loops=[], self_judgments=[], summary=summary,
                extracted_at=rec.created_at,
            )
            db.upsert_mood_series(
                conn, entry_id=rec.id, date=rec.date,
                mood=mood, emotions=emotions, is_seeded=False,
            )
            for t in themes:
                by_theme.setdefault(t, []).append(rec.id)
            seeded_for_embed.append(
                {"entry_id": rec.id, "date": rec.date, "summary": summary,
                 "mood": mood, "themes": themes}
            )
            count += 1
    finally:
        conn.close()

    if not no_embed:
        try:
            from memory import vector
            for s in seeded_for_embed:
                vector.embed_summary(
                    entry_id=s["entry_id"], date=s["date"], summary=s["summary"],
                    mood=s["mood"], themes=s["themes"], is_seeded=False,
                )
            log.info("embedded %d summaries into ChromaDB (is_seeded=0)", len(seeded_for_embed))
        except Exception as exc:  # noqa: BLE001 — embedding is a bonus, not required
            log.warning("skipped embedding John's summaries (entries still saved): %s", exc)

    return count, by_theme


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description="Reset the vault to the John demo persona.")
    parser.add_argument(
        "--no-embed", action="store_true",
        help="Skip all ChromaDB work (clearing + embedding). DB + Markdown only.",
    )
    parser.add_argument(
        "--no-backup", action="store_true",
        help="Skip backing up the current vault before wiping (not recommended).",
    )
    args = parser.parse_args()

    if not args.no_backup:
        backup = _backup_vault()
        if backup:
            log.info("backed up current vault data → %s", backup)
        else:
            log.info("nothing to back up (empty vault)")

    _wipe(args.no_embed)

    n_media = _copy_media()
    log.info("copied %d demo photo(s) into the journal media folder", n_media)

    count, by_theme = _write_entries(args.no_embed)
    moods = [d[2] for d in JOHN_DAYS if d[2] is not None]
    log.info(
        "wrote %d John journal(s) across the past month (mood %d..%d, %d blank day)",
        count, min(moods), max(moods), len(JOHN_DAYS) - len(moods),
    )

    saved = profile.save_profile(profile.Profile.from_dict(build_john_profile(by_theme)))
    log.info(
        "wrote John's profile: %d goal(s), %d pattern(s), %d relationship(s)",
        len(saved.goals), len(saved.patterns), len(saved.relationships),
    )

    # Derive the Connections graph from the same extractions (is_seeded=0).
    conn = db.get_or_create_db()
    try:
        n_nodes, n_edges = graph.store_graph(conn)
    finally:
        conn.close()
    log.info("built John's connections graph: %d node(s), %d edge(s)", n_nodes, n_edges)

    print(
        "\nDone. The vault is now John: ~a month of real, backdated journal entries "
        "(browsable + editable + recall-able) and his profile. Insights derive from "
        "these as real data — no demo toggle needed."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
