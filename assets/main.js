// familiar landing page — progressive enhancement only.
// Without JS: every install panel is shown stacked and nothing is hidden.

document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", () => {
  const isJa = document.documentElement.lang === "ja";
  const copiedLabel = isJa ? "コピーしました" : "Copied";
  const failedLabel = isJa ? "⌘C でコピー" : "Press ⌘C";

  // Copy buttons
  for (const btn of document.querySelectorAll(".copy-btn")) {
    const original = btn.textContent;
    const flash = (label, cls, ms) => {
      btn.textContent = label;
      btn.classList.add(cls);
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove(cls);
      }, ms);
    };
    btn.addEventListener("click", async () => {
      const text = btn.hasAttribute("data-copy-from-pre")
        ? btn.parentElement.querySelector("pre").innerText
        : btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
        flash(copiedLabel, "is-copied", 1600);
      } catch {
        // Clipboard unavailable (e.g. insecure context or denied permission):
        // select the command so the user can copy it by hand.
        const source = btn.parentElement.querySelector("pre, code");
        const range = document.createRange();
        range.selectNodeContents(source);
        const selection = getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        flash(failedLabel, "is-failed", 3000);
      }
    });
  }

  // Tabs (WAI-ARIA tabs pattern)
  for (const root of document.querySelectorAll("[data-tabs]")) {
    const tabs = [...root.querySelectorAll('[role="tab"]')];
    const select = (tab) => {
      for (const t of tabs) {
        const selected = t === tab;
        t.setAttribute("aria-selected", String(selected));
        t.tabIndex = selected ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden =
          !selected;
      }
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab));
      tab.addEventListener("keydown", (e) => {
        const step =
          e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        const next = tabs[(i + step + tabs.length) % tabs.length];
        select(next);
        next.focus();
      });
    });
    select(
      tabs.find((t) => t.getAttribute("aria-selected") === "true") ?? tabs[0],
    );
  }

  // Links that jump to a tab panel (e.g. the hero's "MCP サーバー" link)
  // select that tab first, then let the anchor scroll as usual.
  for (const link of document.querySelectorAll("[data-select-tab]")) {
    link.addEventListener("click", () => {
      document.getElementById(link.dataset.selectTab)?.click();
    });
  }

  // Hero demo. The HTML ships in its finished state (no JS, print, reduced
  // motion); the script rewinds it and plays the sequence once.
  const demo = document.querySelector("[data-demo]");
  if (demo) setupDemo(demo);

  // Reveal on scroll
  const targets = document.querySelectorAll(
    ".section-title, .section-lead, .feature-grid, .compare, .cap-grid, .selectors, .flow, .tabs, .step, .trouble, .resp-grid",
  );
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px 0px -10% 0px" },
  );
  for (const el of targets) {
    el.classList.add("reveal");
    io.observe(el);
  }
});

function setupDemo(demo) {
  const $ = (s) => demo.querySelector(s);
  const tabs = { a: $('[data-tab="a"]'), b: $('[data-tab="b"]') };
  const pages = { a: $('[data-page="a"]'), b: $('[data-page="b"]') };
  const url = $("[data-url]");
  const urlTarget = $(".url-target");
  const urls = {
    a: "tracker.acme.example/issues/new",
    b: "mail.example/inbox",
  };
  const fields = {
    title: $('[data-field="title"]'),
    body: $('[data-field="body"]'),
  };
  const typed = {
    title: $('[data-type="title"]'),
    body: $('[data-type="body"]'),
  };
  const texts = {
    title: typed.title.textContent.trim(),
    body: typed.body.textContent.trim(),
  };
  const submit = $("[data-submit]");
  const toast = $("[data-toast]");
  const steps = [...demo.querySelectorAll("[data-step]")];
  const replay = $("[data-replay]");
  const narration = $("[data-narration]");
  const lines =
    document.documentElement.lang === "ja"
      ? {
          received: "依頼を受け取りました",
          found: "課題管理のタブを特定",
          filling: "フォームに入力",
          away: "あなたは別のタブへ。使い魔は元のタブで続行",
          done: "元のタブで登録完了",
        }
      : {
          received: "Request received",
          found: "Found the issue tracker tab",
          filling: "Filling in the form",
          away: "You switched tabs. Your familiar keeps working in tab 47",
          done: "Filed in the original tab",
        };
  const narrate = (key) => {
    narration.textContent = lines[key];
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let run = 0;
  const sleep = (ms, id) =>
    new Promise((resolve, reject) =>
      setTimeout(() => (id === run ? resolve() : reject()), ms),
    );

  const show = (key) => {
    for (const k of ["a", "b"]) {
      tabs[k].classList.toggle("is-active", k === key);
      pages[k].classList.toggle("is-shown", k === key);
    }
    url.textContent = urls[key];
    // The target badge belongs to tab 47 only; hide it while another tab is shown.
    urlTarget.classList.toggle("is-away", key !== "a");
  };
  const done = (n) => steps[n - 1].classList.add("is-done");
  const target = (el) => {
    for (const f of [fields.title, fields.body, submit]) {
      f.classList.toggle("is-target", f === el);
    }
  };
  const type = async (key, id) => {
    const chars = [...texts[key]];
    for (let i = 1; i <= chars.length; i++) {
      typed[key].textContent = chars.slice(0, i).join("");
      await sleep(38, id);
    }
  };

  const reset = () => {
    show("a");
    typed.title.textContent = "";
    typed.body.textContent = "";
    toast.classList.remove("is-shown");
    for (const s of steps) s.classList.remove("is-done");
    target(null);
    demo.classList.remove("is-working");
    narrate("received");
  };

  const play = async () => {
    const id = ++run;
    replay.hidden = true;
    reset();
    try {
      await sleep(700, id);
      demo.classList.add("is-working");
      narrate("found");
      done(1);
      await sleep(500, id);
      narrate("filling");
      target(fields.title);
      await type("title", id);
      done(2);
      await sleep(350, id);
      target(fields.body);
      await type("body", id);
      // The user wanders off to another tab. The familiar keeps working on
      // window 12 / tab 47: it never depends on the active tab.
      await sleep(250, id);
      show("b");
      narrate("away");
      await sleep(1000, id);
      done(3);
      await sleep(700, id);
      target(submit);
      done(4);
      await sleep(700, id);
      done(5);
      toast.classList.add("is-shown");
      target(null);
      await sleep(900, id);
      show("a");
      narrate("done");
      demo.classList.remove("is-working");
    } catch {
      return; // superseded by a newer run
    }
    replay.hidden = false;
  };

  replay.addEventListener("click", play);
  if (reduced) return; // keep the finished state
  replay.hidden = true;

  // Background tabs throttle timers to about once a second, so wait until
  // the page is actually visible before starting.
  const start = () => {
    if (document.visibilityState === "visible") {
      play();
      return;
    }
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onVisible);
      play();
    };
    document.addEventListener("visibilitychange", onVisible);
  };

  if (!("IntersectionObserver" in window)) {
    start();
    return;
  }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      start();
    }
  });
  io.observe(demo);
}
