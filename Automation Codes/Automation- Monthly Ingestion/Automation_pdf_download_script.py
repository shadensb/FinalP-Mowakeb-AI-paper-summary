import requests
from supabase import create_client, Client


SUPABASE_URL = ""
SUPABASE_SERVICE_ROLE_KEY = ""

BUCKET_NAME = "papers-pdf-private"   # paket name in DB


supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)



def build_file_path(paper):
   

    pdf_url = paper["pdf_url"].rstrip("/")
    last_part = pdf_url.split("/")[-1] or str(paper["id"])
    arxiv_id = paper.get("arxiv_id") or last_part

    filename = arxiv_id
    if not filename.endswith(".pdf"):
        filename += ".pdf"

    return filename  


def fetch_batch(limit=20):
   
    res = (
        supabase
        .table("papers")
        .select("id, pdf_url, arxiv_id, stored_pdf_path")
        .is_("stored_pdf_path", "null")   # stored_pdf_path IS NULL
        .not_.is_("pdf_url", "null")      # pdf_url IS NOT NULL
        .limit(limit)
        .execute()
    )
    return res.data or []




total_ok = 0
batch_num = 0

while True:
    batch_num += 1
    papers = fetch_batch(limit=30)

    if not papers:
        print("Papers finished")
        break

    print(f"\n===== Batch {batch_num} - Number of papers {len(papers)} =====")

    for paper in papers:
        paper_id = paper["id"]
        pdf_url = paper["pdf_url"]
        file_path = build_file_path(paper)

        print(f"\n[{paper_id}] Download {pdf_url}")

     
        try:
            resp = requests.get(pdf_url, timeout=60)
            resp.raise_for_status()
            pdf_bytes = resp.content
        except Exception as e:
            print(f"  Download Filed {e}")
            continue

      
        try:
            supabase.storage.from_(BUCKET_NAME).upload(
                path=file_path,
                file=pdf_bytes,
                file_options={
                    "content-type": "application/pdf",
                    "upsert": "true",
                },
            )
        except Exception as e:
            print(f"  Upload to paket failed {e}")
            continue

      
        try:
            supabase.table("papers").update(
                {"stored_pdf_path": file_path}
            ).eq("id", paper_id).execute()
        except Exception as e:
            print(f"  updating table failed {e}")
            continue

        total_ok += 1
        print(f"  upolad and update done→ {file_path}")

print(f"\nscript over {total_ok}")