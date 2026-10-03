import subprocess, sys, time, pathlib
codex, workdir, prompt_path, last, out_path, err_path, watch, label = sys.argv[1:9]
one = f"Read UTF-8 task file {prompt_path} and execute fully. No browser. Write RESULT.md next to that prompt when done."
args = ["exec","--json","-m","gpt-6-astra","-c","model_reasoning_effort=xhigh","-C",workdir,"-o",last,"--skip-git-repo-check",one]
watch_p = pathlib.Path(watch)
with open(out_path,"w",encoding="utf-8") as out, open(err_path,"w",encoding="utf-8") as err:
    p = subprocess.Popen([codex]+args, cwd=workdir, stdout=out, stderr=err, stdin=subprocess.DEVNULL)
    watch_p.write_text(
        f"label={label}\nstarted={time.strftime('%Y-%m-%dT%H:%M:%S')}\npid={p.pid}\nworkdir={workdir}\nmodel=gpt-6-astra\neffort=xhigh\nnote=qa-fail-s03-redo\n",
        encoding="utf-8",
    )
    code = p.wait()
watch_p.open("a",encoding="utf-8").write(f"exit={code}\nfinished={time.strftime('%Y-%m-%dT%H:%M:%S')}\n")
sys.exit(code)