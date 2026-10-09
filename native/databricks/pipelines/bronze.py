# Step 5. Bronze: land ERP extracts and invoice documents as they arrive, incrementally, append-only.
# A Lakeflow pipeline source file. `spark` is provided by the pipeline runtime.
# Configuration keys (resources/pipeline.yml): landing_root = /Volumes/<catalog>/landing
#
# Auto Loader keeps track of which files it has read, so a rerun reads only new files and a
# failed run resumes where it stopped. Bronze keeps every record with its source file and arrival
# time: when an auditor asks where a number came from, this is the first link of the chain.
from pyspark import pipelines as dp
from pyspark.sql import functions as F

ROOT = spark.conf.get("landing_root")  # noqa: F821 - provided by the pipeline runtime


def _erp(entity: str):
    return (
        spark.readStream.format("cloudFiles")  # noqa: F821
        .option("cloudFiles.format", "json")
        .option("cloudFiles.inferColumnTypes", "true")
        .option("cloudFiles.schemaEvolutionMode", "rescue")      # new source columns go to _rescued_data, never break the run
        .load(f"{ROOT}/erp/{entity}/")
        .withColumn("_source_file", F.col("_metadata.file_path"))
        .withColumn("_ingested_at", F.current_timestamp())
    )


@dp.table(name="bronze.invoices", comment="Invoice headers from the ERP extract, as landed.")
def invoices():
    return _erp("invoices")


@dp.table(name="bronze.purchase_orders", comment="Purchase orders from the ERP extract, as landed.")
def purchase_orders():
    return _erp("purchase_orders")


@dp.table(name="bronze.receipts", comment="Goods and service receipts from the ERP extract, as landed.")
def receipts():
    return _erp("receipts")


@dp.table(name="bronze.vendors", comment="Vendor master from the ERP extract, as landed.")
def vendors():
    return _erp("vendors")


@dp.table(name="bronze.invoice_docs", comment="Invoice PDFs as binary, one row per file.")
def invoice_docs():
    return (
        spark.readStream.format("cloudFiles")  # noqa: F821
        .option("cloudFiles.format", "binaryFile")
        .option("pathGlobFilter", "*.pdf")
        .load(f"{ROOT}/invoices/")
        .select(F.col("path"), F.col("content"), F.col("length"), F.col("modificationTime"),
                F.current_timestamp().alias("_ingested_at"))
    )
