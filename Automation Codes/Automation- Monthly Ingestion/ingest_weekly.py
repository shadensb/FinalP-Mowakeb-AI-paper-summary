import os, time, requests, feedparser
from datetime import datetime, timezone, timedelta
from supabase import create_client

import random
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from field_mapping import FIELDS  


# ENV + CLIENTS
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supa = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
ARXIV_API = "https://export.arxiv.org/api/query"

session = requests.Session()
session.headers.update({
    "User-Agent": "MowakebResearchBot/1.0 (contact: shaden.s.bu@gmail.com)"
})

retries = Retry(
    total=6,
    backoff_factor=2.0,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"]
)
adapter = HTTPAdapter(max_retries=retries)
session.mount("https://", adapter)
session.mount("http://", adapter)



# CONFIG

WEEK_DAYS = 30          
MAIN_FIELD_DELAY = 2     # only 5 times between Main Field
MAX_RESULTS = 150        



# ARXIV FETCH

def fetch_recent_multi(categories, max_results=MAX_RESULTS):
    """
   cat:
    cat:cs.CV OR cat:cs.LG ...
    """
    cats = list(dict.fromkeys(categories))  # unique preserve order
    query = " OR ".join([f"cat:{c}" for c in cats])

    params = {
        "search_query": query,
        "start": 0,
        "max_results": max_results,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
    }
    r = session.get(ARXIV_API, params=params, timeout=60)
    r.raise_for_status()
    return feedparser.parse(r.text).entries


def parse_entry(e):
    published = datetime(*e.published_parsed[:6], tzinfo=timezone.utc)

    abs_url = e.link
    pdf_url = None
    for l in getattr(e, "links", []):
        if getattr(l, "type", None) == "application/pdf":
            pdf_url = getattr(l, "href", None)
            break
    if not pdf_url:
        pdf_url = abs_url.replace("/abs/", "/pdf/") + ".pdf"

    authors = [a.name for a in getattr(e, "authors", [])]

    title = " ".join(e.title.split())
    abstract = " ".join(e.summary.split())

    return {
        "arxiv_id": e.id.split("/abs/")[-1],
        "title": title,
        "abstract": abstract,
        "authors": authors,
        "published_at": published,
        "abs_url": abs_url,
        "pdf_url": pdf_url,
    }


# HELPERS

def within_last_week(dt):
    return dt >= datetime.now(timezone.utc) - timedelta(days=WEEK_DAYS)

def keyword_match(text, keywords):
    t = text.lower()
    return any(k.lower() in t for k in keywords)

def pick_one_from_parsed(parsed_list, keywords, used_ids=None):
    

    """
   choose most recent paper:
    - during last 30 days
    - there is matching between keywords on: (title+abstract)
    """

    used_ids = used_ids or set()

    # 1) keyword match (unused
    for p in parsed_list:
        if p["arxiv_id"] in used_ids:
            continue
        if not within_last_week(p["published_at"]):
            continue
        text = f"{p['title']} {p['abstract']}"
        if keyword_match(text, keywords):
            return p

    # 2) fallback: latest within last 30 days
    for p in parsed_list:
        if p["arxiv_id"] in used_ids:
            continue
        if within_last_week(p["published_at"]):
            return p

    return None

def upsert_paper(row):
    row = dict(row)
    row["published_at"] = row["published_at"].isoformat()
    supa.table("papers").upsert(row, on_conflict="arxiv_id").execute()



# MAIN

def main():
    inserted = 0
    skipped = 0

    for main_field, subs in FIELDS.items():
        # categories for this main field
        categories = list({cfg["category"] for cfg in subs.values()})

        try:
            entries = fetch_recent_multi(categories, max_results=MAX_RESULTS)

            parsed = [parse_entry(e) for e in entries]

            # prevent duplicate papers across subfields
            used_ids = set()

            for sub_field, cfg in subs.items():
                keywords = cfg.get("keywords", [])

                chosen = pick_one_from_parsed(parsed, keywords, used_ids=used_ids)
                if not chosen:
                    print(f"No paper found in last {WEEK_DAYS} days: {main_field} → {sub_field}")
                    skipped += 1
                    continue

                used_ids.add(chosen["arxiv_id"])  # dont use this paper again

                row = dict(chosen)
                row.update({
                    "source": "ARXIV",
                    "main_field": main_field,
                    "sub_field": sub_field,
                    "status": "NEW",
                })

                upsert_paper(row)
                inserted += 1
                print(f"{main_field} → {sub_field} | {row['arxiv_id']}")

        except Exception as ex:
            print(f"Error in main field {main_field}: {ex}")
            skipped += len(subs)

        time.sleep(MAIN_FIELD_DELAY + random.uniform(0, 2))

    print(f"\nDone. Inserted/updated: {inserted}, skipped: {skipped}")


if __name__ == "__main__":
    main()
