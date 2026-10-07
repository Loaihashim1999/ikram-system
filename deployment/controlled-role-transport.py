"""Transport exactly one independently reviewed role helper; no shell or arbitrary script."""
import base64
import hashlib
import json
import logging
from pathlib import Path
import re
import sys
import time
from types import SimpleNamespace
import zlib

EXPECTED = "86208b17b06902aabdfed2aaf16e1acf85492fbcb9024e553935dc839f2e7d78"
REVISION = "ca-ikram-prod--ekram-20261003-7dd2b328"
REPLICA = "ca-ikram-prod--ekram-20261003-7dd2b328-65dd7f885d-rcxdd"
STAGE = "local_source_check"


def main():
    global STAGE
    source = Path(__file__).with_name("controlled-runtime-role.php").read_bytes()
    if hashlib.sha256(source).hexdigest() != EXPECTED:
        raise RuntimeError("Reviewed helper hash mismatch")
    encoded = base64.b64encode(zlib.compress(source)[2:-4]).decode()
    bootstrap = (
        'echo "EKRAM_FIXED_HELPER_READY\\n"; $z="";'
        f'while(strlen($z)<{len(encoded)}){{$l=fgets(STDIN);if($l===false)exit(81);$z.=trim($l);}}'
        '$s=gzinflate(base64_decode($z,true));'
        f'if(!is_string($s)||hash("sha256",$s)!=="{EXPECTED}")exit(82);'
        'ob_start();eval(substr($s,5));$r=ob_get_clean();'
        'echo "EKRAM_RESULT_BEGIN\\n".chunk_split(base64_encode($r),40,"\\n")."EKRAM_RESULT_END\\n";'
    )
    command = "php -r \"eval(base64_decode('" + base64.b64encode(bootstrap.encode()).decode() + "'));\""
    logging.disable(logging.CRITICAL)
    from azure.cli.core import get_default_cli
    from azure.cli.command_modules.containerapp._ssh_utils import WebSocketConnection, _resize_terminal
    cli = get_default_cli()
    STAGE = "fixed_connection_setup"
    connection = WebSocketConnection(SimpleNamespace(cli_ctx=cli), "rg-ikram-prod", "ca-ikram-prod", REVISION, REPLICA, "ca-ikram-prod", command)
    connection._socket.settimeout(60)
    _resize_terminal(connection)
    output = ""
    sent = False
    started = time.monotonic()
    try:
        STAGE = "waiting_fixed_helper_ready"
        while time.monotonic() - started < 120:
            frame = connection.recv()
            if not frame:
                break
            if isinstance(frame, str):
                frame = frame.encode()
            if len(frame) > 2:
                output += frame[2:].decode(errors="replace")
            if not sent and "EKRAM_FIXED_HELPER_READY" in output:
                STAGE = "sending_hash_pinned_helper"
                for position in range(0, len(encoded), 500):
                    connection.send(b"\x00\x00" + (encoded[position:position + 500] + "\n").encode())
                sent = True
                STAGE = "waiting_bounded_result"
            cleaned = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", output)
            match = re.search(r"EKRAM_RESULT_BEGIN\s+([A-Za-z0-9+/=\s]+)EKRAM_RESULT_END", cleaned)
            if match:
                result = json.loads(base64.b64decode(re.sub(r"\s", "", match.group(1))))
                print(json.dumps(result))
                return
        raise RuntimeError("No bounded result; verify role existence read-only before any retry")
    finally:
        connection.disconnect()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"error": "Reviewed fixed-helper transport failed; verify role state before retry; no raw output", "stage": STAGE, "exception_type": type(error).__name__}), file=sys.stderr)
        sys.exit(1)
