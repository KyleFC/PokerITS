import os
import pytest

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

@pytest.fixture(autouse=True)
def enable_db_access_for_all_tests(db):
    """Automatically enable DB access for all tests."""
    pass
