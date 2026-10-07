"""One memory-only candidate run. No promotion, unrelated queue consumption or secret files."""
import base64
import hashlib
import json
import logging
from pathlib import Path
import re
import secrets
import subprocess
import sys
import time
from types import SimpleNamespace
import uuid
import zlib

ROOT = Path(__file__).resolve().parent.parent
REVISION = "ca-ikram-prod--controlled-20261004-130650-1adf8a78"
DIGEST = "sha256:a34efc39ea53a2b23241ba076c88742b7a827a7826915a9d6f9ccdf1872293d7"
ORIGIN = f"https://{REVISION}.purpleocean-8c6da0d5.uaenorth.azurecontainerapps.io"
APPROVED = {
    "fixture": ("tests/API/ekram-live-candidate-fixture.php", "ac898e43bb952a25eda9f3d5983f2eebf462d12edd77285e19063d2e4ebf13b5"),
    "cleanup": ("tests/API/ekram-live-candidate-cleanup.php", "26b947ecb2cfbfa6b174ea41202432520c84909cc888bd825c5081c3b454e554"),
    "queue": ("tests/API/ekram-live-candidate-queue.php", "28b47666eb710dea76c7ce8ef4514589d6c2550b434ad8e1a76c3dabb6b4d60f"),
    "verify": ("tests/API/ekram-live-candidate-verify.php", "0f31a1a9cfe043fffcfab98a3ccb88b8d9f343883f7a194984a60f3eae6eade4"),
    "basic": ("deployment/controlled-basic-sms-intent.php", "9ec2ec360b685f30ec8a84bc0e7c42d276cd7b378b6d0d86bd137457847c94d5"),
    "recovery": ("deployment/controlled-live-recovery.php", "5da3f1ee0ba7af57a7a58dd53695184fd8a93efb2e50e92f9554862168bd68a4"),
}
API_HASH = "d7640e7b291eaa740c123bfe9c9587e7886e13407541af42767343f42352e2b8"
CONTROL = ROOT / ".tmp/ekram-controlled/orchestrator-control.json"
STATE = ROOT / "deployment/EKRAM-LIVE-RUN-CHECKPOINT.json"


def save(name, data):
    (ROOT / "deployment" / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def emit(stage, **safe):
    print(json.dumps({"stage": stage, **safe}), flush=True)


class CandidateSession:
    def __init__(self):
        logging.disable(logging.CRITICAL)
        from azure.cli.core import get_default_cli
        from azure.cli.command_modules.containerapp._clients import ContainerAppClient
        self.cmd = SimpleNamespace(cli_ctx=get_default_cli())
        replicas = ContainerAppClient.list_replicas(self.cmd, "rg-ikram-prod", "ca-ikram-prod", REVISION)
        values = replicas.get("value", []) if isinstance(replicas, dict) else replicas
        running = [r for r in values if any(c.get("ready") for c in r.get("properties", {}).get("containers", []))]
        if len(running) != 1:
            raise RuntimeError("Exactly one ready candidate replica required")
        self.replica = running[0]["name"]

    def run(self, kind, payload):
        relative, expected = APPROVED[kind]
        original = (ROOT / relative).read_bytes()
        if hashlib.sha256(original).hexdigest() != expected:
            raise RuntimeError("Reviewed helper hash mismatch: " + kind)
        text = original.decode("utf-8").replace("dirname(__DIR__, 2)", "'/var/www/html'")
        text = text.replace("stream_get_contents(STDIN)", "$EKRAM_INPUT_JSON")
        source = text.encode()
        code = base64.b64encode(zlib.compress(source)[2:-4]).decode()
        data = base64.b64encode(json.dumps(payload, ensure_ascii=False).encode()).decode()
        runtime_hash = hashlib.sha256(source).hexdigest()
        bootstrap = (
            'echo "EKRAM_FIXED_HELPER_READY\\n";'
            '$read=function($n){$z="";while(strlen($z)<$n){$l=fgets(STDIN);if($l===false)exit(81);$z.=trim($l);}if(strlen($z)!==$n)exit(82);return $z;};'
            f'$s=gzinflate(base64_decode($read({len(code)}),true));'
            f'if(!is_string($s)||hash("sha256",$s)!=="{runtime_hash}")exit(83);'
            f'$EKRAM_INPUT_JSON=base64_decode($read({len(data)}),true);'
            'ob_start();try{eval(substr($s,5));$r=ob_get_clean();}'
            'catch(Throwable $e){ob_end_clean();$d=null;if($e instanceof Illuminate\\Database\\QueryException && preg_match("/value too long for type character varying\\(([0-9]+)\\)/",$e->getMessage(),$m))$d=["kind"=>"varchar_limit","max"=>(int)$m[1]];$r=json_encode(["bounded_error"=>get_class($e),"code"=>preg_replace("/[^A-Za-z0-9]/","",(string)$e->getCode()),"detail"=>$d]);}'
            'echo "EKRAM_RESULT_BEGIN\\n".chunk_split(base64_encode($r),40,"\\n")."EKRAM_RESULT_END\\n";'
        )
        command = "php -r \"eval(base64_decode('" + base64.b64encode(bootstrap.encode()).decode() + "'));\""
        from azure.cli.command_modules.containerapp._ssh_utils import WebSocketConnection, _resize_terminal
        connection = WebSocketConnection(self.cmd, "rg-ikram-prod", "ca-ikram-prod", REVISION, self.replica, "ca-ikram-prod", command)
        connection._socket.settimeout(90)
        _resize_terminal(connection)
        output = ""
        sent = False
        try:
            while True:
                frame = connection.recv()
                if not frame:
                    raise RuntimeError("Lost bounded result; never repeat an SMS or fixture blindly")
                if isinstance(frame, str):
                    frame = frame.encode()
                if len(frame) > 2 and frame[0] == 0 and frame[1] in (1, 2):
                    output += frame[2:].decode(errors="replace")
                if not sent and "EKRAM_FIXED_HELPER_READY" in output:
                    # Source, input and echoed frames remain private process memory.
                    for content in (code, data):
                        for position in range(0, len(content), 500):
                            connection.send(b"\x00\x00" + (content[position:position + 500] + "\n").encode())
                    sent = True
                cleaned = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", output)
                match = re.search(r"EKRAM_RESULT_BEGIN\s+([A-Za-z0-9+/=\s]+)EKRAM_RESULT_END", cleaned)
                if match:
                    result = json.loads(base64.b64decode(re.sub(r"\s", "", match.group(1))))
                    if "bounded_error" in result:
                        emit("bounded_helper_failed", helper=kind, exception_type=result["bounded_error"], code=result["code"])
                        raise RuntimeError("Bounded " + kind + " failed: " + result["bounded_error"] + " code " + str(result["code"]) + " detail " + json.dumps(result.get("detail")))
                    return result
        finally:
            connection.disconnect()


def api(manifest, phase, approved_hash):
    script = ROOT / "tests/API/ekram-live-candidate-api.mjs"
    if hashlib.sha256(script.read_bytes()).hexdigest() != approved_hash:
        raise RuntimeError("Reviewed api helper hash mismatch")
    payload = {**manifest, "candidate_origin": ORIGIN, "candidate_ready": True, "expected_revision": REVISION, "phase": phase}
    result = subprocess.run([r"C:\Program Files\nodejs\node.exe", str(script)], cwd=ROOT,
                            input=json.dumps(payload, ensure_ascii=False), text=True, encoding="utf-8",
                            capture_output=True, timeout=900)
    # API runner emits only sanitized evidence. Never forward raw stderr.
    try:
        evidence = json.loads(result.stdout.strip().splitlines()[-1])
    except Exception:
        raise RuntimeError("API process failed without bounded evidence")
    return result.returncode == 0, evidence


def pause(stage, run, evidence):
    save("EKRAM-LIVE-RUN-CHECKPOINT.json", {"run_id": run, "revision": REVISION, "stage": stage,
                                         "waiting_for_reviewed_control": True, "evidence": evidence})
    emit(stage, waiting_for_reviewed_control=True)
    started = time.monotonic()
    while time.monotonic() - started < 3600:
        if CONTROL.exists():
            command = json.loads(CONTROL.read_text(encoding="utf-8-sig"))
            CONTROL.unlink()
            if command.get("run_id") != run:
                continue
            if command.get("action") in ("retry_api", "cleanup"):
                return command
        time.sleep(2)
    return {"action": "cleanup"}


def main():
    checkpoint = json.loads((ROOT / "deployment/EKRAM-FINAL-CHECKPOINT.json").read_text(encoding="utf-8-sig"))
    if (checkpoint.get("candidate_ready") is not True or checkpoint.get("candidate_revision") != REVISION
        or checkpoint.get("candidate_image_digest") != DIGEST or checkpoint.get("candidate_traffic_percent") != 100
        or checkpoint.get("production_traffic_percent") != 100 or checkpoint.get("sms_provider_requests") != 0
        or checkpoint.get("sms_budget_reserved") is True
        or checkpoint.get("no_background_workers_confirmed") is not True):
        raise RuntimeError("Exact candidate READY and zero-live-request authorization checkpoint required")
    run = str(uuid.uuid4())
    password = secrets.token_hex(32)
    save("EKRAM-LIVE-RUN-CHECKPOINT.json", {"run_id": run, "revision": REVISION, "stage": "fixture_requested", "live_requests": 0})
    session = CandidateSession()
    common = {"candidate_ready": True, "expected_revision": REVISION}
    manifest = None
    approved_api_hash = API_HASH
    live = None
    live_started = False
    selected_ids = []
    stages = {}
    try:
        manifest = session.run("fixture", {**common, "run_id": run, "actor_password": password})
        manifest["additional_beneficiaries"] = []
        manifest["additional_distributions"] = []
        save("EKRAM-TEST-ID-MANIFEST.json", {"run_id": run, "marker": manifest["marker"], "ids": manifest["ids"], "registration_applicable_version": manifest["registration_applicable_version"]})
        emit("fixture_created", run_id=run, test_tasks=3)
        for phase in ("driver",):
            if phase == "driver":
                basic = session.run("basic", {**common, "run_id": run, "actor_id": manifest["ids"]["actor"], "beneficiary_id": manifest["ids"]["beneficiaries"][0]})
                manifest["ids"]["messages"].append(basic["id"])
                # Persist intent IDs before any provider request; no replay after transport loss.
                save("EKRAM-TEST-ID-MANIFEST.json", {"run_id": run, "marker": manifest["marker"], "ids": manifest["ids"], "additional_beneficiaries": manifest["additional_beneficiaries"], "additional_distributions": manifest["additional_distributions"]})
                save("EKRAM-LIVE-RUN-CHECKPOINT.json", {"run_id": run, "revision": REVISION, "stage": "two_sms_execution_started", "never_repeat_provider_execution": True, "message_ids": [basic["id"], manifest["ids"]["driver_message"]]})
                selected_ids = [basic["id"], manifest["ids"]["driver_message"]]
                checkpoint["sms_budget_reserved"] = True
                checkpoint["sms_budget_run_id"] = run
                save("EKRAM-FINAL-CHECKPOINT.json", checkpoint)
                live_started = True
                try:
                    live = session.run("queue", {**common, "no_background_workers_confirmed": True, "run_id": run,
                                                "actor_id": manifest["ids"]["actor"], "assignment_id": manifest["ids"]["assignment"],
                                                "message_ids": selected_ids})
                except Exception:
                    durable = session.run("recovery", {**common, "run_id": run, "message_ids": selected_ids})
                    save("EKRAM-DURABLE-SMS-RECOVERY.json", durable)
                    if durable["provider_outcome_unknown"]:
                        raise RuntimeError("Unknown provider outcome; preserve rows, never retry")
                    rows = [{**m, **m["provider_diagnostics"]} for m in durable["messages"]]
                    if len(rows) != 2 or any(m["status"] != "sent" for m in rows):
                        raise RuntimeError("Lost send result recovered without complete acceptance; never retry")
                    live = {"recovered_read_only": True, "queue": durable["queue"], "remaining_jobs": durable["remaining_jobs"],
                            "provider_calls": sum(m.get("provider_requests", 0) for m in rows), "messages": rows}
                save("EKRAM-LIVE-SMS-EVIDENCE.json", live)
                emit("controlled_sms_completed", provider_calls=live["provider_calls"], statuses=[m["status"] for m in live["messages"]])
                if live["provider_calls"] != 2 or any(m["status"] != "sent" or m["acceptance_state"] != "provider_accepted" for m in live["messages"]):
                    pause("sms_gate_failed_no_retry", run, live)
                    raise RuntimeError("SMS gate failed; no additional sends authorized by this runner")
                manifest["live_driver_send_verified"] = True
            while True:
                passed, evidence = api(manifest, phase, approved_api_hash)
                for created in evidence.get("created", []):
                    destination = "additional_beneficiaries" if created["entity"] == "beneficiary" else "additional_distributions"
                    if created["id"] not in manifest[destination]:
                        manifest[destination].append(created["id"])
                stages[phase] = evidence
                emit("api_" + phase, **evidence["summary"])
                if passed:
                    break
                command = pause("api_" + phase + "_needs_review", run, evidence)
                if command["action"] == "cleanup":
                    raise RuntimeError("API gate unresolved; cleanup requested")
                approved_api_hash = command.get("api_sha256", approved_api_hash)
        verification = session.run("verify", {**common, "manifest": manifest})
        save("EKRAM-DELIVERY-PROOF-VALIDATION.json", verification)
        if not (verification["atomic_once"] and verification["all_expected_completed"] and verification.get("connected_api_journey_valid")):
            pause("database_evidence_needs_review", run, verification)
            raise RuntimeError("Candidate database evidence gate unresolved")
        stages["database"] = verification
        emit("candidate_business_gates_passed", completed_tasks=verification["counts"]["completed_tasks"])
    finally:
        try:
            durable = session.run("recovery", {**common, "run_id": run, "message_ids": selected_ids})
        except Exception:
            save("EKRAM-LIVE-RUN-CHECKPOINT.json", {"run_id": run, "revision": REVISION, "stage": "exact_run_recovery_required", "live_started": live_started,
                                                  "message_ids": selected_ids, "cleanup_performed": False, "never_repeat_provider_execution": True})
            emit("exact_run_recovery_required", run_id=run, cleanup_performed=False)
            raise RuntimeError("Cannot verify durable run scope; preserve rows for exact-run recovery")
        if not durable["actor_exists"]:
            save("EKRAM-LIVE-RUN-CHECKPOINT.json", {"run_id": run, "revision": REVISION, "stage": "no_committed_test_actor", "cleanup_needed": False})
            emit("no_committed_test_actor", run_id=run)
        else:
            recovered = durable["manifest"]
            if manifest is None:
                manifest = recovered
            else:
                manifest["ids"] = recovered["ids"]
                manifest["additional_beneficiaries"] = recovered["additional_beneficiaries"]
                manifest["additional_distributions"] = recovered["additional_distributions"]
            save("EKRAM-DURABLE-RUN-RECOVERY.json", durable)
            if live_started and durable["provider_outcome_unknown"]:
                save("EKRAM-LIVE-RUN-CHECKPOINT.json", {"run_id": run, "revision": REVISION, "stage": "provider_reconciliation_required", "message_ids": selected_ids,
                                                      "cleanup_performed": False, "never_repeat_provider_execution": True, "durable_evidence": durable})
                emit("provider_reconciliation_required", cleanup_performed=False)
                raise RuntimeError("Preserve ambiguous send evidence; no automatic retry or cleanup")
            cleanup = session.run("cleanup", {**common, "manifest": manifest})
            save("EKRAM-TEST-DATA-CLEANUP.json", cleanup)
            save("EKRAM-TEST-ID-MANIFEST.json", {"run_id": run, "marker": manifest["marker"], "ids": manifest["ids"], "additional_beneficiaries": manifest["additional_beneficiaries"], "additional_distributions": manifest["additional_distributions"]})
            save("EKRAM-LIVE-RUN-CHECKPOINT.json", {"run_id": run, "revision": REVISION, "stage": "cleanup_finished", "stages": stages, "live": live, "cleanup": cleanup, "credentials_persisted": False})
            emit("cleanup_finished", cleanup=cleanup["cleanup"])


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        emit("orchestration_stopped", exception_type=type(error).__name__)
        sys.exit(1)
