import importlib
import os
from pathlib import Path
import unittest
from unittest.mock import patch


class ConfigMultiAccountTests(unittest.TestCase):
    def test_configured_platforms_reads_numbered_secret_slots(self):
        env = {
            "IEEE_EMAIL": "first@example.com",
            "IEEE_PASSWORD": "first-password",
            "IEEE_URL": "https://mc.manuscriptcentral.com/first",
            "IEEE_2_EMAIL": "second@example.com",
            "IEEE_2_PASSWORD": "second-password",
            "IEEE_2_URL": "https://mc.manuscriptcentral.com/second",
            "ELSEVIER_2_EMAIL": "elsevier@example.com",
            "ELSEVIER_2_PASSWORD": "elsevier-password",
            "ELSEVIER_2_URL": "https://www.editorialmanager.com/example",
        }

        with patch.dict(os.environ, env, clear=True):
            module_name = "config_remote" if Path("config_remote.py").exists() else "config"
            config_module = importlib.import_module(module_name)

            module = importlib.reload(config_module)
            accounts = module.Config.configured_platforms()

        self.assertEqual([account.name for account in accounts], ["IEEE", "IEEE", "Elsevier"])
        self.assertEqual([account.email for account in accounts], ["first@example.com", "second@example.com", "elsevier@example.com"])


if __name__ == "__main__":
    unittest.main()
