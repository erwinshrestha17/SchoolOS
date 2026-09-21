from runpy import run_path
import subprocess
x=run_path('/tmp/schoolos-slice0a-evidence/run-gates.py');e=x['env'];out=x['out'];root=x['root']
e.update({'NODE_ENV':'production','SCHOOLOS_E2E_SKIP_WEB_BUILD':'true','NEXT_PUBLIC_API_BASE_URL':'http://localhost:4400/api/v1','SCHOOLOS_E2E_API_BASE_URL':'http://localhost:4400/api/v1','SCHOOLOS_E2E_TENANT_SLUG':'default-school','SCHOOLOS_E2E_EMAIL':'admin@schoolos.com','SCHOOLOS_E2E_PASSWORD':e['SCHOOLOS_DEMO_PASSWORD'],'SCHOOLOS_E2E_PLATFORM_TENANT_SLUG':'platform','SCHOOLOS_E2E_PLATFORM_EMAIL':'platform@schoolos.com','SCHOOLOS_E2E_PLATFORM_PASSWORD':e['SCHOOLOS_DEMO_PASSWORD']})
for name,cmd in [('chromium','pnpm --filter @schoolos/web exec playwright install chromium'),('web-e2e','pnpm test:web:e2e')]:
 with (out/(name+'.log')).open('w') as f:p=subprocess.run(cmd,shell=True,cwd=root,env=e,stdout=f,stderr=subprocess.STDOUT)
 print(name,p.returncode,flush=True)
