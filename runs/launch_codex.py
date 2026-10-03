import subprocess, sys, time, pathlib, os
codex, workdir, prompt_path, last, out_path, err_path, watch, label = sys.argv[1:9]
prompt = pathlib.Path(prompt_path).read_text(encoding="utf-8")
one = f"Read the full task from {prompt_path} (UTF-8) and execute it completely. Write RESULT.md beside that prompt file when done."
args = ["exec","--json","-m","gpt-6-astra","-c","model_reasoning_effort=xhigh","-C",workdir,"-o",last,"--skip-git-repo-check",one]
watch_p = pathlib.Path(watch)
watch_p.write_text(
    f"label={label}\nstarted={time.strftime('%Y-%m-%dT%H:%M:%S')}\npid=pending\nworkdir={workdir}\nmodel=gpt-6-astra\neffort=xhigh\nnote=python-launcher\n",
    encoding="utf-8",
)
with open(out_path,"w",encoding="utf-8") as out, open(err_path,"w",encoding="utf-8") as err:
    p = subprocess.Popen([codex]+args, cwd=workdir, stdout=out, stderr=err, stdin=subprocess.DEVNULL)
    watch_p.write_text(
        f"label={label}\nstarted={time.strftime('%Y-%m-%dT%H:%M:%S')}\npid={p.pid}\nworkdir={workdir}\nmodel=gpt-6-astra\neffort=xhigh\nnote=python-launcher\n",
        encoding="utf-8",
    )
    code = p.wait()
with open(watch,"a",encoding="utf-8") as w:
    w.write(f"exit={code}\nfinished={time.strftime('%Y-%m-%dT%H:%M:%S')}\n")
sys.exit(code)