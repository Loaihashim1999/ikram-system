"""Bounded secret installation; secret values travel only through stdin/memory."""
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request

VAULT = "https://kv-ikram-prod-399c.vault.azure.net"
ALLOWED = {"ekram-candidate-db-password", "ekram-validation-taqnyat-token"}


def main():
    payload = json.load(sys.stdin)
    name, value = payload.get("name"), payload.get("value")
    if name not in ALLOWED or not isinstance(value, str) or len(value) < 20:
        raise ValueError("Unapproved secret or empty credential")
    result = subprocess.run(
        [sys.executable, "-IBm", "azure.cli", "account", "get-access-token",
         "--resource", "https://vault.azure.net", "--subscription",
         "399c8d53-b58d-40e8-8165-998c305d189e", "--output", "json"],
        capture_output=True, text=True, check=False,
    )
    if result.returncode:
        raise RuntimeError("Vault authentication failed")
    token = json.loads(result.stdout)["accessToken"]
    request = urllib.request.Request(
        f"{VAULT}/secrets/{name}?api-version=7.4",
        data=json.dumps({"value": value, "attributes": {"enabled": True},
                         "tags": {"purpose": "EKRAM controlled candidate validation"}}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="PUT",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        installed = json.load(response)
    reference = installed.get("id", "")
    if not re.fullmatch(re.escape(VAULT) + r"/secrets/" + re.escape(name) + r"/[a-f0-9]+", reference):
        raise RuntimeError("Unexpected secret reference")
    print(json.dumps({"name": name, "reference": reference, "value_disclosed": False}))


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as error:
        print(json.dumps({"error": "Vault operation rejected", "http_status": error.code}), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print('{"error":"Bounded vault operation failed; no credential output"}', file=sys.stderr)
        sys.exit(1)
