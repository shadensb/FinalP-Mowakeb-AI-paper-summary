
import re
import os
import datetime
from pathlib import Path
from zipfile import ZipFile
from supabase import create_client



SUPABASE_URL = os.environ.get("SUPABASE_URL", "PUT_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "PUT_SERVICE_ROLE_KEY")

BUCKET_NAME = "html_files_results"   
RESULTS_BASE_PATH = ""                

LOCAL_ZIP_PATH = Path("./HTML.zip")    \
WORKDIR = Path("./html_ingestion_workdir")


\
if "PUT_SUPABASE_URL" in SUPABASE_URL or not SUPABASE_URL.startswith("http"):
    raise ValueError("SUPABASE_URL is not set correctly.")

if "PUT_SERVICE_ROLE_KEY" in SUPABASE_SERVICE_ROLE_KEY or len(SUPABASE_SERVICE_ROLE_KEY) < 80:
    raise ValueError("SUPABASE_SERVICE_ROLE_KEY is missing/invalid (must be full Service Role key).")


if not SUPABASE_URL.endswith("/"):
    SUPABASE_URL += "/"


# Setup

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

WORKDIR.mkdir(parents=True, exist_ok=True)
extract_dir = WORKDIR / "extracted"
extract_dir.mkdir(exist_ok=True)



# Utils — arXiv ID

ARXIV_NEW = re.compile(r"(\d{4}\.\d{4,5})(v\d+)?", re.IGNORECASE)
ARXIV_OLD = re.compile(r"([a-z\-]+\/\d{7})(v\d+)?", re.IGNORECASE)

def arxiv_from_filename(filename: str) -> str | None:
    stem = Path(filename).stem
    m = ARXIV_NEW.search(stem) or ARXIV_OLD.search(stem)
    if not m:
        return None
    base = m.group(1)
    ver  = (m.group(2) or "").lower()
    return base + ver

def arxiv_base(arxiv_id: str) -> str | None:
    m = ARXIV_NEW.search(arxiv_id) or ARXIV_OLD.search(arxiv_id)
    return m.group(1) if m else None



# DB helpers (smart matching)

def find_paper(arxiv_id: str) -> dict | None:
    # 1) exact
    r = supabase.table("papers").select("id, arxiv_id").eq("arxiv_id", arxiv_id).limit(1).execute()
    if r.data:
        return r.data[0]

    # 2) base match (no version)
    base = arxiv_base(arxiv_id)
    if base:
        r2 = supabase.table("papers").select("id, arxiv_id").like("arxiv_id", f"{base}%").limit(1).execute()
        if r2.data:
            return r2.data[0]

        # 3) contains match
        r3 = supabase.table("papers").select("id, arxiv_id").ilike("arxiv_id", f"%{base}%").limit(1).execute()
        if r3.data:
            return r3.data[0]

    return None



# Storage helper

def build_remote_path(filename: str) -> str:
    if RESULTS_BASE_PATH:
        return f"{RESULTS_BASE_PATH.rstrip('/')}/{filename}"
    return filename

def upload_html(local_path: Path, remote_path: str):
    # Try remove (ignore errors if not exists)
    try:
        supabase.storage.from_(BUCKET_NAME).remove([remote_path])
    except Exception:
        pass

    with open(local_path, "rb") as f:
        # Older supabase-py: upload(path, file, file_options)
        supabase.storage.from_(BUCKET_NAME).upload(
            remote_path,
            f,
            {"content-type": "text/html; charset=utf-8"},
        )

# Main

def main():
    if not LOCAL_ZIP_PATH.exists():
        raise FileNotFoundError(f"ZIP not found: {LOCAL_ZIP_PATH.resolve()}")

    print("📦 Extracting local ZIP...")
    with ZipFile(LOCAL_ZIP_PATH, "r") as z:
        z.extractall(extract_dir)

    html_files = sorted(extract_dir.rglob("*.html"))
    print(f"🧾 Found {len(html_files)} HTML files")

    ok = missing = badname = uploaded = 0

    for html in html_files:
        arxiv_id = arxiv_from_filename(html.name)
        if not arxiv_id:
            badname += 1
            print(f"Bad filename (no arxiv id): {html.name}")
            continue

        paper = find_paper(arxiv_id)
        if not paper:
            missing += 1
            print(f"No DB row for {arxiv_id} (file: {html.name})")
            continue

        remote_html_path = build_remote_path(html.name)

        upload_html(html, remote_html_path)
        uploaded += 1

        supabase.table("papers").update({
            "stored_html_path": remote_html_path,
            "primary_input": "HTML",
            "status": "PROCESSED",
            "processed_at": datetime.datetime.utcnow().isoformat() + "Z",
        }).eq("id", paper["id"]).execute()

        ok += 1
        print(f"{html.name} → papers({paper['arxiv_id']})  stored_html_path={remote_html_path}")

    print("\n===== SUMMARY =====")
    print("DB updated:", ok)
    print("HTML uploaded:", uploaded)
    print("Missing in DB:", missing)
    print("Bad filenames:", badname)


if __name__ == "__main__":
    main()
