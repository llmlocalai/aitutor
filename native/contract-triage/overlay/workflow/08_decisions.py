# Databricks notebook source
# MAGIC %md
# MAGIC # 08 Record a decision (Blueprint 5.3)
# MAGIC A person approves, edits or dismisses one worklist item. The next weekly run skips
# MAGIC it unless the award's end date or obligations change. Nothing here touches a contract.

# COMMAND ----------

dbutils.widgets.text("catalog", "")
dbutils.widgets.text("award_key", "")
dbutils.widgets.dropdown("kind", "closeout", ["closeout", "ending_soon"])
dbutils.widgets.dropdown("action", "approve", ["approve", "edit", "dismiss"])
dbutils.widgets.text("note", "")
CATALOG = dbutils.widgets.get("catalog").strip()
KEY = dbutils.widgets.get("award_key").strip()
assert CATALOG and KEY, "Set catalog and award_key (from worklist_items)."
spark.sql(f"USE CATALOG `{CATALOG}`")
spark.sql("USE SCHEMA contract_triage")

display(
    spark.sql(
        "SELECT * FROM worklist_items WHERE award_key = :k ORDER BY created_at DESC",
        args={"k": KEY},
    )
)

# COMMAND ----------

spark.sql(
    """
  INSERT INTO worklist_decisions
  SELECT :k, :kind, :action, :note, current_user(), current_timestamp(), current_end, obligations
  FROM silver_awards WHERE award_key = :k
""",
    args={
        "k": KEY,
        "kind": dbutils.widgets.get("kind"),
        "action": dbutils.widgets.get("action"),
        "note": dbutils.widgets.get("note"),
    },
)
display(
    spark.sql("SELECT * FROM worklist_decisions WHERE award_key = :k", args={"k": KEY})
)
