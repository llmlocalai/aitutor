"""Pick a model per request by task type. Two mechanisms, and it can never break a request."""
from __future__ import annotations

from typing import Optional

CATALOG = {
    "default": {"tag": "workhorse-35b"},                        # same engine: swap the model tag
    "vision":  {"tag": "vision-27b"},
    "fast":    {"base_url": "http://127.0.0.1:8082/v1"},         # separate runtime: swap the URL
}


def detect_task(payload: dict) -> str:
    for m in payload.get("messages", []):
        if isinstance(m.get("content"), list) and any(p.get("type") == "image_url" for p in m["content"]):
            return "vision"
    if payload.get("max_tokens", 9999) <= 64:
        return "fast"
    return "default"


# region: router
def resolve_for_request(payload: dict, catalog: Optional[dict] = None) -> Optional[dict]:
    """Return {'model': tag} or {'base_url': url}, or None to leave the request untouched."""
    try:
        if payload.get("model"):                 # the caller chose: do nothing
            return None
        entry = (CATALOG if catalog is None else catalog).get(detect_task(payload))
        if not entry:
            return None                          # unknown task: do nothing
        if entry.get("base_url"):
            return {"base_url": entry["base_url"]}
        if entry.get("tag"):
            return {"model": entry["tag"]}
        return None                              # incomplete entry: do nothing
    except Exception:
        return None                              # any error: do nothing
# endregion


if __name__ == "__main__":
    text = {"messages": [{"role": "user", "content": "Summarize section 3."}]}
    image = {"messages": [{"role": "user", "content": [{"type": "image_url", "image_url": {"url": "x"}}]}]}
    short = {"messages": [{"role": "user", "content": "yes or no?"}], "max_tokens": 16}
    print("text    ->", resolve_for_request(text))
    print("image   ->", resolve_for_request(image))
    print("short   ->", resolve_for_request(short))
    print("explicit->", resolve_for_request({**text, "model": "my-choice"}))
    print("no catalog ->", resolve_for_request(text, catalog={}))
