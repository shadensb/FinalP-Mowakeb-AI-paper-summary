import os
import zipfile
from supabase import create_client, Client

# 

SUPABASE_URL = ""    
SUPABASE_SERVICE_ROLE_KEY = ""      
BUCKET_NAME = "papers-pdf-private"                        

ZIP_FILENAME = "mowakeb_papers_pdfs.zip"                

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


#  HELPERS 

def fetch_all_pdfs(limit=1000):

    response = (
        supabase
        .table("papers")
        .select("id, title, stored_pdf_path")
        .not_.is_("stored_pdf_path", "null")   # stored_pdf_path IS NOT NULL
        .limit(limit)
        .execute()
    )
    return response.data or []


#  MAIN DOWNLOAD + ZIP LOGIC 

papers = fetch_all_pdfs(limit=1000)
print(f"Number of papers with stored PDFs: {len(papers)}")

if not papers:
    raise SystemExit("No rows with stored_pdf_path found. Nothing to zip.")

# Remove old ZIP file if it already exists
if os.path.exists(ZIP_FILENAME):
    os.remove(ZIP_FILENAME)

# Create the ZIP file and add each PDF from Supabase Storage
with zipfile.ZipFile(ZIP_FILENAME, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
    for paper in papers:
        path = paper["stored_pdf_path"]  # e.g. "2601.04131v1.pdf"
        if not path:
            continue

        print(f"Downloading from storage: {path}")

        try:
            # Download bytes from Supabase Storage
            file_bytes = supabase.storage.from_(BUCKET_NAME).download(path)
        except Exception as e:
            print(f"  Failed to download {path} from bucket: {e}")
            continue

        # Use the basename of the path as the file name inside the ZIP
        arcname = os.path.basename(path)

        # Write the file bytes into the ZIP archive
        zf.writestr(arcname, file_bytes)

        print(f"Added to ZIP as: {arcname}")

print(f"\nDone. ZIP file created: {ZIP_FILENAME}")
