"""Shared helpers for the PlateWise food-recognition data pipeline.

Only :mod:`platewise_ml.taxonomy` and :mod:`platewise_ml.manifest` are usable
without heavy dependencies: everything the data-preparation steps need is
standard library only, so importing this package never requires torch, PIL or
TensorFlow. :mod:`platewise_ml.datasets` imports torch lazily and is only
imported by the training scripts.
"""

__all__ = ["taxonomy", "manifest"]
