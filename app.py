"""Streamlit search UI with filters, thumbnails, and similarity scores."""

from datetime import date, datetime

import streamlit as st

from chroma_store import ChromaStore
from config import IMAGE_FOLDER, setup_logging
from embedder import CLIPEmbedder
from manifest import Manifest, path_id
from thumbnails import get_display_image

setup_logging()

st.set_page_config(layout="wide", page_title="Quote & Vibe Search Engine")
st.title("Quote & Vibe Search Engine")


@st.cache_resource
def load_resources():
    embedder = CLIPEmbedder()
    chroma = ChromaStore()
    manifest = Manifest()
    return embedder, chroma, manifest


embedder, chroma, manifest = load_resources()

# Sidebar controls
st.sidebar.header("Search Settings")
num_results = st.sidebar.slider("Results to show", 4, 40, 12, step=4)
min_similarity = st.sidebar.slider(
    "Minimum similarity", 0.0, 1.0, 0.0, step=0.05
)
filter_has_text = st.sidebar.selectbox(
    "Text filter", ["All", "Has text", "No text"]
)
filter_folder = st.sidebar.text_input(
    "Folder filter (optional)", placeholder="e.g. 2024/03"
)
use_date_filter = st.sidebar.checkbox("Filter by date", value=False)
date_from = st.sidebar.date_input(
    "From date", value=date(2020, 1, 1), disabled=not use_date_filter
)
date_to = st.sidebar.date_input(
    "To date", value=date.today(), disabled=not use_date_filter
)

status_counts = manifest.count_by_status()
st.sidebar.metric("Total indexed", manifest.total_count())
st.sidebar.metric("Chroma vectors", chroma.count())
if status_counts:
    with st.sidebar.expander("Status breakdown"):
        for status, count in sorted(status_counts.items()):
            st.caption(f"{status}: {count}")

query_phrase = st.text_input(
    "What vibe or quote are you looking for?",
    placeholder="e.g., lonely but stubborn / nostalgic neon text",
)

if query_phrase:
    query_vector = embedder.embed_text(query_phrase)

    where_filter = None
    if filter_has_text == "Has text":
        where_filter = {"has_text": True}
    elif filter_has_text == "No text":
        where_filter = {"has_text": False}

    fetch_n = num_results * 3 if (
        filter_folder or min_similarity > 0 or use_date_filter
    ) else num_results
    results = chroma.query(
        query_embedding=query_vector,
        query_text=query_phrase,
        n_results=min(fetch_n, 100),
        where=where_filter,
    )

    if results and results.get("metadatas") and results["metadatas"][0]:
        metadatas = results["metadatas"][0]
        distances = results.get("distances", [[]])[0]
        ids = results.get("ids", [[]])[0]

        displayed = 0
        cols = st.columns(4)

        for idx, (photo_id, meta, distance) in enumerate(
            zip(ids, metadatas, distances)
        ):
            similarity = 1.0 - distance
            if similarity < min_similarity:
                continue

            rel_path = meta.get("rel_path", meta.get("file_name", ""))
            record = manifest.get_by_id(photo_id)

            if filter_folder and filter_folder not in rel_path:
                continue

            if use_date_filter and record:
                photo_date = record.exif_date
                if not photo_date and record.mtime:
                    photo_date = datetime.fromtimestamp(record.mtime).strftime("%Y-%m-%d")
                if photo_date:
                    if date_from and photo_date < str(date_from):
                        continue
                    if date_to and photo_date > str(date_to):
                        continue
                elif use_date_filter:
                    continue

            raw_text = record.ocr_text if record else ""
            if not raw_text and results.get("documents"):
                raw_text = results["documents"][0][idx]
            ocr_text = raw_text or ""

            display_path = get_display_image(path_id(rel_path), rel_path, IMAGE_FOLDER)
            if display_path is None:
                st.warning(f"File missing: {rel_path}")
                continue

            col_idx = displayed % 4
            with cols[col_idx]:
                st.image(str(display_path), use_container_width=True)
                st.caption(f"Similarity: {similarity:.2%}")
                st.caption(rel_path)
                with st.expander("Extracted text"):
                    st.write(
                        ocr_text if ocr_text.strip()
                        else "[No text detected — visual vibe only]"
                    )
                if record and record.duplicate_of:
                    st.caption(f"Duplicate of {record.duplicate_of[:8]}...")

            displayed += 1
            if displayed >= num_results:
                break

        if displayed == 0:
            st.info("No results matched your filters. Try adjusting them.")
    else:
        st.info("No matching vibes found. Try adjusting your wording.")

else:
    st.info("Enter a search query above to find matching photos.")
