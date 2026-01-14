README for ingest_html_results.py


This README is intended for the GitHub repository that hosts the Mowakeb HTML ingestion and processing pipeline. It describes the purpose and behavior of the `ingest_html_results.py` script.

Overview


`ingest_html_results.py` processes a ZIP archive containing HTML versions of research papers, uploads those HTML files to Supabase Storage, and links them to existing rows in the `papers` table.

The script is typically run after an external conversion step has turned arXiv PDFs into HTML files. Its main goal is to ensure that each converted HTML file is stored in Supabase and correctly associated with the corresponding paper metadata.

High-level responsibilities


The script is responsible for:

- Validating that required Supabase configuration values are present:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Ensuring that `SUPABASE_URL` is well-formed and has a trailing slash.
- Locating and extracting a local ZIP archive of HTML files into a working directory.
- Parsing file names to extract arXiv identifiers using both modern and legacy arXiv ID patterns.
- Matching each HTML file to an existing row in the `papers` table using:
  - Exact `arxiv_id` matches.
  - Base ID matches (ignoring version suffixes).
  - Fallback containment matches if necessary.
- Building a Storage path for each HTML file and uploading it to a designated Storage bucket (for example `html_files_results`).
- Updating the matched `papers` row with:
  - The `stored_html_path` of the uploaded HTML file.
  - A `primary_input` value indicating that HTML is now the primary processed format.
  - A `status` value such as `"PROCESSED"`.
  - A `processed_at` timestamp.

Configuration
-------------

Key configuration variables include:

- `SUPABASE_URL`: Supabase project URL, read from an environment variable.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role API key, read from an environment variable.
- `BUCKET_NAME`: Name of the Storage bucket used for HTML files, commonly `html_files_results`.
- `RESULTS_BASE_PATH`: Optional prefix to be added in front of every Storage object path, allowing files to be grouped under a folder.
- `LOCAL_ZIP_PATH`: File system path to the ZIP archive containing HTML results.
- `WORKDIR`: Local working directory into which the ZIP archive is extracted.

These values can be adjusted to fit different environments or naming conventions.

ArXiv identifier handling
-------------------------

The script contains regular expressions and helper functions to work with both modern and legacy arXiv identifier formats. It extracts the identifier from the HTML file name and normalizes it so that it can be matched reliably against the `arxiv_id` column in the database, including cases where the version suffix differs.

Execution flow
--------------

A typical execution proceeds as follows:

1. Read and validate configuration values.
2. Confirm that the ZIP archive exists at `LOCAL_ZIP_PATH`.
3. Extract the archive into the working directory.
4. Iterate over all `.html` files found in the extracted directory.
5. For each file:
   - Derive the arXiv identifier from the file name.
   - Look up the corresponding row in the `papers` table.
   - If a match is found:
     - Build the remote path and upload the HTML file to Supabase Storage.
     - Update the database record with `stored_html_path`, `primary_input`, `status`, and `processed_at`.
   - If no match is found, record the file as missing.
6. At the end, print a summary of:
   - Number of matched and updated papers.
   - Number of uploaded HTML files.
   - Number of files with no matching database row.
   - Number of files with invalid or unrecognized names.

