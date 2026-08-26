# Personal site

Everything lives under `src/`. Edit page content in the HTML files; shared chrome (nav, drawer, sticky notes) lives in `assets/js/script.js`.

```bash
python3 scripts/serve.py
```

Open `http://127.0.0.1:8000`. Reading entries on the Log page write to `src/assets/data/reading.json` only on localhost, so the live site stays read-only. Commit that file after you log something.
