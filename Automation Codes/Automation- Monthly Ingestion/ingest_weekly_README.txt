README for ingest_weekly.py


This README is intended for the GitHub repository that hosts the Mowakeb ingestion pipeline. It explains the purpose and usage of the `ingest_weekly.py` script.

Overview


`ingest_weekly.py` is the main ingestion script responsible for pulling recent research papers from the arXiv API, selecting representative papers for each defined subfield, and upserting them into the Supabase `papers` table.

The script is designed to run periodically (for example weekly) so that the system always has an up-to-date and curated set of papers across multiple AI-related domains.

High-level responsibilities
---------------------------

The script performs the following tasks:

- Loads Supabase credentials from environment variables and creates a Supabase client.
- Imports the `FIELDS` configuration from `field_mapping.py` to determine main fields, subfields, arXiv categories, and keyword filters.
- For each main field:
  - Builds a combined arXiv API query for all relevant subject categories.
  - Fetches recent papers from arXiv, ordered by submission date.
  - Parses raw feed entries into a normalized internal format (ID, title, abstract, authors, URLs, and timestamps).
- For each subfield:
  - Selects one paper that best matches the subfield based on recency and keyword matching in the title and abstract.
  - Falls back to the most recent paper if no good keyword match is available within the time window.
- Upserts the selected paper into the Supabase `papers` table with:
  - `source` set to `"ARXIV"`.
  - `main_field` and `sub_field` values derived from the configuration.
  - Metadata including `arxiv_id`, `title`, `abstract`, `authors`, `published_at`, `abs_url`, and `pdf_url`.
  - An initial `status` such as `"NEW"` for downstream processing.
- Logs a summary of how many subfields obtained a paper and how many were skipped because no suitable candidate was found.

Configuration and constants
---------------------------

Key configuration aspects include:

- Environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Time window for recency, for example a number of days used when filtering recent arXiv entries.
- Maximum number of results to fetch from arXiv per query.
- Optional sleep intervals between requests to avoid hitting rate limits.

These values are defined as constants or retrieved from the environment at the top of the script and can be tuned as needed.

Dependencies
------------

The script relies on:

- A HTTP client library for requesting the arXiv API (for example `requests` or `feedparser`).
- The `supabase` Python client for interacting with the database.
- The local module `field_mapping.py` for domain and subfield configuration.

Execution
---------

The script defines a `main()` function that orchestrates the entire ingestion process. It is intended to be run as a standalone program:

    python ingest_weekly.py

It can also be scheduled using cron, a CI workflow, or any scheduling system that periodically executes Python scripts.

.
