"""One registry for every tool. The loop calls by name and never learns where a tool lives."""
from __future__ import annotations

import inspect
import json
import time
from typing import Callable, Optional, get_type_hints

MAX_RESULT_CHARS = 4000

_PY_TO_JSON = {str: "string", int: "integer", float: "number", bool: "boolean"}


# region: registry
class Registry:
    def __init__(self):
        self.tools: dict = {}          # name -> (schema, callable)
        self.log: list = []            # one record per call

    def tool(self, description: str, enums: Optional[dict] = None):
        """Decorator. Builds the JSON schema from the function signature."""
        def wrap(fn: Callable):
            props, required = {}, []
            hints = get_type_hints(fn)
            for name, p in inspect.signature(fn).parameters.items():
                props[name] = {"type": _PY_TO_JSON.get(hints.get(name), "string")}
                if enums and name in enums:
                    props[name]["enum"] = enums[name]
                if p.default is inspect.Parameter.empty:
                    required.append(name)
            schema = {"type": "function", "function": {
                "name": fn.__name__, "description": description,
                "parameters": {"type": "object", "properties": props, "required": required}}}
            self.tools[fn.__name__] = (schema, fn)
            return fn
        return wrap

    def schemas(self) -> list:
        return [schema for schema, _ in self.tools.values()]

    def schema_cost(self) -> int:
        """Rough tokens these schemas add to every single turn."""
        return len(json.dumps(self.schemas())) // 4

    def call(self, name: str, arguments: dict) -> dict:
        """Run a tool. Never raises: errors come back as data the model can read."""
        t0 = time.time()
        if name not in self.tools:
            result = {"error": f"unknown tool '{name}'", "known_tools": sorted(self.tools)}
        else:
            try:
                result = self.tools[name][1](**arguments)
            except TypeError as e:
                result = {"error": f"bad arguments: {e}"}
            except Exception as e:  # noqa: BLE001
                result = {"error": f"{type(e).__name__}: {e}"}
        self.log.append({"tool": name, "arguments": arguments, "ms": int((time.time() - t0) * 1000),
                         "empty": not result.get("rows", result.get("results", [1])),
                         "error": result.get("error")})
        return result

    def call_as_text(self, name: str, arguments: dict) -> str:
        """What goes into the role='tool' message: JSON, capped, with a note when cut."""
        text = json.dumps(self.call(name, arguments), default=str)
        if len(text) > MAX_RESULT_CHARS:
            text = text[:MAX_RESULT_CHARS] + f' ...[truncated, {len(text)} chars total; narrow the query]'
        return text
# endregion
